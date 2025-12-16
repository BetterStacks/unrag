import { drizzle } from "drizzle-orm/bun-sql";
import { sql } from "drizzle-orm";

const main = async () => {
  if (!Bun.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  const db = drizzle({ client: Bun.sql });

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
  console.log("pgvector extension ensured.");
};

main().catch((err) => {
  console.error("Failed to enable pgvector:", err);
  process.exit(1);
});
