import { drizzle } from "drizzle-orm/bun-sql";
import { createContextEngine, defineConfig } from "./src/context-engine";
import { createAIEmbeddingProvider } from "./src/embedding";
import { createDrizzleVectorStore, drizzleSchema } from "./src/store/drizzle";

export const createContextEngineWithDrizzle = () => {
  if (!Bun.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create the context engine");
  }

  const db = drizzle({ client: Bun.sql, schema: drizzleSchema });

  const embedding = createAIEmbeddingProvider({
    model: "openai/text-embedding-3-small",
    timeoutMs: 15_000,
  });

  return createContextEngine(
    defineConfig({
      embedding,
      store: createDrizzleVectorStore(db),
      defaults: {
        chunkSize: 200,
        chunkOverlap: 40,
      },
    })
  );
};
