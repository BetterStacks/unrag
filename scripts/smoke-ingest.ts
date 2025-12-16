import { drizzle } from "drizzle-orm/bun-sql";
import { sql } from "drizzle-orm";
import { createContextEngine, defineConfig } from "../src/context-engine";
import { createAIEmbeddingProvider } from "../src/embedding";
import { createDrizzleVectorStore, drizzleSchema } from "../src/store/drizzle";

const db = drizzle({
  client: Bun.sql,
  schema: drizzleSchema,
});

const run = async () => {
  const embedding = createAIEmbeddingProvider({
    model: "openai/text-embedding-3-small",
    timeoutMs: 15_000,
  });

  const contextEngine = createContextEngine(
    defineConfig({
      embedding,
      store: createDrizzleVectorStore(db),
      defaults: {
        chunkSize: 64,
        chunkOverlap: 16,
      },
    }),
  );

  const result = await contextEngine.ingest({
    sourceId: "smoke-test",
    content:
      "Bun + Drizzle smoke ingest. This should chunk, embed, and persist into Postgres with pgvector.",
    metadata: { orgId: "demo-org", projectId: "demo-project" },
  });

  console.log("Ingest completed:", result);
};

run()
  .then(() => {
    console.log("Smoke ingest succeeded.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Smoke ingest failed:", err);
    process.exit(1);
  });
