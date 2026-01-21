# Batteries

Batteries are optional feature modules that extend Unrag's core functionality. Three batteries are available.

## Available Batteries

| Battery | Description | Status |
|---------|-------------|--------|
| **Reranker** | Second-stage reranking with Cohere rerank-v3.5 | Available |
| **Eval** | Retrieval evaluation harness with metrics and CI integration | Available |
| **Debug** | Real-time TUI debugger for RAG operations | Available |

---

## Reranker Battery

Improve retrieval precision with two-stage ranking.

### Installation

```bash
bunx unrag@latest add battery reranker
```

**Dependencies:** `ai`, `@ai-sdk/cohere`

**Environment:**
```bash
COHERE_API_KEY="..."
```

### Configuration

```ts
import { defineUnragConfig } from "./lib/unrag/core";
import { createCohereReranker } from "./lib/unrag/rerank";

export const unrag = defineUnragConfig({
  embedding: { /* ... */ },
  engine: {
    reranker: createCohereReranker({
      model: "rerank-v3.5",      // Default
      maxDocuments: 1000,        // Max batch size
    }),
  },
});
```

### Usage

```ts
import { createUnragEngine } from "@unrag/config";

const engine = createUnragEngine();

// Step 1: Retrieve more candidates than needed
const retrieved = await engine.retrieve({
  query: "how do I reset my password?",
  topK: 30,
});

// Step 2: Rerank to get the best results
const reranked = await engine.rerank({
  query: "how do I reset my password?",
  candidates: retrieved.chunks,
  topK: 8,
});

// Use reranked results
for (const chunk of reranked.chunks) {
  console.log(chunk.content, chunk.score);
}
```

### Rerank Options

```ts
const result = await engine.rerank({
  query: string,
  candidates: RerankCandidate[],
  topK?: number,                          // Results to return
  onMissingReranker?: "throw" | "skip",   // If no reranker configured
  onMissingText?: "throw" | "skip",       // If candidate has no content
  resolveText?: (candidate) => string,    // Fetch text externally
});
```

### Custom Reranker

```ts
import { createCustomReranker } from "./lib/unrag/rerank";

const myReranker = createCustomReranker({
  name: "my-reranker",
  rerank: async ({ query, documents }) => {
    const response = await myRerankerApi.rerank({ query, documents });
    return {
      order: response.ranking.map(r => r.index),
      scores: response.ranking.map(r => r.score),
      model: "my-model-v1",
    };
  },
});
```

### When to Use Reranking

**Good candidates:**
- Complex queries where top result isn't always correct
- Need 10+ highly relevant results
- Quality matters more than latency

**Skip reranking:**
- Simple, specific queries
- Latency-sensitive applications
- Vector search already gives good results

---

## Eval Battery

Deterministic retrieval evaluation with metrics, baselines, and CI integration.

### Installation

```bash
bunx unrag@latest add battery eval
```

Creates:
- `.unrag/eval/datasets/sample.json` - Sample evaluation dataset
- `.unrag/eval/config.json` - Eval configuration
- `scripts/unrag-eval.ts` - Eval runner script

### Creating Datasets

```json
// .unrag/eval/datasets/my-dataset.json
{
  "version": 1,
  "name": "My Eval Dataset",
  "items": [
    {
      "query": "How do I reset my password?",
      "expected": ["doc:auth:password-reset", "doc:auth:account-recovery"],
      "metadata": { "category": "auth" }
    },
    {
      "query": "What payment methods are supported?",
      "expected": ["doc:billing:payment-methods"],
      "metadata": { "category": "billing" }
    }
  ]
}
```

**Fields:**
- `query` - The search query
- `expected` - Array of sourceIds that should be retrieved
- `metadata` - Optional metadata for filtering/grouping

### Running Evals

```bash
# Run eval with default dataset
bun run eval

# Run with specific dataset
bun run eval -- --dataset payments
```

Or programmatically:

```ts
import { createEvalRunner } from "./lib/unrag/eval";
import { createUnragEngine } from "@unrag/config";

const engine = createUnragEngine();
const runner = createEvalRunner({ engine });

const results = await runner.run({
  dataset: "my-dataset",
  topK: 10,
});

console.log(results.metrics);
// { hitAt1: 0.85, hitAt5: 0.95, recall: 0.90, mrr: 0.88 }
```

### Metrics

| Metric | Description |
|--------|-------------|
| `hit@k` | Percentage of queries where at least one expected doc is in top K |
| `recall@k` | Average fraction of expected docs found in top K |
| `precision@k` | Average fraction of top K that are expected docs |
| `mrr` | Mean Reciprocal Rank - average of 1/rank of first relevant result |

### Configuration

```json
// .unrag/eval/config.json
{
  "version": 1,
  "defaults": {
    "topK": 10,
    "metrics": ["hit@1", "hit@5", "recall@10", "mrr"]
  },
  "thresholds": {
    "hit@5": 0.90,
    "recall@10": 0.85
  },
  "datasets": {
    "default": "sample",
    "all": ["sample", "payments", "auth"]
  }
}
```

### CI Integration

```yaml
# .github/workflows/eval.yml
name: RAG Evaluation

on:
  pull_request:
    paths:
      - 'lib/unrag/**'
      - 'unrag.config.ts'

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run evaluation
        run: bun run eval --ci
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

The `--ci` flag:
- Outputs machine-readable JSON
- Fails if thresholds not met
- Compares against baseline if present

### Comparing Runs

```bash
# Save baseline
bun run eval --save-baseline

# Compare against baseline
bun run eval --compare
```

Output shows metric changes:
```
Metric      Baseline    Current     Change
hit@5       0.90        0.92        +0.02 ✓
recall@10   0.85        0.83        -0.02 ✗
mrr         0.88        0.89        +0.01 ✓
```

---

## Debug Battery

Real-time TUI debugger for RAG operations.

### Installation

```bash
bunx unrag@latest add battery debug
```

**Dependencies:** `ws`

### Enabling Debug Mode

```bash
# Set environment variable
UNRAG_DEBUG=true bun run dev

# Or in .env
UNRAG_DEBUG=true
```

When enabled, the ContextEngine automatically starts a WebSocket server.

### Launching the TUI

```bash
bunx unrag@latest debug
```

Opens an interactive terminal UI with panels:

1. **Ingest** - Watch ingestion operations in real-time
2. **Retrieve** - See retrieval queries and results
3. **Rerank** - Monitor reranking operations
4. **Doctor** - Health checks and diagnostics
5. **Query** - Interactive query testing
6. **Docs** - Browse indexed documents

### Panels

**Ingest Panel:**
- Shows sourceId, chunk count, duration
- Asset processing progress
- Warnings and errors

**Retrieve Panel:**
- Query text and parameters
- Results with scores
- Timing breakdown

**Rerank Panel:**
- Original vs reranked order
- Score comparisons
- Timing

**Doctor Panel:**
- Embedding provider status
- Database connection
- Extractor configuration
- Index statistics

**Query Panel:**
- Interactive query input
- Live results
- Scope filtering

**Docs Panel:**
- Browse by sourceId
- View chunks and metadata
- Delete documents

### Programmatic Usage

```ts
import { startDebugServer, registerUnragDebug } from "./lib/unrag/debug";

// Start server manually
await startDebugServer({ port: 9229 });

// Register engine for interactive features
registerUnragDebug({
  engine,
  storeInspector: store.inspector,  // Optional: for Docs panel
});
```

### Configuration

```ts
// Environment variables
UNRAG_DEBUG=true           // Enable debug mode
UNRAG_DEBUG_PORT=9229      // WebSocket port (default: 9229)
```

### Security Note

The debug server should **never** be enabled in production. It exposes:
- All indexed content
- Query patterns
- Internal metrics

Use environment-based enabling:

```ts
// Only in development
if (process.env.NODE_ENV !== "production") {
  process.env.UNRAG_DEBUG = "true";
}
```

---

## Battery Installation Summary

```bash
# Install all batteries
bunx unrag@latest add battery reranker
bunx unrag@latest add battery eval
bunx unrag@latest add battery debug

# Check installed batteries
cat unrag.json | jq '.batteries'
```

Installed batteries are tracked in `unrag.json`:

```json
{
  "batteries": ["reranker", "eval", "debug"]
}
```
