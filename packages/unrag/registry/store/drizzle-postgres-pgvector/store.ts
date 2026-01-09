import { documents, chunks, embeddings } from "./schema";
import type { Chunk, VectorStore } from "../../core/types";
import { eq, like, sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * Accepts any Drizzle Postgres database instance regardless of schema type.
 */
type DrizzleDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

/**
 * Query row type for vector similarity search results.
 */
interface QueryRow {
  id: string;
  document_id: string;
  source_id: string;
  idx: number;
  content: string;
  token_count: number;
  metadata: Record<string, unknown> | null;
  score: number;
}

const sanitizeMetadata = (metadata: unknown) => {
  if (metadata === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(metadata));
  } catch {
    return null;
  }
};

const toDocumentRow = (chunk: Chunk) => ({
  id: chunk.documentId,
  sourceId: chunk.sourceId,
  content: chunk.documentContent ?? "",
  metadata: sanitizeMetadata(chunk.metadata) as Record<string, unknown> | null,
});

const toChunkRow = (chunk: Chunk) => ({
  id: chunk.id,
  documentId: chunk.documentId,
  sourceId: chunk.sourceId,
  index: chunk.index,
  content: chunk.content,
  tokenCount: chunk.tokenCount,
  metadata: sanitizeMetadata(chunk.metadata) as Record<string, unknown> | null,
});

export const createDrizzleVectorStore = (db: DrizzleDb): VectorStore => ({
  upsert: async (chunkItems) => {
    if (chunkItems.length === 0) {
      throw new Error("upsert() requires at least one chunk");
    }

    return await db.transaction(async (tx) => {
      const head = chunkItems[0]!;
      const documentRow = toDocumentRow(head);

      // Upsert document by source_id (requires UNIQUE constraint on documents.source_id).
      // Returns the canonical document id (existing id on conflict, or new id on insert).
      // Using raw SQL because Drizzle's onConflictDoUpdate requires schema-level unique definition.
      const docResult = await tx.execute<{ id: string }>(
        sql`
          insert into ${documents} (id, source_id, content, metadata)
          values (${documentRow.id}::uuid, ${documentRow.sourceId}, ${documentRow.content}, ${JSON.stringify(documentRow.metadata)}::jsonb)
          on conflict (source_id) do update set
            content = excluded.content,
            metadata = excluded.metadata
          returning id
        `
      );

      const rows = Array.isArray(docResult)
        ? (docResult as Array<{ id: string }>)
        : ((docResult as { rows?: Array<{ id: string }> }).rows ?? []);

      const canonicalDocumentId = rows[0]?.id;
      if (!canonicalDocumentId) {
        throw new Error("Failed to upsert document: no id returned");
      }

      // Delete all existing chunks for this document (they will be replaced).
      // Cascades to embeddings via FK constraint.
      await tx.delete(chunks).where(eq(chunks.documentId, canonicalDocumentId));

      // Insert new chunks and embeddings.
      for (const chunk of chunkItems) {
        const chunkRow = toChunkRow(chunk);

        await tx.insert(chunks).values({
          ...chunkRow,
          documentId: canonicalDocumentId,
        });

        if (!chunk.embedding) {
          continue;
        }

        await tx.insert(embeddings).values({
          chunkId: chunk.id,
          embedding: chunk.embedding,
          embeddingDimension: chunk.embedding.length,
        });
      }

      return { documentId: canonicalDocumentId };
    });
  },

  query: async ({ embedding, topK, scope = {} }) => {
    const filters: SQL[] = [];

    if (scope.sourceId) {
      // Interpret scope.sourceId as a prefix so callers can namespace content
      // (e.g. `tenant:acme:`) without needing separate tables.
      filters.push(sql`c.source_id like ${scope.sourceId + "%"}`);
    }

    const whereClause =
      filters.length > 0 ? sql`where ${sql.join(filters, sql` and `)}` : sql``;

    const vectorLiteral = `[${embedding.join(",")}]`;

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
    );

    const rows: QueryRow[] = Array.isArray(result)
      ? (result as QueryRow[])
      : ((result as { rows?: QueryRow[] }).rows ?? []);

    return rows.map((row) => ({
      id: String(row.id),
      documentId: String(row.document_id),
      sourceId: String(row.source_id),
      index: Number(row.idx),
      content: String(row.content),
      tokenCount: Number(row.token_count),
      metadata: (row.metadata ?? {}) as Chunk["metadata"],
      score: Number(row.score),
    }));
  },

  delete: async (input) => {
    if (input.sourceId !== undefined) {
      await db.delete(documents).where(eq(documents.sourceId, input.sourceId));
      return;
    }

    await db
      .delete(documents)
      .where(like(documents.sourceId, input.sourceIdPrefix + "%"));
  },
});

