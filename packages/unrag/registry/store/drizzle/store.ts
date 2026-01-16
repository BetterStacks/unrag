import type {Chunk, DeleteInput, VectorStore} from '@registry/core/types'
import {chunks, documents, embeddings} from '@registry/store/drizzle/schema'
import {type SQL, eq, like, sql} from 'drizzle-orm'
import type {PgDatabase, PgQueryResultHKT} from 'drizzle-orm/pg-core'

/**
 * Accepts any Drizzle Postgres database instance regardless of schema type.
 */
type DrizzleDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>

/**
 * Query row type for vector similarity search results.
 */
interface QueryRow {
	id: string
	document_id: string
	source_id: string
	idx: number
	content: string
	token_count: number
	metadata: Record<string, unknown> | null
	score: number
}

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

const toDocumentRow = (chunk: Chunk) => ({
	id: chunk.documentId,
	sourceId: chunk.sourceId,
	content: chunk.documentContent ?? '',
	metadata: sanitizeMetadata(chunk.metadata) as Record<string, unknown> | null
})

const toChunkRow = (chunk: Chunk) => ({
	id: chunk.id,
	documentId: chunk.documentId,
	sourceId: chunk.sourceId,
	index: chunk.index,
	content: chunk.content,
	tokenCount: chunk.tokenCount,
	metadata: sanitizeMetadata(chunk.metadata) as Record<string, unknown> | null
})

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

export const createDrizzleVectorStore = (
	db: DrizzleDb
): VectorStore & {inspector: DebugStoreInspector} => {
	const inspector: DebugStoreInspector = {
		listDocuments: async ({prefix, limit = 50, offset = 0}) => {
			const where = prefix
				? sql`where d.source_id like ${prefix + '%'}`
				: sql``

			const rows = await db.execute(
				sql`
          select
            d.source_id as source_id,
            d.created_at as created_at,
            coalesce(count(c.id), 0) as chunk_count
          from ${documents} as d
          left join ${chunks} as c on c.document_id = d.id
          ${where}
          group by d.source_id, d.created_at
          order by d.created_at desc
          limit ${limit}
          offset ${offset}
        `
			)

			const totalRes = await db.execute(
				sql`
          select count(*)::int as total
          from ${documents} as d
          ${where}
        `
			)

			const docRows = (
				Array.isArray(rows)
					? (rows as any[])
					: ((rows as any)?.rows ?? [])
			) as Array<{
				source_id: unknown
				created_at: unknown
				chunk_count: unknown
			}>

			const totalRows = (
				Array.isArray(totalRes)
					? (totalRes as any[])
					: ((totalRes as any)?.rows ?? [])
			) as Array<{total: unknown}>

			const total =
				typeof totalRows[0]?.total === 'number'
					? totalRows[0]!.total
					: Number(totalRows[0]?.total ?? 0)

			return {
				documents: docRows.map((r) => ({
					sourceId: String(r.source_id),
					chunkCount: Number(r.chunk_count),
					createdAt:
						r.created_at instanceof Date
							? r.created_at.toISOString()
							: r.created_at
								? String(r.created_at)
								: undefined
				})),
				total
			}
		},

		getDocument: async ({sourceId}) => {
			const docRes = await db.execute(
				sql`
          select
            d.id as id,
            d.source_id as source_id,
            d.metadata as metadata
          from ${documents} as d
          where d.source_id = ${sourceId}
          limit 1
        `
			)

			const docRows = (
				Array.isArray(docRes)
					? (docRes as any[])
					: ((docRes as any)?.rows ?? [])
			) as Array<{id: unknown; source_id: unknown; metadata: unknown}>

			const doc = docRows[0]
			if (!doc?.id) {
				return {document: undefined}
			}

			const chunksRes = await db.execute(
				sql`
          select
            c.id as id,
            c.idx as idx,
            c.content as content,
            c.metadata as metadata
          from ${chunks} as c
          where c.document_id = ${String(doc.id)}::uuid
          order by c.idx asc
        `
			)

			const chunkRows = (
				Array.isArray(chunksRes)
					? (chunksRes as any[])
					: ((chunksRes as any)?.rows ?? [])
			) as Array<{
				id: unknown
				idx: unknown
				content: unknown
				metadata: unknown
			}>

			return {
				document: {
					sourceId: String(doc.source_id),
					chunks: chunkRows.map((r) => ({
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
			const res = await db.execute(
				'sourceId' in input
					? sql`delete from ${documents} where source_id = ${input.sourceId} returning 1 as one`
					: sql`delete from ${documents} where source_id like ${input.sourceIdPrefix + '%'} returning 1 as one`
			)

			const rows = (
				Array.isArray(res) ? (res as any[]) : ((res as any)?.rows ?? [])
			) as Array<{one: unknown}>
			return {deletedCount: rows.length}
		},

		deleteChunks: async ({chunkIds}) => {
			const ids = Array.isArray(chunkIds) ? chunkIds.filter(Boolean) : []
			if (ids.length === 0) return {deletedCount: 0}

			const inList = sql.join(
				ids.map((id) => sql`${id}::uuid`),
				sql`, `
			)

			const res = await db.execute(
				sql`delete from ${chunks} where id in (${inList}) returning 1 as one`
			)
			const rows = (
				Array.isArray(res) ? (res as any[]) : ((res as any)?.rows ?? [])
			) as Array<{one: unknown}>
			return {deletedCount: rows.length}
		},

		storeStats: async () => {
			const res = await db.execute(
				sql`
          select
            (select count(*)::int from ${documents}) as documents_count,
            (select count(*)::int from ${chunks}) as chunks_count,
            (select count(*)::int from ${embeddings}) as embeddings_count,
            (select max(embedding_dimension)::int from ${embeddings}) as embedding_dimension
        `
			)

			const rows = (
				Array.isArray(res) ? (res as any[]) : ((res as any)?.rows ?? [])
			) as Array<{
				documents_count: unknown
				chunks_count: unknown
				embeddings_count: unknown
				embedding_dimension: unknown
			}>
			const row = rows[0] ?? ({} as any)

			const documentsCount = Number(row.documents_count ?? 0)
			const chunksCount = Number(row.chunks_count ?? 0)
			const embeddingsCount = Number(row.embeddings_count ?? 0)
			const embeddingDimension =
				row.embedding_dimension === null ||
				row.embedding_dimension === undefined
					? undefined
					: Number(row.embedding_dimension)

			return {
				stats: {
					adapter: 'drizzle',
					tables: [
						{name: 'documents', rowCount: documentsCount},
						{name: 'chunks', rowCount: chunksCount},
						{name: 'embeddings', rowCount: embeddingsCount}
					],
					embeddingDimension,
					totalVectors: embeddingsCount
				}
			}
		}
	}

	const store: VectorStore & {inspector: DebugStoreInspector} = {
		upsert: async (chunkItems) => {
			if (chunkItems.length === 0) {
				throw new Error('upsert() requires at least one chunk')
			}

			return await db.transaction(async (tx) => {
				const head = chunkItems[0]!
				const documentRow = toDocumentRow(head)

				// Upsert document by source_id (requires UNIQUE constraint on documents.source_id).
				// Returns the canonical document id (existing id on conflict, or new id on insert).
				// Using raw SQL because Drizzle's onConflictDoUpdate requires schema-level unique definition.
				const docResult = await tx.execute<{id: string}>(
					sql`
          insert into ${documents} (id, source_id, content, metadata)
          values (${documentRow.id}::uuid, ${documentRow.sourceId}, ${documentRow.content}, ${JSON.stringify(documentRow.metadata)}::jsonb)
          on conflict (source_id) do update set
            content = excluded.content,
            metadata = excluded.metadata
          returning id
        `
				)

				const rows = Array.isArray(docResult)
					? (docResult as Array<{id: string}>)
					: ((docResult as {rows?: Array<{id: string}>}).rows ?? [])

				const canonicalDocumentId = rows[0]?.id
				if (!canonicalDocumentId) {
					throw new Error('Failed to upsert document: no id returned')
				}

				// Delete all existing chunks for this document (they will be replaced).
				// Cascades to embeddings via FK constraint.
				await tx
					.delete(chunks)
					.where(eq(chunks.documentId, canonicalDocumentId))

				// Insert new chunks and embeddings.
				for (const chunk of chunkItems) {
					const chunkRow = toChunkRow(chunk)

					await tx.insert(chunks).values({
						...chunkRow,
						documentId: canonicalDocumentId
					})

					if (!chunk.embedding) {
						continue
					}

					await tx.insert(embeddings).values({
						chunkId: chunk.id,
						embedding: chunk.embedding,
						embeddingDimension: chunk.embedding.length
					})
				}

				return {documentId: canonicalDocumentId}
			})
		},

		query: async ({embedding, topK, scope = {}}) => {
			const filters: SQL[] = []

			if (scope.sourceId) {
				// Interpret scope.sourceId as a prefix so callers can namespace content
				// (e.g. `tenant:acme:`) without needing separate tables.
				filters.push(sql`c.source_id like ${scope.sourceId + '%'}`)
			}

			const whereClause =
				filters.length > 0
					? sql`where ${sql.join(filters, sql` and `)}`
					: sql``

			const vectorLiteral = `[${embedding.join(',')}]`

			const result = await db.execute(
				sql`
        select
          c.id,
          c.document_id,
          c.source_id,
          c.idx,
          c.content,
          c.token_count,
          c.metadata,
          (e.embedding <=> ${vectorLiteral}) as score
        from ${chunks} as c
        join ${embeddings} as e on e.chunk_id = c.id
        join ${documents} as d on d.id = c.document_id
        ${whereClause}
        order by score asc
        limit ${topK}
      `
			)

			const rows: QueryRow[] = Array.isArray(result)
				? (result as QueryRow[])
				: ((result as {rows?: QueryRow[]}).rows ?? [])

			return rows.map((row) => ({
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
			if (input.sourceId !== undefined) {
				await db
					.delete(documents)
					.where(eq(documents.sourceId, input.sourceId))
				return
			}

			await db
				.delete(documents)
				.where(like(documents.sourceId, input.sourceIdPrefix + '%'))
		},
		inspector
	}

	return store
}
