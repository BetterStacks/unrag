import type { Chunk, VectorStore } from "../../core/types";
import type { Pool, PoolClient } from "pg";

const sanitizeMetadata = (metadata: unknown) => {
  if (metadata === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(metadata));
  } catch {
    return null;
  }
};

const toVectorLiteral = (embedding: number[]) => `[${embedding.join(",")}]`;

const withTx = async <T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
};

export const createRawSqlVectorStore = (pool: Pool): VectorStore => ({
  upsert: async (chunkItems) => {
    if (chunkItems.length === 0) return;

    await withTx(pool, async (client) => {
      const head = chunkItems[0]!;
      const documentMetadata = sanitizeMetadata(head.metadata);

      // Replace-by-sourceId: delete any previously stored document(s) for this logical id.
      // Cascades to chunks and embeddings.
      await client.query(`delete from documents where source_id = $1`, [
        head.sourceId,
      ]);

      await client.query(
        `
        insert into documents (id, source_id, content, metadata)
        values ($1, $2, $3, $4::jsonb)
        on conflict (id) do update set
          source_id = excluded.source_id,
          content = excluded.content,
          metadata = excluded.metadata
        `,
        [
          head.documentId,
          head.sourceId,
          head.documentContent ?? "",
          JSON.stringify(documentMetadata),
        ]
      );

      for (const chunk of chunkItems) {
        const chunkMetadata = sanitizeMetadata(chunk.metadata);

        await client.query(
          `
          insert into chunks (id, document_id, source_id, idx, content, token_count, metadata)
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
          on conflict (id) do update set
            document_id = excluded.document_id,
            source_id = excluded.source_id,
            idx = excluded.idx,
            content = excluded.content,
            token_count = excluded.token_count,
            metadata = excluded.metadata
          `,
          [
            chunk.id,
            chunk.documentId,
            chunk.sourceId,
            chunk.index,
            chunk.content,
            chunk.tokenCount,
            JSON.stringify(chunkMetadata),
          ]
        );

        if (!chunk.embedding) continue;

        const embeddingLiteral = toVectorLiteral(chunk.embedding);
        await client.query(
          `
          insert into embeddings (chunk_id, embedding, embedding_dimension)
          values ($1, $2::vector, $3)
          on conflict (chunk_id) do update set
            embedding = excluded.embedding,
            embedding_dimension = excluded.embedding_dimension
          `,
          [chunk.id, embeddingLiteral, chunk.embedding.length]
        );
      }
    });
  },

  query: async ({ embedding, topK, scope = {} }) => {
    const vectorLiteral = toVectorLiteral(embedding);

    const values: unknown[] = [vectorLiteral, topK];
    const where: string[] = [];

    if (scope.sourceId) {
      // Interpret scope.sourceId as a prefix so callers can namespace content
      // (e.g. `tenant:acme:`) without needing separate tables.
      values.push(scope.sourceId + "%");
      where.push(`c.source_id like $${values.length}`);
    }

    const whereSql = where.length ? `where ${where.join(" and ")}` : "";

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
    );

    return res.rows.map((row) => ({
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
    await withTx(pool, async (client) => {
      if ("sourceId" in input) {
        await client.query(`delete from documents where source_id = $1`, [
          input.sourceId,
        ]);
        return;
      }

      await client.query(`delete from documents where source_id like $1`, [
        input.sourceIdPrefix + "%",
      ]);
    });
  },
});


