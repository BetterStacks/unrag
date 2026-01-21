# Store Adapters

Unrag stores vectors in PostgreSQL using the pgvector extension. Three adapters are available—choose based on your existing ORM.

## Requirements

All adapters require:
1. PostgreSQL database with pgvector extension enabled
2. Database schema created (documents, chunks, embeddings tables)
3. `DATABASE_URL` environment variable

## The Three Adapters

| Adapter | Best For | Dependencies |
|---------|----------|--------------|
| **Drizzle** | Projects using Drizzle ORM | `drizzle-orm`, `drizzle-kit`, `pg` |
| **Prisma** | Projects using Prisma | `@prisma/client` |
| **Raw SQL** | No ORM, minimal deps | `pg` |

All adapters:
- Implement the same `VectorStore` interface
- Produce the same database schema
- Are functionally equivalent
- Can be switched without data migration

## Drizzle Adapter (Recommended)

Type-safe database access with Drizzle ORM.

### Setup

```bash
unrag init --store drizzle
```

### Configuration

```ts
// lib/unrag/store/index.ts (generated)
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createDrizzleVectorStore } from "./drizzle-store";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export const store = createDrizzleVectorStore(db);
```

### Schema

The Drizzle adapter provides typed schema:

```ts
// lib/unrag/store/schema.ts (generated)
import { pgTable, text, integer, vector, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  content: text("content"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  sourceIdIdx: uniqueIndex("documents_source_id_idx").on(table.sourceId),
}));

export const chunks = pgTable("chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  content: text("content"),
  tokenCount: integer("token_count").notNull(),
  metadata: text("metadata"),
}, (table) => ({
  documentIdx: index("chunks_document_id_idx").on(table.documentId),
}));

export const embeddings = pgTable("embeddings", {
  id: text("id").primaryKey(),
  chunkId: text("chunk_id").notNull().references(() => chunks.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 1536 }),
}, (table) => ({
  chunkIdx: uniqueIndex("embeddings_chunk_id_idx").on(table.chunkId),
  embeddingIdx: index("embeddings_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
}));
```

### Migrations

Use Drizzle Kit:

```bash
# Generate migration
bunx drizzle-kit generate

# Run migration
bunx drizzle-kit migrate
```

---

## Prisma Adapter

Uses Prisma's connection management with raw SQL for vector operations.

### Setup

```bash
unrag init --store prisma
```

### Configuration

```ts
// lib/unrag/store/index.ts (generated)
import { PrismaClient } from "@prisma/client";
import { createPrismaVectorStore } from "./prisma-store";

const prisma = new PrismaClient();

export const store = createPrismaVectorStore(prisma);
```

### Schema

Since Prisma doesn't natively support pgvector, use raw SQL in migrations:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Note: Vector columns are created via raw SQL migration
```

Create migration manually:

```sql
-- migrations/0001_init_unrag.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  content TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  content TEXT,
  token_count INTEGER NOT NULL,
  metadata TEXT
);

CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL UNIQUE REFERENCES chunks(id) ON DELETE CASCADE,
  embedding vector(1536)
);

CREATE INDEX chunks_document_id_idx ON chunks(document_id);
CREATE INDEX embeddings_embedding_idx ON embeddings USING hnsw (embedding vector_cosine_ops);
```

Run with Prisma:

```bash
bunx prisma db push
```

---

## Raw SQL Adapter

Direct pg driver for minimal dependencies.

### Setup

```bash
unrag init --store raw-sql
```

### Configuration

```ts
// lib/unrag/store/index.ts (generated)
import { Pool } from "pg";
import { createRawSqlVectorStore } from "./raw-sql-store";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const store = createRawSqlVectorStore(pool);
```

### Schema

Create tables manually:

```sql
-- Create extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks table
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  content TEXT,
  token_count INTEGER NOT NULL,
  metadata JSONB
);

-- Embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL UNIQUE REFERENCES chunks(id) ON DELETE CASCADE,
  embedding vector(1536)
);

-- Indexes
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON embeddings
  USING hnsw (embedding vector_cosine_ops);
```

---

## Custom Store Adapter

Implement the `VectorStore` interface for other databases:

```ts
import type { VectorStore, Chunk, DeleteInput, RetrieveScope } from "./types";

export function createCustomStore(client: YourDbClient): VectorStore {
  return {
    async upsert(chunks: Chunk[]): Promise<{ documentId: string }> {
      // 1. Extract sourceId from first chunk
      const sourceId = chunks[0].sourceId;

      // 2. Delete existing chunks for this sourceId
      // 3. Insert document record
      // 4. Insert chunk records
      // 5. Insert embedding records

      return { documentId: chunks[0].documentId };
    },

    async query(params: {
      embedding: number[];
      topK: number;
      scope?: RetrieveScope;
    }): Promise<Array<Chunk & { score: number }>> {
      // 1. Run similarity search
      // 2. Apply scope filter if provided
      // 3. Return top K chunks with scores

      return results;
    },

    async delete(input: DeleteInput): Promise<void> {
      if (input.sourceId) {
        // Delete by exact sourceId
      } else if (input.sourceIdPrefix) {
        // Delete by sourceId prefix
      }
    },
  };
}
```

### VectorStore Interface

```ts
type VectorStore = {
  upsert: (chunks: Chunk[]) => Promise<{ documentId: string }>;
  query: (params: {
    embedding: number[];
    topK: number;
    scope?: RetrieveScope;
  }) => Promise<Array<Chunk & { score: number }>>;
  delete: (input: DeleteInput) => Promise<void>;
};
```

---

## Database Setup

### Enable pgvector

```sql
-- Requires superuser or extension creation privilege
CREATE EXTENSION IF NOT EXISTS vector;
```

### Verify Setup

```sql
-- Check extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check tables
\dt documents
\dt chunks
\dt embeddings

-- Check indexes
\di embeddings_embedding_idx
```

### Index Tuning

For large datasets, tune the HNSW index:

```sql
-- Drop and recreate with tuned parameters
DROP INDEX IF EXISTS embeddings_embedding_idx;

CREATE INDEX embeddings_embedding_idx ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- For IVFFlat (alternative, faster builds)
CREATE INDEX embeddings_embedding_ivfflat_idx ON embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**HNSW Parameters:**
- `m` - Number of connections per layer (default: 16)
- `ef_construction` - Size of candidate list during build (default: 64)

**IVFFlat Parameters:**
- `lists` - Number of clusters (rule of thumb: rows / 1000)

---

## Wiring the Store

In `unrag.config.ts`:

```ts
import { defineUnragConfig } from "./lib/unrag/core";

// Import your store
import { store } from "./lib/unrag/store";

export const unrag = defineUnragConfig({
  embedding: { /* ... */ },
  // Store is passed at runtime via createEngine
});

// In your application code
import { unrag } from "./unrag.config";
import { store } from "./lib/unrag/store";

const engine = unrag.createEngine({ store });
```

Or with `createUnragEngine`:

```ts
// lib/unrag/config.ts (generated)
import { unrag } from "../../unrag.config";
import { store } from "./store";

export const createUnragEngine = () => unrag.createEngine({ store });
```
