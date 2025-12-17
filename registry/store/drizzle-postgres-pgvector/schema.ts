import {
  customType,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const vector = (name: string, dimensions?: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType: () => (dimensions ? `vector(${dimensions})` : "vector"),
    toDriver: (value) => {
      const content = Array.isArray(value) ? value : [];
      return `[${content.join(",")}]`;
    },
  })(name);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: false }).defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  sourceId: text("source_id").notNull(),
  index: integer("idx").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: false }).defaultNow(),
});

export const embeddings = pgTable(
  "embeddings",
  {
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => chunks.id, { onDelete: "cascade" }),
    embedding: vector("embedding"),
    embeddingDimension: integer("embedding_dimension"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: false }).defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chunkId] }),
  })
);

export const schema = {
  documents,
  chunks,
  embeddings,
};


