---
name: unrag
description: Covers RAG installation, ContextEngine API, embedding providers, store adapters, extractors, connectors, batteries, and CLI commands for the unrag TypeScript library.
version: 1.0.0
---

# Unrag Agent Skill

This skill provides comprehensive knowledge about **unrag** - a RAG (Retrieval-Augmented Generation) installer for TypeScript that vendors auditable source code directly into your project.

## What is Unrag

Unrag takes a deliberately different approach to RAG: instead of being a framework or SDK, it **vendors source files** directly into your repository. When you run `unrag init`, you're not adding a dependency that abstracts away the implementation—you're copying source files that are yours to read, modify, and delete.

### Philosophy

- **You own your RAG implementation** - The code lives in your repo, appears in PRs, and can be debugged like any other code
- **Primitives over frameworks** - Unrag gives you `ingest()` and `retrieve()`, not routing, agents, or prompt templates
- **Swappable components** - Simple interfaces for embedding providers, store adapters, and extractors
- **Local-first development** - No external services, just code in your codebase

### Core Operations

1. **`ingest()`** - Chunk content, generate embeddings, store in Postgres with pgvector
2. **`retrieve()`** - Embed a query and run similarity search
3. **`rerank()`** - Optional second-stage ranking for improved precision
4. **`delete()`** - Remove documents by sourceId or prefix

## Quick Start

### Installation

```bash
# Initialize unrag in your project
bunx unrag@latest init

# Follow prompts to select:
# - Install directory (default: lib/unrag)
# - Store adapter (Drizzle, Prisma, or Raw SQL)
# - Embedding provider (OpenAI, Google, Cohere, etc.)
# - Rich media extractors (PDF, images, etc.)
```

### Minimal Configuration

```ts
// unrag.config.ts
import { defineUnragConfig } from "./lib/unrag/core";

export const unrag = defineUnragConfig({
  embedding: {
    provider: "openai",
    config: {
      model: "text-embedding-3-small",
    },
  },
} as const);
```

### First Ingest

```ts
import { createUnragEngine } from "@unrag/config";

const engine = createUnragEngine();

await engine.ingest({
  sourceId: "docs:getting-started",
  content: "Your document content here...",
  metadata: { title: "Getting Started", category: "docs" },
});
```

### First Retrieval

```ts
const result = await engine.retrieve({
  query: "how do I get started?",
  topK: 8,
});

for (const chunk of result.chunks) {
  console.log(chunk.content, chunk.score);
}
```

## Core Concepts

### ContextEngine

The `ContextEngine` class is the main entry point. Create it using `createUnragEngine()` which reads from `unrag.config.ts`:

```ts
import { createUnragEngine } from "@unrag/config";

const engine = createUnragEngine();
```

The engine provides:
- `engine.ingest(input)` - Ingest documents with optional assets
- `engine.retrieve(input)` - Query for relevant chunks
- `engine.rerank(input)` - Rerank retrieved candidates
- `engine.delete(input)` - Delete by sourceId or prefix
- `engine.planIngest(input)` - Dry-run for asset processing
- `engine.runConnectorStream(options)` - Process connector streams

### Source ID Scoping

The `sourceId` is a stable identifier for your documents:

```ts
// Single document
await engine.ingest({ sourceId: "doc:123", content: "..." });

// Hierarchical organization
await engine.ingest({ sourceId: "tenant:acme:docs:readme", content: "..." });

// Retrieve with prefix scope
const result = await engine.retrieve({
  query: "password reset",
  scope: { sourceId: "tenant:acme:" },  // Only this tenant's docs
});
```

**Key behaviors:**
- Re-ingesting with the same `sourceId` replaces the previous version
- Delete supports both exact match and prefix deletion
- Retrieval scope uses prefix matching

### Chunking

Documents are split into chunks before embedding:

```ts
// Global defaults in unrag.config.ts
export const unrag = defineUnragConfig({
  defaults: {
    chunking: {
      chunkSize: 512,    // tokens per chunk
      chunkOverlap: 50,  // overlap between chunks
    },
  },
  // ...
});

// Per-ingest override
await engine.ingest({
  sourceId: "doc:123",
  content: longDocument,
  chunking: { chunkSize: 256 },
});
```

### Asset Processing

Rich media (PDFs, images, audio, video, files) can be attached to documents:

```ts
await engine.ingest({
  sourceId: "doc:report",
  content: "Quarterly report summary...",
  assets: [
    {
      assetId: "attachment-1",
      kind: "pdf",
      data: { kind: "bytes", bytes: pdfBuffer, mediaType: "application/pdf" },
    },
  ],
});
```

Assets are processed by **extractors** that convert them to text for embedding. See [extractors.md](./references/extractors.md).

## API Quick Reference

### ingest()

```ts
const result = await engine.ingest({
  sourceId: string,           // Stable document identifier
  content: string,            // Document text
  metadata?: Metadata,        // Optional key-value pairs
  chunking?: { chunkSize?, chunkOverlap? },
  assets?: AssetInput[],      // Optional rich media
  assetProcessing?: DeepPartial<AssetProcessingConfig>,
});

// Returns:
// { documentId, chunkCount, embeddingModel, warnings, durations }
```

### retrieve()

```ts
const result = await engine.retrieve({
  query: string,              // Search query
  topK?: number,              // Number of results (default: 8)
  scope?: { sourceId?: string },  // Prefix filter
});

// Returns:
// { chunks: Array<Chunk & { score }>, embeddingModel, durations }
```

### rerank()

```ts
const result = await engine.rerank({
  query: string,
  candidates: RerankCandidate[],  // From retrieve()
  topK?: number,
  onMissingReranker?: "throw" | "skip",
  onMissingText?: "throw" | "skip",
  resolveText?: (candidate) => string | Promise<string>,
});

// Returns:
// { chunks, ranking, meta, durations, warnings }
```

### delete()

```ts
// Delete single document
await engine.delete({ sourceId: "doc:123" });

// Delete by prefix
await engine.delete({ sourceIdPrefix: "tenant:acme:" });
```

### planIngest()

Dry-run to preview asset processing without calling external services:

```ts
const plan = await engine.planIngest({
  sourceId: "doc:report",
  content: "...",
  assets: [/* ... */],
});

// Returns which assets would be processed, by which extractors
```

### runConnectorStream()

Process events from a connector:

```ts
const stream = notionConnector.sync({ pageIds: ["..."] });

const result = await engine.runConnectorStream({
  stream,
  onProgress: (event) => console.log(event),
});
```

## Configuration

### defineUnragConfig()

The main configuration function:

```ts
import { defineUnragConfig } from "./lib/unrag/core";

export const unrag = defineUnragConfig({
  // Embedding provider configuration (required)
  embedding: {
    provider: "openai",
    config: { model: "text-embedding-3-small" },
  },

  // Default settings
  defaults: {
    chunking: { chunkSize: 512, chunkOverlap: 50 },
    embedding: { concurrency: 4, batchSize: 100 },
    retrieval: { topK: 8 },
  },

  // Engine-level configuration
  engine: {
    extractors: [/* ... */],      // Asset extractors
    reranker: createCohereReranker(),
    storage: {
      storeChunkContent: true,
      storeDocumentContent: true,
    },
    assetProcessing: {/* ... */},
  },
} as const);
```

### Environment Variables

Common environment variables by provider:

| Provider | Variables |
|----------|-----------|
| OpenAI | `OPENAI_API_KEY` |
| Google | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Cohere | `COHERE_API_KEY` |
| Azure | `AZURE_OPENAI_API_KEY`, `AZURE_RESOURCE_NAME` |
| Voyage | `VOYAGE_API_KEY` |
| Ollama | (none, runs locally) |

Database: `DATABASE_URL`

## Reference File Guide

This skill includes detailed reference files for specific topics:

| Reference | When to Consult |
|-----------|-----------------|
| [api-reference.md](./references/api-reference.md) | Full type definitions, method signatures |
| [embedding-providers.md](./references/embedding-providers.md) | Configuring OpenAI, Google, Cohere, Voyage, Ollama, etc. |
| [store-adapters.md](./references/store-adapters.md) | Drizzle, Prisma, Raw SQL setup and schema |
| [extractors.md](./references/extractors.md) | PDF, image, audio, video, file extractors |
| [connectors.md](./references/connectors.md) | Notion, Google Drive, OneDrive, Dropbox |
| [batteries.md](./references/batteries.md) | Reranker, Eval harness, Debug panel |
| [cli-commands.md](./references/cli-commands.md) | init, add, upgrade, doctor, debug |
| [patterns.md](./references/patterns.md) | Search endpoints, multi-tenant, chat integration |
| [troubleshooting.md](./references/troubleshooting.md) | Common issues, debugging, performance |

## Version Information

- **Skill Version:** 1.0.0
- **Unrag CLI Version:** 0.3.2
- **Config Version:** 2

## Key Source Files

When you need to look at source code:

| File | Purpose |
|------|---------|
| `packages/unrag/registry/core/types.ts` | All TypeScript types |
| `packages/unrag/registry/core/context-engine.ts` | ContextEngine class |
| `packages/unrag/registry/manifest.json` | Extractors, connectors, batteries metadata |
| `packages/unrag/cli/commands/*.ts` | CLI command implementations |
| `apps/web/content/docs/**/*.mdx` | Documentation pages |
