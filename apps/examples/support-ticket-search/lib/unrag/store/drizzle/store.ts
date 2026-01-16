import {documents, chunks, embeddings} from './schema'
import type {Chunk, VectorStore} from '../../core/types'
import {eq, like, sql, type SQL} from 'drizzle-orm'
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

export const createDrizzleVectorStore = (db: DrizzleDb): VectorStore => ({
	upsert: async (chunkItems) => {
		if (chunkItems.length === 0) {
			return
		}

		await db.transaction(async (tx) => {
			const head = chunkItems[0]!
			const documentRow = toDocumentRow(head)

			// Replace-by-sourceId: delete any previously stored document(s) for this logical id.
			// Cascades to chunks and embeddings.
			await tx
				.delete(documents)
				.where(eq(documents.sourceId, head.sourceId))

			await tx
				.insert(documents)
				.values(documentRow)
				.onConflictDoUpdate({
					target: documents.id,
					set: {
						sourceId: documentRow.sourceId,
						content: documentRow.content,
						metadata: documentRow.metadata
					}
				})

			for (const chunk of chunkItems) {
				const chunkRow = toChunkRow(chunk)

				await tx
					.insert(chunks)
					.values(chunkRow)
					.onConflictDoUpdate({
						target: chunks.id,
						set: {
							content: chunkRow.content,
							tokenCount: chunkRow.tokenCount,
							metadata: chunkRow.metadata,
							index: chunkRow.index,
							sourceId: chunkRow.sourceId
						}
					})

				if (!chunk.embedding) {
					continue
				}

				await tx
					.insert(embeddings)
					.values({
						chunkId: chunk.id,
						embedding: chunk.embedding,
						embeddingDimension: chunk.embedding.length
					})
					.onConflictDoUpdate({
						target: embeddings.chunkId,
						set: {
							embedding: chunk.embedding,
							embeddingDimension: chunk.embedding.length
						}
					})
			}
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
	}
})
