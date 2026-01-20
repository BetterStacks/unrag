# Common Patterns and Recipes

Practical patterns for building with Unrag.

## Search Endpoint

### Basic Next.js Route Handler

```ts
// app/api/search/route.ts
import { createUnragEngine } from "@unrag/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  if (!query.trim()) {
    return Response.json({ error: "Missing query" }, { status: 400 });
  }

  const engine = createUnragEngine();
  const result = await engine.retrieve({ query, topK: 8 });

  return Response.json({
    results: result.chunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      source: chunk.sourceId,
      score: chunk.score,
      metadata: chunk.metadata,
    })),
  });
}
```

### With Reranking

```ts
// app/api/search/route.ts
import { createUnragEngine } from "@unrag/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  if (!query.trim()) {
    return Response.json({ error: "Missing query" }, { status: 400 });
  }

  const engine = createUnragEngine();

  // Retrieve more candidates
  const retrieved = await engine.retrieve({ query, topK: 30 });

  // Rerank to top results
  const reranked = await engine.rerank({
    query,
    candidates: retrieved.chunks,
    topK: 8,
    onMissingReranker: "skip",  // Graceful fallback
  });

  return Response.json({
    results: reranked.chunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      source: chunk.sourceId,
      score: chunk.score,
    })),
    meta: {
      reranked: reranked.meta.rerankerName !== "none",
      timings: {
        retrieveMs: retrieved.durations.totalMs,
        rerankMs: reranked.durations.rerankMs,
      },
    },
  });
}
```

### With Input Validation

```ts
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().min(2).max(500),
  collection: z.string().optional(),
  topK: z.coerce.number().min(1).max(50).default(8),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = searchSchema.safeParse({
    q: searchParams.get("q"),
    collection: searchParams.get("collection"),
    topK: searchParams.get("topK"),
  });

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { q: query, collection, topK } = parsed.data;
  const engine = createUnragEngine();

  const result = await engine.retrieve({
    query,
    topK,
    scope: collection ? { sourceId: collection } : undefined,
  });

  return Response.json({ results: result.chunks });
}
```

---

## Multi-Tenant Scoping

Use sourceId prefixes to isolate tenant data.

### Ingestion

```ts
async function ingestForTenant(tenantId: string, doc: Document) {
  const engine = createUnragEngine();

  await engine.ingest({
    sourceId: `tenant:${tenantId}:${doc.id}`,
    content: doc.content,
    metadata: {
      tenantId,
      title: doc.title,
      createdAt: doc.createdAt,
    },
  });
}
```

### Retrieval

```ts
async function searchForTenant(tenantId: string, query: string) {
  const engine = createUnragEngine();

  const result = await engine.retrieve({
    query,
    topK: 10,
    scope: { sourceId: `tenant:${tenantId}:` },
  });

  return result.chunks;
}
```

### Deletion

```ts
async function deleteAllTenantData(tenantId: string) {
  const engine = createUnragEngine();

  await engine.delete({
    sourceIdPrefix: `tenant:${tenantId}:`,
  });
}
```

### Hierarchical Prefixes

```ts
// Organization → Workspace → Document
const sourceId = `org:${orgId}:ws:${workspaceId}:doc:${docId}`;

// Search within workspace
scope: { sourceId: `org:${orgId}:ws:${workspaceId}:` }

// Search across organization
scope: { sourceId: `org:${orgId}:` }
```

---

## Chat Integration

Use retrieved chunks as context for LLM responses.

### Basic RAG Chat

```ts
import { createUnragEngine } from "@unrag/config";
import { generateText } from "ai";

async function chat(userMessage: string) {
  const engine = createUnragEngine();

  // Retrieve relevant context
  const retrieved = await engine.retrieve({
    query: userMessage,
    topK: 5,
  });

  // Build context string
  const context = retrieved.chunks
    .map((chunk) => chunk.content)
    .join("\n\n---\n\n");

  // Generate response with context
  const response = await generateText({
    model: "openai/gpt-4o",
    messages: [
      {
        role: "system",
        content: `Answer based on the following context. If the answer isn't in the context, say so.

Context:
${context}`,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  return {
    answer: response.text,
    sources: retrieved.chunks.map((c) => ({
      sourceId: c.sourceId,
      content: c.content.slice(0, 200) + "...",
    })),
  };
}
```

### With Reranking

```ts
async function chat(userMessage: string) {
  const engine = createUnragEngine();

  // Retrieve more candidates
  const retrieved = await engine.retrieve({
    query: userMessage,
    topK: 20,
  });

  // Rerank for best context
  const reranked = await engine.rerank({
    query: userMessage,
    candidates: retrieved.chunks,
    topK: 5,
    onMissingReranker: "skip",
  });

  const context = reranked.chunks
    .map((chunk) => chunk.content)
    .join("\n\n---\n\n");

  // ... generate response
}
```

### Streaming Response

```ts
import { streamText } from "ai";

export async function POST(request: Request) {
  const { message } = await request.json();
  const engine = createUnragEngine();

  const retrieved = await engine.retrieve({ query: message, topK: 5 });
  const context = retrieved.chunks.map((c) => c.content).join("\n\n");

  const result = streamText({
    model: "openai/gpt-4o",
    messages: [
      { role: "system", content: `Context:\n${context}` },
      { role: "user", content: message },
    ],
  });

  return result.toDataStreamResponse();
}
```

---

## Ingestion Patterns

### Static Content (Build Time)

```ts
// scripts/ingest-docs.ts
import { createUnragEngine } from "@unrag/config";
import { glob } from "glob";
import { readFile } from "fs/promises";

async function ingestDocs() {
  const engine = createUnragEngine();
  const files = await glob("content/docs/**/*.md");

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const slug = file.replace("content/docs/", "").replace(".md", "");

    await engine.ingest({
      sourceId: `docs:${slug}`,
      content,
      metadata: { path: file, slug },
    });

    console.log(`Ingested: ${slug}`);
  }
}

ingestDocs();
```

Add to package.json:
```json
{
  "scripts": {
    "ingest:docs": "bun run scripts/ingest-docs.ts",
    "build": "bun run ingest:docs && next build"
  }
}
```

### User-Generated Content

```ts
// app/api/documents/route.ts
import { createUnragEngine } from "@unrag/config";

export async function POST(request: Request) {
  const { title, content } = await request.json();
  const userId = getUserId(request);  // From auth

  // Save to database
  const doc = await db.documents.create({
    data: { title, content, userId },
  });

  // Ingest for search
  const engine = createUnragEngine();
  await engine.ingest({
    sourceId: `user:${userId}:doc:${doc.id}`,
    content,
    metadata: { title, userId, docId: doc.id },
  });

  return Response.json({ id: doc.id });
}
```

### Periodic Sync (Cron)

```ts
// scripts/sync-external.ts
import { createUnragEngine } from "@unrag/config";
import { createNotionConnector } from "./lib/unrag/connectors/notion";

async function syncNotion() {
  const engine = createUnragEngine();
  const notion = createNotionConnector({
    auth: process.env.NOTION_TOKEN,
  });

  // Load checkpoint from previous sync
  const checkpoint = await loadCheckpoint("notion-sync");

  const stream = notion.syncDatabase({
    databaseId: process.env.NOTION_DATABASE_ID!,
    filter: checkpoint ? { last_edited_time: { after: checkpoint.lastSync } } : undefined,
  });

  const result = await engine.runConnectorStream({
    stream,
    checkpoint,
    onProgress: (e) => console.log(e.message),
  });

  // Save checkpoint for next sync
  await saveCheckpoint("notion-sync", result.checkpoint);

  console.log(`Synced ${result.ingestCount} documents`);
}
```

Trigger with cron:
```yaml
# .github/workflows/sync.yml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
```

### Re-ingestion (Full Refresh)

```ts
async function reindexAll() {
  const engine = createUnragEngine();

  // Delete all existing
  await engine.delete({ sourceIdPrefix: "docs:" });

  // Re-ingest everything
  const docs = await db.documents.findMany();

  for (const doc of docs) {
    await engine.ingest({
      sourceId: `docs:${doc.id}`,
      content: doc.content,
      metadata: { title: doc.title },
    });
  }
}
```

---

## Asset Processing Patterns

### PDF Knowledge Base

```ts
import { createUnragEngine } from "@unrag/config";

async function ingestPdf(pdfBuffer: Buffer, filename: string) {
  const engine = createUnragEngine();

  await engine.ingest({
    sourceId: `pdfs:${filename}`,
    content: "",  // Text extracted from PDF
    assets: [
      {
        assetId: "pdf-main",
        kind: "pdf",
        data: {
          kind: "bytes",
          bytes: new Uint8Array(pdfBuffer),
          mediaType: "application/pdf",
          filename,
        },
      },
    ],
  });
}
```

### Image Gallery with Captions

```ts
async function ingestImage(imageUrl: string, altText: string, id: string) {
  const engine = createUnragEngine();

  await engine.ingest({
    sourceId: `gallery:${id}`,
    content: altText,  // Use alt text as base content
    assets: [
      {
        assetId: "image-main",
        kind: "image",
        data: { kind: "url", url: imageUrl },
        text: altText,  // Provide known text
      },
    ],
    assetProcessing: {
      image: {
        captionLlm: { enabled: true },  // Generate additional captions
      },
    },
  });
}
```

### Dry-Run Before Expensive Processing

```ts
async function previewIngestion(doc: Document) {
  const engine = createUnragEngine();

  const plan = await engine.planIngest({
    sourceId: doc.id,
    content: doc.content,
    assets: doc.assets,
  });

  // Check what would be processed
  for (const asset of plan.assets) {
    if (asset.status === "will_process") {
      console.log(`${asset.assetId}: ${asset.extractors.join(", ")}`);
    } else {
      console.log(`${asset.assetId}: SKIP - ${asset.reason}`);
    }
  }

  // Confirm before actual ingestion
  if (await confirm("Proceed with ingestion?")) {
    await engine.ingest({
      sourceId: doc.id,
      content: doc.content,
      assets: doc.assets,
    });
  }
}
```

---

## Framework Integration

### Express

```ts
import express from "express";
import { createUnragEngine } from "@unrag/config";

const app = express();

app.get("/api/search", async (req, res) => {
  const query = req.query.q as string;

  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  const engine = createUnragEngine();
  const result = await engine.retrieve({ query, topK: 8 });

  res.json({ results: result.chunks });
});
```

### Hono

```ts
import { Hono } from "hono";
import { createUnragEngine } from "@unrag/config";

const app = new Hono();

app.get("/api/search", async (c) => {
  const query = c.req.query("q");

  if (!query) {
    return c.json({ error: "Missing query" }, 400);
  }

  const engine = createUnragEngine();
  const result = await engine.retrieve({ query, topK: 8 });

  return c.json({ results: result.chunks });
});
```

### Node Script

```ts
// scripts/query.ts
import { createUnragEngine } from "@unrag/config";

const query = process.argv[2];

if (!query) {
  console.error("Usage: bun run scripts/query.ts <query>");
  process.exit(1);
}

const engine = createUnragEngine();
const result = await engine.retrieve({ query, topK: 5 });

for (const chunk of result.chunks) {
  console.log(`[${chunk.score.toFixed(3)}] ${chunk.sourceId}`);
  console.log(chunk.content.slice(0, 200) + "...\n");
}
```

---

## Performance Patterns

### Connection Pooling

```ts
// lib/unrag/store/index.ts
import { Pool } from "pg";

// Single pool instance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

export const store = createDrizzleVectorStore(drizzle(pool));
```

### Engine Caching

```ts
// lib/unrag/config.ts
let cachedEngine: ContextEngine | null = null;

export function createUnragEngine() {
  if (!cachedEngine) {
    cachedEngine = unrag.createEngine({ store });
  }
  return cachedEngine;
}
```

### Batch Ingestion

```ts
async function batchIngest(documents: Document[]) {
  const engine = createUnragEngine();

  // Process in parallel batches
  const batchSize = 10;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    await Promise.all(
      batch.map((doc) =>
        engine.ingest({
          sourceId: doc.id,
          content: doc.content,
        })
      )
    );

    console.log(`Processed ${Math.min(i + batchSize, documents.length)}/${documents.length}`);
  }
}
```
