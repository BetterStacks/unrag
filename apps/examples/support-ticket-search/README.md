# Support Ticket Search

A semantic search example built with [Unrag](https://github.com/BetterStacks/unrag) demonstrating how to ingest support tickets and search them using natural language queries.

## Features

- Semantic search across ticket titles, descriptions, and resolutions
- Automatic chunking and embedding of support tickets
- Optional reranking with Cohere for improved relevance
- Rate limiting with Upstash Redis (optional)
- Real-time search interface with animations

## Quick Start

### Clone This Example

You can clone just this example without the full monorepo using degit:

```bash
npx degit BetterStacks/unrag/apps/examples/support-ticket-search support-ticket-search
cd support-ticket-search
```

Alternatively, using git sparse checkout:

```bash
git clone --filter=blob:none --sparse https://github.com/BetterStacks/unrag.git
cd unrag
git sparse-checkout set apps/examples/support-ticket-search
cd apps/examples/support-ticket-search
```

## Prerequisites

- Node.js 18+ or Bun
- PostgreSQL 13+ with [pgvector](https://github.com/pgvector/pgvector) extension
- An embedding provider API key (OpenAI, Cohere, or AI Gateway)

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required:
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/mydb`)
- `AI_GATEWAY_API_KEY` - API key for embeddings
- `NEXT_PUBLIC_SELF_URL` - The base URL for the application (e.g. `http://localhost:3000`)

Optional:
- `COHERE_API_KEY` - For reranking (improves search relevance)
- `UPSTASH_REDIS_REST_URL` - For rate limiting
- `UPSTASH_REDIS_REST_TOKEN` - For rate limiting

### 3. Setup database

Ensure the pgvector extension is enabled in your PostgreSQL database:

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
├── unrag.config.ts       # Unrag configuration
└── package.json
```

## API Endpoints

### GET /api/tickets

List all support tickets from the database.

### GET /api/search?q=query

Semantic search for tickets matching the query.

Query parameters:
- `q` (required) - Search query
- `topK` (optional) - Number of results (default: 10)
- `rerank` (optional) - Enable Cohere reranking (default: false)

### POST /api/ingest

Ingest all tickets into the vector store.

## Configuration

The `unrag.config.ts` file controls:

- **Chunking**: `chunkSize` (200) and `chunkOverlap` (40)
- **Retrieval**: `topK` (8) results by default
- **Embedding**: Uses `openai/text-embedding-3-small` via AI Gateway
- **Reranking**: Optional Cohere reranker for improved relevance
- **Storage**: Stores both chunk and document content

## Tech Stack

- **Framework**: Next.js 16
- **Database**: PostgreSQL + pgvector
- **ORM**: Drizzle
- **Embeddings**: OpenAI text-embedding-3-small
- **Reranking**: Cohere rerank-v3.5 (optional)
- **Rate Limiting**: Upstash Redis (optional)
- **RAG Engine**: Unrag
- **UI**: shadcn/ui + Tailwind CSS

## Rate Limiting (Optional)

Rate limiting is disabled by default. To enable it:

1. Create a Redis database at [upstash.com](https://upstash.com) or use Vercel KV
2. Add environment variables:

```env
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

Rate limits when enabled:

| Route | Limit | Reason |
|-------|-------|--------|
| `/api/search` | 10 req/min | Expensive (embeddings + rerank) |
| `/api/tickets` | 30 req/min | Basic DB query |
| `/api/ingest` | 30 req/min | Resource intensive |

To remove rate limiting entirely, delete `proxy.ts`.

## Customization

### Using Your Own Data

Replace the mock data in `lib/mock-data/tickets.ts` with your own support tickets, or modify `scripts/ingest.ts` to fetch from your data source.

### Changing the Embedding Provider

Edit `unrag.config.ts` to use a different provider:

```typescript
embedding: {
  provider: "openai", // or "cohere", "ai", etc.
  config: {
    model: "text-embedding-3-small",
    // apiKey: process.env.OPENAI_API_KEY,
  },
},
```

## Learn More

- [Unrag Documentation](https://unrag.dev)
- [Unrag GitHub](https://github.com/BetterStacks/unrag)
- [Drizzle ORM](https://orm.drizzle.team)
- [pgvector](https://github.com/pgvector/pgvector)
