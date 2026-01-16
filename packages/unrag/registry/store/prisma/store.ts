import type {Chunk, DeleteInput, VectorStore} from '@registry/core/types'
import type {PrismaClient} from '@prisma/client'
import {empty, sqltag as sql} from '@prisma/client/runtime/library'

const sanitizeMetadata = (metadata: unknown) => {
	if (metadata === undefined) return null
	try {
		return JSON.parse(JSON.stringify(metadata))
	} catch {
		return null
	}
}

const toVectorLiteral = (embedding: number[]) => `[${embedding.join(',')}]`

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

export const createPrismaVectorStore = (
	prisma: PrismaClient
): VectorStore & {inspector: DebugStoreInspector} => {
	const inspector: DebugStoreInspector = {
		listDocuments: async ({prefix, limit = 50, offset = 0}) => {
			const whereSql = prefix
				? sql`where d.source_id like ${prefix + '%'}`
				: empty

			const rows = (await prisma.$queryRaw(
				sql`
          select
            d.source_id as source_id,
            d.created_at as created_at,
            coalesce(count(c.id), 0) as chunk_count
          from documents as d
          left join chunks as c on c.document_id = d.id
          ${whereSql}
          group by d.source_id, d.created_at
          order by d.created_at desc
          limit ${limit}
          offset ${offset}
        `
			)) as Array<{
				source_id: unknown
				created_at: unknown
				chunk_count: unknown
			}>

			const totalRows = (await prisma.$queryRaw(
				sql`
          select count(*)::int as total
          from documents as d
          ${whereSql}
        `
			)) as Array<{total: unknown}>

			const total = Number(totalRows[0]?.total ?? 0)

			return {
				documents: rows.map((r) => ({
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
			const docs = (await prisma.$queryRaw(
				sql`
          select d.id as id, d.source_id as source_id, d.metadata as metadata
          from documents as d
          where d.source_id = ${sourceId}
          limit 1
        `
			)) as Array<{id: unknown; source_id: unknown; metadata: unknown}>

			const doc = docs[0]
			if (!doc?.id) return {document: undefined}

			const chunkRows = (await prisma.$queryRaw(
				sql`
          select c.id as id, c.idx as idx, c.content as content, c.metadata as metadata
          from chunks as c
          where c.document_id = ${String(doc.id)}::uuid
          order by c.idx asc
        `
			)) as Array<{
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
			const rows = (await prisma.$queryRaw(
				'sourceId' in input
					? sql`delete from documents where source_id = ${input.sourceId} returning 1 as one`
					: sql`delete from documents where source_id like ${input.sourceIdPrefix + '%'} returning 1 as one`
			)) as Array<{one: unknown}>
			return {deletedCount: rows.length}
		},

		deleteChunks: async ({chunkIds}) => {
			const ids = Array.isArray(chunkIds) ? chunkIds.filter(Boolean) : []
			if (ids.length === 0) return {deletedCount: 0}

			// Prisma SQL templating here doesn't include a safe "IN list" helper.
			// Keep this safe by only accepting UUID-like strings and using a tightly scoped unsafe query.
			const safe = ids.filter((id) => /^[0-9a-fA-F-]{36}$/.test(id))
			if (safe.length === 0) return {deletedCount: 0}

			const inList = safe.map((id) => `'${id}'::uuid`).join(', ')
			const q = `delete from chunks where id in (${inList}) returning 1 as one`
			const rows = (await prisma.$queryRawUnsafe(q)) as Array<{
				one: unknown
			}>
			return {deletedCount: rows.length}
		},

		storeStats: async () => {
			const rows = (await prisma.$queryRaw(
				sql`
          select
            (select count(*)::int from documents) as documents_count,
            (select count(*)::int from chunks) as chunks_count,
            (select count(*)::int from embeddings) as embeddings_count,
            (select max(embedding_dimension)::int from embeddings) as embedding_dimension
        `
			)) as Array<{
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
					adapter: 'prisma',
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

			const head = chunkItems[0]!
			const documentMetadata = sanitizeMetadata(head.metadata)

			return await prisma.$transaction(
				async (tx: {
					$executeRaw: (query: unknown) => Promise<unknown>
					$queryRaw: <T>(query: unknown) => Promise<T>
				}) => {
					// Upsert document by source_id (requires UNIQUE constraint on documents.source_id).
					// Returns the canonical document id (existing id on conflict, or new id on insert).
					const docResult = await tx.$queryRaw<Array<{id: string}>>(
						sql`
          insert into documents (id, source_id, content, metadata)
          values (${head.documentId}::uuid, ${head.sourceId}, ${head.documentContent ?? ''}, ${JSON.stringify(
				documentMetadata
			)}::jsonb)
          on conflict (source_id) do update set
            content = excluded.content,
            metadata = excluded.metadata
          returning id
        `
					)

					const canonicalDocumentId = docResult[0]?.id
					if (!canonicalDocumentId) {
						throw new Error(
							'Failed to upsert document: no id returned'
						)
					}

					// Delete all existing chunks for this document (they will be replaced).
					// Cascades to embeddings via FK constraint.
					await tx.$executeRaw(
						sql`delete from chunks where document_id = ${canonicalDocumentId}::uuid`
					)

					// Insert new chunks and embeddings.
					for (const chunk of chunkItems) {
						const chunkMetadata = sanitizeMetadata(chunk.metadata)

						await tx.$executeRaw(
							sql`
            insert into chunks (id, document_id, source_id, idx, content, token_count, metadata)
            values (
              ${chunk.id}::uuid,
              ${canonicalDocumentId}::uuid,
              ${chunk.sourceId},
              ${chunk.index},
              ${chunk.content},
              ${chunk.tokenCount},
              ${JSON.stringify(chunkMetadata)}::jsonb
            )
          `
						)

						if (!chunk.embedding) continue
						const embeddingLiteral = toVectorLiteral(
							chunk.embedding
						)

						await tx.$executeRaw(
							sql`
            insert into embeddings (chunk_id, embedding, embedding_dimension)
            values (${chunk.id}::uuid, ${embeddingLiteral}::vector, ${
				chunk.embedding.length
			})
          `
						)
					}

					return {documentId: canonicalDocumentId}
				}
			)
		},

		query: async ({embedding, topK, scope = {}}) => {
			type QueryRow = {
				id: string
				document_id: string
				source_id: string
				idx: number
				content: string
				token_count: number
				metadata: unknown
				score: number
			}

			const vectorLiteral = toVectorLiteral(embedding)

			const whereSql = scope.sourceId
				? // Interpret scope.sourceId as a prefix so callers can namespace content
					// (e.g. `tenant:acme:`) without needing separate tables.
					sql`where c.source_id like ${scope.sourceId + '%'}`
				: empty

			const rows = (await prisma.$queryRaw(
				sql`
        select
          c.id,
          c.document_id,
          c.source_id,
          c.idx,
          c.content,
          c.token_count,
          c.metadata,
          (e.embedding <=> ${vectorLiteral}::vector) as score
        from chunks as c
        join embeddings as e on e.chunk_id = c.id
        join documents as d on d.id = c.document_id
        ${whereSql}
        order by score asc
        limit ${topK}
      `
			)) as QueryRow[]

			return rows.map((row: QueryRow) => ({
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
			if ('sourceId' in input) {
				await prisma.$executeRaw(
					sql`delete from documents where source_id = ${input.sourceId}`
				)
				return
			}

			await prisma.$executeRaw(
				sql`delete from documents where source_id like ${input.sourceIdPrefix + '%'}`
			)
		},
		inspector
	}

	return store
}
