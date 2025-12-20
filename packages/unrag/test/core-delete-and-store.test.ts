import { describe, expect, test } from "bun:test";
import { deleteDocuments } from "../registry/core/delete";
import { createRawSqlVectorStore } from "../registry/store/raw-sql-postgres-pgvector/store";

describe("core deleteDocuments", () => {
  test("throws when neither sourceId nor sourceIdPrefix is provided", async () => {
    const calls: any[] = [];
    const config = {
      store: { delete: async (input: unknown) => calls.push(input) },
    } as any;

    await expect(deleteDocuments(config, {} as any)).rejects.toThrow(
      'Provide exactly one of "sourceId" or "sourceIdPrefix".'
    );
    expect(calls.length).toBe(0);
  });

  test("throws when both sourceId and sourceIdPrefix are provided", async () => {
    const calls: any[] = [];
    const config = {
      store: { delete: async (input: unknown) => calls.push(input) },
    } as any;

    await expect(
      deleteDocuments(config, { sourceId: "a", sourceIdPrefix: "b" } as any)
    ).rejects.toThrow('Provide exactly one of "sourceId" or "sourceIdPrefix".');
    expect(calls.length).toBe(0);
  });

  test("delegates to store.delete for exact sourceId", async () => {
    const calls: any[] = [];
    const config = {
      store: { delete: async (input: unknown) => calls.push(input) },
    } as any;

    await deleteDocuments(config, { sourceId: "docs:one" });
    expect(calls).toEqual([{ sourceId: "docs:one" }]);
  });

  test("delegates to store.delete for prefix deletes", async () => {
    const calls: any[] = [];
    const config = {
      store: { delete: async (input: unknown) => calls.push(input) },
    } as any;

    await deleteDocuments(config, { sourceIdPrefix: "tenant:acme:" });
    expect(calls).toEqual([{ sourceIdPrefix: "tenant:acme:" }]);
  });
});

describe("raw-sql store adapter", () => {
  test("upsert deletes by exact sourceId before inserting", async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];

    const client = {
      query: async (text: string, values?: unknown[]) => {
        queries.push({ text, values });
        return { rows: [] };
      },
      release: () => {},
    };

    const pool = {
      connect: async () => client,
    } as any;

    const store = createRawSqlVectorStore(pool);

    await store.upsert([
      {
        id: crypto.randomUUID(),
        documentId: crypto.randomUUID(),
        sourceId: "docs:example",
        index: 0,
        content: "hello world",
        tokenCount: 2,
        metadata: {},
        embedding: [0.1, 0.2, 0.3],
        documentContent: "hello world",
      },
    ]);

    const normalized = queries.map((q) => q.text.trim().toLowerCase());

    const beginIdx = normalized.findIndex((t) => t === "begin");
    const deleteIdx = normalized.findIndex((t) =>
      t.includes("delete from documents where source_id = $1")
    );
    const insertDocIdx = normalized.findIndex((t) =>
      t.includes("insert into documents")
    );

    expect(beginIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeGreaterThan(beginIdx);
    expect(insertDocIdx).toBeGreaterThan(deleteIdx);

    // Ensure the delete uses the exact sourceId as the parameter.
    expect(queries[deleteIdx]?.values).toEqual(["docs:example"]);
  });

  test("delete({sourceIdPrefix}) uses prefix matching", async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];

    const client = {
      query: async (text: string, values?: unknown[]) => {
        queries.push({ text, values });
        return { rows: [] };
      },
      release: () => {},
    };

    const pool = {
      connect: async () => client,
    } as any;

    const store = createRawSqlVectorStore(pool);
    await store.delete({ sourceIdPrefix: "tenant:acme:" });

    const normalized = queries.map((q) => q.text.trim().toLowerCase());
    const likeIdx = normalized.findIndex((t) =>
      t.includes("delete from documents where source_id like $1")
    );
    expect(likeIdx).toBeGreaterThanOrEqual(0);
    expect(queries[likeIdx]?.values).toEqual(["tenant:acme:%"]);
  });
});


