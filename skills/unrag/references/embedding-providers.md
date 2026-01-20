# Embedding Providers

Unrag supports 12 embedding providers plus a custom option. Configure in `unrag.config.ts`:

```ts
export const unrag = defineUnragConfig({
  embedding: {
    provider: "openai",
    config: { model: "text-embedding-3-small" },
  },
  // ...
});
```

## Provider Overview

| Provider | Default Model | Dimensions | Multimodal |
|----------|--------------|------------|------------|
| AI Gateway | `openai/text-embedding-3-small` | 1536 | No |
| OpenAI | `text-embedding-3-small` | 1536 | No |
| Google | `gemini-embedding-001` | 768 | No |
| Cohere | `embed-english-v3.0` | 1024 | No |
| Azure OpenAI | `text-embedding-3-small` | 1536 | No |
| AWS Bedrock | `amazon.titan-embed-text-v2:0` | 1024 | No |
| Voyage | `voyage-3.5-lite` | 1024 | Yes* |
| Mistral | `mistral-embed` | 1024 | No |
| Together | (varies) | (varies) | No |
| Ollama | `nomic-embed-text` | 768 | No |
| OpenRouter | (varies) | (varies) | No |
| Vertex AI | `text-embedding-004` | 768 | No |

*Voyage supports multimodal with `voyage-multimodal-3` model.

---

## 1. AI Gateway (Vercel AI SDK)

Generic wrapper around Vercel AI SDK. Legacy default, kept for backwards compatibility.

```ts
embedding: {
  provider: "ai",
  config: {
    model: "openai/text-embedding-3-small",  // provider/model format
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
AI_GATEWAY_API_KEY="..."
AI_GATEWAY_MODEL="openai/text-embedding-3-small"  # optional
```

**Model string format:** `provider/model-name` (e.g., `openai/text-embedding-3-large`, `cohere/embed-english-v3.0`)

---

## 2. OpenAI

Recommended for most use cases. Best balance of quality and cost.

```ts
embedding: {
  provider: "openai",
  config: {
    model: "text-embedding-3-small",  // or "text-embedding-3-large"
    dimensions: 1536,  // optional, can reduce for cost savings
    user: "user-123",  // optional, for usage tracking
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
OPENAI_API_KEY="sk-..."
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"  # optional override
```

**Models:**
- `text-embedding-3-small` - 1536 dimensions, good for most use cases
- `text-embedding-3-large` - 3072 dimensions, higher quality
- `text-embedding-ada-002` - Legacy, 1536 dimensions

---

## 3. Google / Gemini

Google's embedding models via Generative AI API.

```ts
embedding: {
  provider: "google",
  config: {
    model: "gemini-embedding-001",
    outputDimensionality: 768,  // optional
    taskType: "RETRIEVAL_DOCUMENT",  // or "RETRIEVAL_QUERY"
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
GOOGLE_GENERATIVE_AI_API_KEY="..."
GOOGLE_GENERATIVE_AI_EMBEDDING_MODEL="gemini-embedding-001"  # optional
```

**Task Types:**
- `RETRIEVAL_DOCUMENT` - For indexing documents
- `RETRIEVAL_QUERY` - For search queries
- `SEMANTIC_SIMILARITY` - General similarity
- `CLASSIFICATION` - Classification tasks
- `CLUSTERING` - Clustering tasks

---

## 4. Cohere

High-quality embeddings with input type optimization.

```ts
embedding: {
  provider: "cohere",
  config: {
    model: "embed-english-v3.0",
    inputType: "search_document",  // or "search_query"
    truncate: "END",  // "NONE" | "START" | "END"
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
COHERE_API_KEY="..."
COHERE_EMBEDDING_MODEL="embed-english-v3.0"  # optional
```

**Input Types:**
- `search_document` - For indexing (ingest)
- `search_query` - For retrieval queries
- `classification` - Classification tasks
- `clustering` - Clustering tasks

**Models:**
- `embed-english-v3.0` - English, 1024 dims
- `embed-multilingual-v3.0` - 100+ languages

---

## 5. Azure OpenAI

OpenAI models via Azure.

```ts
embedding: {
  provider: "azure",
  config: {
    model: "text-embedding-3-small",
    dimensions: 1536,
    user: "user-123",
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
AZURE_OPENAI_API_KEY="..."
AZURE_RESOURCE_NAME="your-resource-name"
AZURE_EMBEDDING_MODEL="text-embedding-3-small"  # optional
```

---

## 6. AWS Bedrock

Amazon's managed AI service.

```ts
embedding: {
  provider: "bedrock",
  config: {
    model: "amazon.titan-embed-text-v2:0",
    dimensions: 1024,
    normalize: true,
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."  # when outside AWS
AWS_SECRET_ACCESS_KEY="..."
BEDROCK_EMBEDDING_MODEL="amazon.titan-embed-text-v2:0"  # optional
```

**Models:**
- `amazon.titan-embed-text-v2:0` - Latest Titan model
- `amazon.titan-embed-text-v1` - Original Titan

---

## 7. Voyage AI

High-quality embeddings with multimodal support.

```ts
// Text embeddings
embedding: {
  provider: "voyage",
  config: {
    type: "text",
    model: "voyage-3.5-lite",
    timeoutMs: 15_000,
  },
},

// Multimodal embeddings (text + images)
embedding: {
  provider: "voyage",
  config: {
    type: "multimodal",
    model: "voyage-multimodal-3",
    timeoutMs: 30_000,
  },
},
```

**Environment:**
```bash
VOYAGE_API_KEY="..."
VOYAGE_MODEL="voyage-3.5-lite"  # optional
```

**Models:**
- `voyage-3.5-lite` - Fast, cost-effective
- `voyage-3` - Higher quality
- `voyage-multimodal-3` - Text and images

---

## 8. Mistral

Mistral's embedding model.

```ts
embedding: {
  provider: "mistral",
  config: {
    model: "mistral-embed",
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
MISTRAL_API_KEY="..."
MISTRAL_EMBEDDING_MODEL="mistral-embed"  # optional
```

---

## 9. Together AI

Open-source models on Together's infrastructure.

```ts
embedding: {
  provider: "together",
  config: {
    model: "togethercomputer/m2-bert-80M-2k-retrieval",
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
TOGETHER_AI_API_KEY="..."
TOGETHER_AI_EMBEDDING_MODEL="togethercomputer/m2-bert-80M-2k-retrieval"  # optional
```

---

## 10. Ollama (Local)

Run embeddings locally with Ollama.

```ts
embedding: {
  provider: "ollama",
  config: {
    model: "nomic-embed-text",
    baseURL: "http://localhost:11434",  // optional
    headers: {},  // optional
    timeoutMs: 30_000,
  },
},
```

**Environment:**
```bash
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"  # optional
```

**Setup:**
```bash
# Install Ollama and pull model
ollama pull nomic-embed-text
```

**Popular Models:**
- `nomic-embed-text` - General purpose
- `mxbai-embed-large` - Larger, higher quality
- `all-minilm` - Smaller, faster

---

## 11. OpenRouter

Multi-model gateway.

```ts
embedding: {
  provider: "openrouter",
  config: {
    model: "openai/text-embedding-3-small",
    apiKey: "...",  // optional, uses env var
    baseURL: "https://openrouter.ai/api/v1",
    referer: "https://your-app.com",
    title: "Your App Name",
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
OPENROUTER_API_KEY="..."
OPENROUTER_EMBEDDING_MODEL="openai/text-embedding-3-small"  # optional
```

---

## 12. Vertex AI (Google Cloud)

Google's enterprise AI platform.

```ts
embedding: {
  provider: "vertex",
  config: {
    model: "text-embedding-004",
    outputDimensionality: 768,
    taskType: "RETRIEVAL_DOCUMENT",
    title: "Document title",  // optional, improves quality
    autoTruncate: true,
    timeoutMs: 15_000,
  },
},
```

**Environment:**
```bash
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"  # when outside GCP
GOOGLE_VERTEX_EMBEDDING_MODEL="text-embedding-004"  # optional
```

---

## 13. Custom Provider

Bring your own embedding implementation:

```ts
embedding: {
  provider: "custom",
  create: () => ({
    name: "my-embeddings",
    dimensions: 768,
    embed: async (input) => {
      // Your embedding logic
      return await myEmbeddingService.embed(input.text);
    },
    embedMany: async (inputs) => {
      // Optional batch support
      return await myEmbeddingService.embedBatch(inputs.map(i => i.text));
    },
    embedImage: async (input) => {
      // Optional multimodal support
      return await myEmbeddingService.embedImage(input.data);
    },
  }),
},
```

### EmbeddingProvider Interface

```ts
type EmbeddingProvider = {
  name: string;
  dimensions?: number;
  embed: (input: EmbeddingInput) => Promise<number[]>;
  embedMany?: (inputs: EmbeddingInput[]) => Promise<number[][]>;
  embedImage?: (input: ImageEmbeddingInput) => Promise<number[]>;
};
```

## Choosing a Provider

**Best for most use cases:** OpenAI `text-embedding-3-small`
- Good quality, reasonable cost, fast

**Budget-conscious:** Ollama (local) or Together AI
- Free (Ollama) or cheap (Together)

**Enterprise/compliance:** Azure OpenAI or Vertex AI
- Enterprise features, data residency

**Multilingual:** Cohere `embed-multilingual-v3.0`
- 100+ languages

**Multimodal (images + text):** Voyage `voyage-multimodal-3`
- Unified text and image embeddings

## Performance Tuning

Configure concurrency and batch size in defaults:

```ts
export const unrag = defineUnragConfig({
  defaults: {
    embedding: {
      concurrency: 4,   // Concurrent API calls
      batchSize: 100,   // Chunks per embedMany call
    },
  },
  embedding: { /* ... */ },
});
```

Higher values improve throughput but may hit rate limits.
