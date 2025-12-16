import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL || (typeof Bun !== "undefined" ? Bun.env.DATABASE_URL : "");

export default defineConfig({
  schema: "./src/store/drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl || "",
  },
});
