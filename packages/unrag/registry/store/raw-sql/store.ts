import type {Chunk, DeleteInput, VectorStore} from '@registry/core/types'
import type {Pool, PoolClient} from 'pg'

const sanitizeMetadata = (metadata: unknown) => {
	if (metadata === undefined) {
		return null
	}
	try {
		return JSON.parse(JSON.stringify(metadata))
	} catch {
		return null
	}
}

const toVectorLiteral = (embedding: number[]) => `[${embedding.join(',')}]`

const withTx = async <T>(
	pool: Pool,
	fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
	const client = await pool.connect()
	try {
		await client.query('begin')
		const result = await fn(client)
		await client.query('commit')
		return result
	} catch (err) {
		try {
			await client.query('rollback')
		} catch {
			// ignore rollback errors
		}
		throw err
	} finally {
		client.release()
	}
}

type DebugStoreInspector = {
	listDocuments: (args: {
		prefix?: string
		limit?: number
		offset?: number
	}) => Promise<{
		documents: Array<{
			sourceId: string
			chunkCount: number
			createdAt?: string
		}>
		total?: number
	}>
	getDocument: (args: {sourceId: string}) => Promise<{
		document?: {
			sourceId: string
			chunks: Array<{
				id: string
				content: string
				sequence: number
				metadata: Record<string, unknown>
			}>
			metadata: Record<string, unknown>
		}
	}>
	deleteDocument: (input: DeleteInput) => Promise<{deletedCount?: number}>
	deleteChunks: (args: {chunkIds: string[]}) => Promise<{
		deletedCount?: number
	}>
	storeStats: () => Promise<{
		stats: {
			adapter: string
			tables?: Array<{name: string; rowCount: number; size?: number}>
			embeddingDimension?: number
			totalVectors?: number
		}
	}>
}

export const createRawSqlVectorStore = (
	pool: Pool
): VectorStore & {inspector: DebugStoreInspector} => {
	const inspector: DebugStoreInspector = {
		listDocuments: async ({prefix, limit = 50, offset = 0}) => {
			const values: unknown[] = []
			let whereSql = ''
			if (prefix) {
				values.push(`${prefix}%`)
				whereSql = `where d.source_id like $${values.length}`
			}

			values.push(limit)
			values.push(offset)

			const rows = await pool.query<{
				source_id: string
				created_at: unknown
				chunk_count: number
			}>(
				`
        select
          d.source_id as source_id,
          d.created_at as created_at,
          coalesce(count(c.id), 0) as chunk_count
        from documents as d
        left join chunks as c on c.document_id = d.id
        ${whereSql}
        group by d.source_id, d.created_at
        order by d.created_at desc
        limit $${values.length - 1}
        offset $${values.length}
        `,
				values
			)

			const totalValues: unknown[] = []
			let totalWhereSql = ''
			if (prefix) {
				totalValues.push(`${prefix}%`)
				totalWhereSql = 'where d.source_id like $1'
			}
			const totalRes = await pool.query<{total: number}>(
				`
        select count(*)::int as total
        from documents as d
        ${totalWhereSql}
        `,
				totalValues
			)

			return {
				documents: rows.rows.map((r) => ({
					sourceId: String(r.source_id),
					chunkCount: Number(r.chunk_count),
					createdAt:
						r.created_at instanceof Date
							? r.created_at.toISOString()
							: r.created_at
								? String(r.created_at)
								: undefined
				})),
				total: Number(totalRes.rows[0]?.total ?? 0)
			}
		},

		getDocument: async ({sourceId}) => {
			const docRes = await pool.query<{
				id: string
				source_id: string
				metadata: unknown
			}>(
				`
        select id, source_id, metadata
        from documents
        where source_id = $1
        limit 1
        `,
				[sourceId]
			)

			const doc = docRes.rows[0]
			if (!doc?.id) {
				return {document: undefined}
			}

			const chunkRes = await pool.query<{
				id: string
				idx: number
				content: string
				metadata: unknown
			}>(
				`
        select id, idx, content, metadata
        from chunks
        where document_id = $1
        order by idx asc
        `,
				[doc.id]
			)

			return {
				document: {
					sourceId: String(doc.source_id),
					chunks: chunkRes.rows.map((r) => ({
						id: String(r.id),
						content: String(r.content ?? ''),
						sequence: Number(r.idx),
						metadata: (r.metadata ?? {}) as Record<string, unknown>
					})),
					metadata: (doc.metadata ?? {}) as Record<string, unknown>
				}
			}
		},

		deleteDocument: async (input: DeleteInput) => {
			const res = await pool.query(
				'sourceId' in input
					? 'delete from documents where source_id = $1 returning 1 as one'
					: 'delete from documents where source_id like $1 returning 1 as one',
				[
					'sourceId' in input
						? input.sourceId
						: `${input.sourceIdPrefix}%`
				]
			)
			return {deletedCount: res.rowCount ?? res.rows.length}
		},

		deleteChunks: async ({chunkIds}) => {
			const ids = Array.isArray(chunkIds) ? chunkIds.filter(Boolean) : []
			if (ids.length === 0) {
				return {deletedCount: 0}
			}
			const res = await pool.query(
				'delete from chunks where id = any($1::uuid[]) returning 1 as one',
				[ids]
			)
			return {deletedCount: res.rowCount ?? res.rows.length}
		},

		storeStats: async () => {
			const res = await pool.query<{
				documents_count: number
				chunks_count: number
				embeddings_count: number
				embedding_dimension: number | null
			}>(
				`
        select
          (select count(*)::int from documents) as documents_count,
          (select count(*)::int from chunks) as chunks_count,
          (select count(*)::int from embeddings) as embeddings_count,
          (select max(embedding_dimension)::int from embeddings) as embedding_dimension
        `
			)
			const row = res.rows[0]
			return {
				stats: {
					adapter: 'raw-sql',
					tables: [
						{
							name: 'documents',
							rowCount: Number(row?.documents_count ?? 0)
						},
						{
							name: 'chunks',
							rowCount: Number(row?.chunks_count ?? 0)
						},
						{
							name: 'embeddings',
							rowCount: Number(row?.embeddings_count ?? 0)
						}
					],
					embeddingDimension:
						row?.embedding_dimension === null ||
						row?.embedding_dimension === undefined
							? undefined
							: Number(row.embedding_dimension),
					totalVectors: Number(row?.embeddings_count ?? 0)
				}
			}
		}
	}

	const store: VectorStore & {inspector: DebugStoreInspector} = {
		upsert: async (chunkItems) => {
			if (chunkItems.length === 0) {
				throw new Error('upsert() requires at least one chunk')
			}

			return await withTx(pool, async (client) => {
				const head = chunkItems[0]
				if (!head) {
					throw new Error('upsert() requires at least one chunk')
				}
				const documentMetadata = sanitizeMetadata(head.metadata)

				// Upsert document by source_id (requires UNIQUE constraint on documents.source_id).
				// Returns the canonical document id (existing id on conflict, or new id on insert).
				const docResult = await client.query<{id: string}>(
					`
        insert into documents (id, source_id, content, metadata)
        values ($1, $2, $3, $4::jsonb)
        on conflict (source_id) do update set
          content = excluded.content,
          metadata = excluded.metadata
        returning id
        `,
					[
						head.documentId,
						head.sourceId,
						head.documentContent ?? '',
						JSON.stringify(documentMetadata)
					]
				)

				const canonicalDocumentId = docResult.rows[0]?.id
				if (!canonicalDocumentId) {
					throw new Error('Failed to upsert document: no id returned')
				}

				// Delete all existing chunks for this document (they will be replaced).
				// Cascades to embeddings via FK constraint.
				await client.query(
					'delete from chunks where document_id = $1',
					[canonicalDocumentId]
				)

				// Insert new chunks and embeddings.
				for (const chunk of chunkItems) {
					const chunkMetadata = sanitizeMetadata(chunk.metadata)

					await client.query(
						`
          insert into chunks (id, document_id, source_id, idx, content, token_count, metadata)
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
          `,
						[
							chunk.id,
							canonicalDocumentId,
							chunk.sourceId,
							chunk.index,
							chunk.content,
							chunk.tokenCount,
							JSON.stringify(chunkMetadata)
						]
					)

					if (!chunk.embedding) {
						continue
					}

					const embeddingLiteral = toVectorLiteral(chunk.embedding)
					await client.query(
						`
          insert into embeddings (chunk_id, embedding, embedding_dimension)
          values ($1, $2::vector, $3)
          `,
						[chunk.id, embeddingLiteral, chunk.embedding.length]
					)
				}

				return {documentId: canonicalDocumentId}
			})
		},

		query: async ({embedding, topK, scope = {}}) => {
			const vectorLiteral = toVectorLiteral(embedding)

			const values: unknown[] = [vectorLiteral, topK]
			const where: string[] = []

			if (scope.sourceId) {
				// Interpret scope.sourceId as a prefix so callers can namespace content
				// (e.g. `tenant:acme:`) without needing separate tables.
				values.push(`${scope.sourceId}%`)
				where.push(`c.source_id like $${values.length}`)
			}

			const whereSql = where.length ? `where ${where.join(' and ')}` : ''

			const res = await pool.query(
				`
      select
        c.id,
        c.document_id,
        c.source_id,
        c.idx,
        c.content,
        c.token_count,
        c.metadata,
        (e.embedding <=> $1::vector) as score
      from chunks as c
      join embeddings as e on e.chunk_id = c.id
      join documents as d on d.id = c.document_id
      ${whereSql}
      order by score asc
      limit $2
      `,
				values
			)

			return res.rows.map((row) => ({
				id: String(row.id),
				documentId: String(row.document_id),
				sourceId: String(row.source_id),
				index: Number(row.idx),
				content: String(row.content),
				tokenCount: Number(row.token_count),
				metadata: (row.metadata ?? {}) as Chunk['metadata'],
				score: Number(row.score)
			}))
		},

		delete: async (input) => {
			await withTx(pool, async (client) => {
				if ('sourceId' in input) {
					await client.query(
						'delete from documents where source_id = $1',
						[input.sourceId]
					)
					return
				}

				await client.query(
					'delete from documents where source_id like $1',
					[`${input.sourceIdPrefix}%`]
				)
			})
		},
		inspector
	}

	return store
}
