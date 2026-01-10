# Support Ticket Search

A semantic search example built with [unrag](https://github.com/betterstacks/unrag) - demonstrating how to ingest support tickets from a mock API and search them using natural language queries.

## Features

- Ingest support tickets with automatic chunking and embedding
- Semantic search across ticket titles, descriptions, and resolutions
- Optional reranking with Cohere for improved relevance
- Rate limiting with Upstash Redis (optional, easy to remove)
- Real-time search with blur reveal animations

## Prerequisites

- PostgreSQL 13+ with [pgvector](https://github.com/pgvector/pgvector) extension
- OpenAI API key (for embeddings)

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `AI_GATEWAY_API_KEY` - AI Gateway API key for embeddings

### 3. Setup database

Ensure pgvector extension is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Push the schema to your database:

```bash
bun run db:push
```

### 4. Seed and ingest data

In ideal case, you would use your own data to ingest into the vector store. For this example, we are using mock data.

Seed the database with mock support tickets:

```bash
bun run seed
```

Ingest tickets into the vector store:

```bash
bun run ingest
```

### 5. Start the development server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to use the search interface.

## Project Structure

```
support-ticket-search/
├── app/
│   ├── api/
│   │   ├── tickets/      # GET /api/tickets - list tickets
│   │   ├── ingest/       # POST /api/ingest - ingest tickets
│   │   └── search/       # GET /api/search - semantic search
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── search-box.tsx    # Search input with debounce
│   ├── ticket-card.tsx   # Individual ticket display
│   └── ticket-list.tsx   # Results list
├── db/
│   ├── schema.ts         # Drizzle schema (unrag + tickets)
│   └── index.ts          # Database client
├── lib/
│   ├── mock-data/
│   │   └── tickets.ts    # 50+ realistic support tickets
│   └── unrag/            # Vendored unrag files
├── scripts/
│   ├── seed.ts           # Seed database with mock data
│   └── ingest.ts         # Ingest tickets into vector store
├── drizzle.config.ts
├── unrag.config.ts
└── package.json
```

## API Endpoints

### `GET /api/tickets`
List all support tickets from the database.

### `GET /api/search?q=<query>`
Semantic search for tickets matching the query.

Query parameters:
- `q` (required) - Search query
- `topK` (optional) - Number of results (default: 10)
- `rerank` (optional) - Enable Cohere reranking for better relevance (default: false)

### `POST /api/ingest`
Ingest all tickets into the vector store.

## Tech Stack

- **Framework**: Next.js 16
- **Database**: PostgreSQL + pgvector
- **ORM**: Drizzle
- **Embeddings**: OpenAI text-embedding-3-small
- **Reranking**: Cohere rerank-v3.5 (optional)
- **Rate Limiting**: Upstash Redis (optional)
- **RAG Engine**: unrag
- **UI**: shadcn/ui + Tailwind CSS

## Rate Limiting (Optional)

This example includes optional rate limiting using Upstash Redis. It's disabled by default and only activates if you provide the environment variables.

### Setup with Upstash

1. Create a free account at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy the REST URL and token to your `.env`:

```env
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### Setup with Vercel KV

1. Go to Vercel Dashboard → Storage → Create KV Database
2. Connect it to your project
3. Environment variables are automatically added

### Rate Limits

| Route | Limit | Reason |
|-------|-------|--------|
| `/api/search` | 10 req/min | Expensive (embeddings + rerank) |
| `/api/tickets` | 30 req/min | Basic DB query |
| `/api/ingest` | 30 req/min | Resource intensive |

### Removing Rate Limiting

To remove rate limiting entirely, simply delete `middleware.ts`. The app works without it.

## Learn More

- [unrag Documentation](https://unrag.dev)
- [Drizzle ORM](https://orm.drizzle.team)
- [pgvector](https://github.com/pgvector/pgvector)
