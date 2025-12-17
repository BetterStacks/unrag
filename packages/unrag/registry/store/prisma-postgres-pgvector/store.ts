import type { Chunk, VectorStore } from "../../core/types";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

const sanitizeMetadata = (metadata: unknown) => {
  if (metadata === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(metadata));
  } catch {
    return null;
  }
};

const toVectorLiteral = (embedding: number[]) => `[${embedding.join(",")}]`;

export const createPrismaVectorStore = (prisma: PrismaClient): VectorStore => ({
  upsert: async (chunkItems) => {
    if (chunkItems.length === 0) return;

    const head = chunkItems[0];
    const documentMetadata = sanitizeMetadata(head.metadata);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          insert into documents (id, source_id, content, metadata)
          values (${head.documentId}::uuid, ${head.sourceId}, ${head.documentContent ?? ""}, ${
            JSON.stringify(documentMetadata)
          }::jsonb)
          on conflict (id) do update set
            source_id = excluded.source_id,
            content = excluded.content,
            metadata = excluded.metadata
        `
      );

      for (const chunk of chunkItems) {
        const chunkMetadata = sanitizeMetadata(chunk.metadata);

        await tx.$executeRaw(
          Prisma.sql`
            insert into chunks (id, document_id, source_id, idx, content, token_count, metadata)
            values (
              ${chunk.id}::uuid,
              ${chunk.documentId}::uuid,
              ${chunk.sourceId},
              ${chunk.index},
              ${chunk.content},
              ${chunk.tokenCount},
              ${JSON.stringify(chunkMetadata)}::jsonb
            )
            on conflict (id) do update set
              document_id = excluded.document_id,
              source_id = excluded.source_id,
              idx = excluded.idx,
              content = excluded.content,
              token_count = excluded.token_count,
              metadata = excluded.metadata
          `
        );

        if (!chunk.embedding) continue;
        const embeddingLiteral = toVectorLiteral(chunk.embedding);

        await tx.$executeRaw(
          Prisma.sql`
            insert into embeddings (chunk_id, embedding, embedding_dimension)
            values (${chunk.id}::uuid, ${embeddingLiteral}::vector, ${
            chunk.embedding.length
          })
            on conflict (chunk_id) do update set
              embedding = excluded.embedding,
              embedding_dimension = excluded.embedding_dimension
          `
        );
      }
    });
  },

  query: async ({ embedding, topK, scope = {} }) => {
    const vectorLiteral = toVectorLiteral(embedding);

    const conditions = [];
    if (scope.sourceId) {
      conditions.push(Prisma.sql`c.source_id = ${scope.sourceId}`);
    }

    const whereSql =
      conditions.length > 0
        ? Prisma.sql`where ${Prisma.join(conditions, Prisma.sql` and `)}`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        document_id: string;
        source_id: string;
        idx: number;
        content: string;
        token_count: number;
        metadata: unknown;
        score: number;
      }>
    >(
      Prisma.sql`
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
    );

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
});


