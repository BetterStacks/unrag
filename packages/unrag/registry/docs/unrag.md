# Unrag setup

Unrag installs a small RAG module into your codebase with:
- chunk → embed → store on ingest
- embed → vector similarity search on retrieve

## Environment variables

Add these to your environment:
- `DATABASE_URL` (Postgres connection string)
- (Embedding) set the environment variables required by your selected provider.

If you used the default provider (Vercel AI Gateway):
- `AI_GATEWAY_API_KEY`
- Optional: `AI_GATEWAY_MODEL` (defaults to `openai/text-embedding-3-small`)

If you picked a different provider (OpenAI / Google / Voyage / etc.), see the installed provider docs under your Unrag docs site (`/docs/providers/*`).

## Database requirements

Enable pgvector:

```sql
create extension if not exists vector;
```

## Schema (Postgres)

You are responsible for migrations. Create these tables:

```sql
create table documents (
  id uuid primary key,
  source_id text not null unique,
  content text not null,
  metadata jsonb,
  created_at timestamp default now()
);

create table chunks (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  source_id text not null,
  idx integer not null,
  content text not null,
  token_count integer not null,
  metadata jsonb,
  created_at timestamp default now()
);

create table embeddings (
  chunk_id uuid primary key references chunks(id) on delete cascade,
  embedding vector,
  embedding_dimension integer,
  created_at timestamp default now()
);
```

Notes:
- `documents.content` stores the full original document text (used for debugging/re-chunking).
- `chunks.content` stores the chunk text returned by retrieval (`chunk.content`).
- You can disable persisting either/both via the engine config (`storage.storeDocumentContent` / `storage.storeChunkContent`). The schema still requires `text not null`, so Unrag stores empty strings when disabled.

Recommended indexes:

```sql
create index if not exists chunks_source_id_idx on chunks(source_id);
create index if not exists documents_source_id_idx on documents(source_id);
create index if not exists embeddings_hnsw_idx
on embeddings using hnsw (embedding vector_cosine_ops);
```

<!-- __UNRAG_ADAPTER_NOTES__ -->

## Usage (Next.js)

- Use the engine only on the server (Route Handlers / Server Actions).
- Prefer a singleton DB client/pool pattern to avoid hot-reload connection storms.
- If Unrag detected Next.js, it added:
  - `@unrag/*` path alias to your installed module directory
  - `@unrag/config` path alias to `./unrag.config.ts`

Example route handler:

```ts
import { createUnragEngine } from "@unrag/config";

export async function GET() {
  const engine = createUnragEngine();
  const result = await engine.retrieve({ query: "hello", topK: 5 });
  return Response.json(result);
}
```


