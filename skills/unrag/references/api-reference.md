# Unrag API Reference

Complete type definitions and method signatures for the unrag library.

## Core Types

### Chunk

The fundamental unit returned by retrieval:

```ts
type Chunk = {
  id: string;              // Unique chunk identifier
  documentId: string;      // Parent document ID
  sourceId: string;        // Stable source identifier
  index: number;           // Position within document
  content: string;         // Chunk text content
  tokenCount: number;      // Token count for this chunk
  metadata: Metadata;      // Key-value metadata
  embedding?: number[];    // Vector (usually not returned)
  documentContent?: string; // Full document (if stored)
};
```

### Metadata

Flexible key-value storage:

```ts
type MetadataValue = string | number | boolean | null;

type Metadata = Record<
  string,
  MetadataValue | MetadataValue[] | undefined
>;
```

### ChunkingOptions

Controls how documents are split:

```ts
type ChunkingOptions = {
  chunkSize: number;    // Max tokens per chunk
  chunkOverlap: number; // Overlap between chunks
};
```

## Ingest Types

### IngestInput

```ts
type IngestInput = {
  sourceId: string;                    // Stable document identifier
  content: string;                     // Document text
  metadata?: Metadata;                 // Optional metadata
  chunking?: Partial<ChunkingOptions>; // Override chunking
  assets?: AssetInput[];               // Rich media attachments
  assetProcessing?: DeepPartial<AssetProcessingConfig>;
};
```

### IngestResult

```ts
type IngestResult = {
  documentId: string;        // Generated or existing document ID
  chunkCount: number;        // Number of chunks created
  embeddingModel: string;    // Model used for embeddings
  warnings: IngestWarning[]; // Structured warnings
  durations: {
    totalMs: number;
    chunkingMs: number;
    embeddingMs: number;
    storageMs: number;
  };
};
```

### IngestWarning

Structured warnings for skipped or failed assets:

```ts
type IngestWarning =
  | { code: "asset_skipped_unsupported_kind"; ... }
  | { code: "asset_skipped_extraction_disabled"; ... }
  | { code: "asset_skipped_pdf_llm_extraction_disabled"; ... }
  | { code: "asset_skipped_image_no_multimodal_and_no_caption"; ... }
  | { code: "asset_skipped_pdf_empty_extraction"; ... }
  | { code: "asset_skipped_extraction_empty"; ... }
  | { code: "asset_processing_error"; stage: "fetch" | "extract" | "embed" | "unknown"; ... };
```

### IngestPlanResult

Returned by `planIngest()` for dry-run:

```ts
type IngestPlanResult = {
  documentId: string;
  sourceId: string;
  assets: AssetProcessingPlanItem[];
  warnings: IngestWarning[];
};

type AssetProcessingPlanItem =
  | { status: "will_process"; extractors: string[]; assetId; kind; uri }
  | { status: "will_skip"; reason: string; assetId; kind; uri };
```

## Retrieve Types

### RetrieveInput

```ts
type RetrieveInput = {
  query: string;              // Search query
  topK?: number;              // Results to return (default: 8)
  scope?: RetrieveScope;      // Filter results
};

type RetrieveScope = {
  sourceId?: string;  // Prefix filter
};
```

### RetrieveResult

```ts
type RetrieveResult = {
  chunks: Array<Chunk & { score: number }>;
  embeddingModel: string;
  durations: {
    totalMs: number;
    embeddingMs: number;
    retrievalMs: number;
  };
};
```

## Rerank Types

### RerankInput

```ts
type RerankInput = {
  query: string;
  candidates: RerankCandidate[];
  topK?: number;
  onMissingReranker?: RerankPolicy;  // "throw" | "skip"
  onMissingText?: RerankPolicy;
  resolveText?: (candidate: RerankCandidate) => string | Promise<string>;
};

type RerankCandidate = Chunk & { score: number };
type RerankPolicy = "throw" | "skip";
```

### RerankResult

```ts
type RerankResult = {
  chunks: RerankCandidate[];
  ranking: RerankRankingItem[];
  meta: {
    rerankerName: string;
    model?: string;
  };
  durations: {
    rerankMs: number;
    totalMs: number;
  };
  warnings: string[];
};

type RerankRankingItem = {
  index: number;        // Original index in candidates
  rerankScore?: number; // Score from reranker
};
```

## Delete Types

### DeleteInput

```ts
type DeleteInput =
  | { sourceId: string; sourceIdPrefix?: never }  // Exact match
  | { sourceId?: never; sourceIdPrefix: string }; // Prefix match
```

## Asset Types

### AssetInput

```ts
type AssetInput = {
  assetId: string;        // Stable ID within document
  kind: AssetKind;        // "image" | "pdf" | "audio" | "video" | "file"
  data: AssetData;        // URL or bytes
  uri?: string;           // Display URI (for debugging)
  text?: string;          // Known caption/alt text
  metadata?: Metadata;    // Per-asset metadata
};

type AssetKind = "image" | "pdf" | "audio" | "video" | "file";
```

### AssetData

```ts
type AssetData =
  | {
      kind: "url";
      url: string;
      headers?: Record<string, string>;
      mediaType?: string;
      filename?: string;
    }
  | {
      kind: "bytes";
      bytes: Uint8Array;
      mediaType: string;
      filename?: string;
    };
```

### AssetProcessingConfig

Complete asset processing configuration:

```ts
type AssetProcessingConfig = {
  onUnsupportedAsset: "skip" | "fail";
  onError: "skip" | "fail";
  concurrency: number;
  hooks?: { onEvent?: (event: AssetProcessingEvent) => void };
  fetch: AssetFetchConfig;
  pdf: {
    textLayer: PdfTextLayerConfig;
    llmExtraction: PdfLlmExtractionConfig;
    ocr: PdfOcrConfig;
  };
  image: {
    ocr: ImageOcrConfig;
    captionLlm: ImageCaptionLlmConfig;
  };
  audio: {
    transcription: AudioTranscriptionConfig;
  };
  video: {
    transcription: VideoTranscriptionConfig;
    frames: VideoFramesConfig;
  };
  file: {
    text: FileTextConfig;
    docx: FileDocxConfig;
    pptx: FilePptxConfig;
    xlsx: FileXlsxConfig;
  };
};
```

### AssetFetchConfig

```ts
type AssetFetchConfig = {
  enabled: boolean;          // Allow fetching from URLs
  allowedHosts?: string[];   // Hostname allowlist (SSRF mitigation)
  maxBytes: number;          // Max file size
  timeoutMs: number;         // Fetch timeout
  headers?: Record<string, string>;
};
```

## Extractor Types

### AssetExtractor

Interface for custom extractors:

```ts
type AssetExtractor = {
  name: string;
  supports: (args: { asset: AssetInput; ctx: AssetExtractorContext }) => boolean;
  extract: (args: { asset: AssetInput; ctx: AssetExtractorContext }) => Promise<AssetExtractorResult>;
};

type AssetExtractorContext = {
  sourceId: string;
  documentId: string;
  documentMetadata: Metadata;
  assetProcessing: AssetProcessingConfig;
};

type AssetExtractorResult = {
  texts: ExtractedTextItem[];
  skipped?: { code: string; message: string };
  metadata?: Metadata;
  diagnostics?: { model?: string; tokens?: number; seconds?: number };
};

type ExtractedTextItem = {
  label: string;           // e.g., "fulltext", "ocr", "transcript"
  content: string;         // Extracted text
  confidence?: number;
  pageRange?: [number, number];
  timeRangeSec?: [number, number];
};
```

## Reranker Types

### Reranker Interface

```ts
type Reranker = {
  name: string;
  rerank: (args: RerankerRerankArgs) => Promise<RerankerRerankResult>;
};

type RerankerRerankArgs = {
  query: string;
  documents: string[];
};

type RerankerRerankResult = {
  order: number[];      // Indices sorted by relevance
  scores?: number[];    // Optional relevance scores
  model?: string;       // Model identifier
};
```

## Store Types

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

## Embedding Provider Types

### EmbeddingProvider Interface

```ts
type EmbeddingProvider = {
  name: string;
  dimensions?: number;
  embed: (input: EmbeddingInput) => Promise<number[]>;
  embedMany?: (inputs: EmbeddingInput[]) => Promise<number[][]>;
  embedImage?: (input: ImageEmbeddingInput) => Promise<number[]>;
};

type EmbeddingInput = {
  text: string;
  metadata: Metadata;
  position: number;
  sourceId: string;
  documentId: string;
};

type ImageEmbeddingInput = {
  data: Uint8Array | string;
  mediaType?: string;
  metadata: Metadata;
  position: number;
  sourceId: string;
  documentId: string;
  assetId?: string;
};
```

## Configuration Types

### DefineUnragConfigInput

```ts
type DefineUnragConfigInput = {
  defaults?: UnragDefaultsConfig;
  engine?: UnragEngineConfig;
  embedding: UnragEmbeddingConfig;
};

type UnragDefaultsConfig = {
  chunking?: Partial<ChunkingOptions>;
  embedding?: Partial<EmbeddingProcessingConfig>;
  retrieval?: { topK?: number };
};

type EmbeddingProcessingConfig = {
  concurrency: number;  // Max concurrent embedding requests
  batchSize: number;    // Chunks per embedMany batch
};
```

### UnragEmbeddingConfig

```ts
type UnragEmbeddingConfig =
  | { provider: "ai"; config?: AiEmbeddingConfig }
  | { provider: "openai"; config?: OpenAiEmbeddingConfig }
  | { provider: "google"; config?: GoogleEmbeddingConfig }
  | { provider: "openrouter"; config?: OpenRouterEmbeddingConfig }
  | { provider: "azure"; config?: AzureEmbeddingConfig }
  | { provider: "vertex"; config?: VertexEmbeddingConfig }
  | { provider: "bedrock"; config?: BedrockEmbeddingConfig }
  | { provider: "cohere"; config?: CohereEmbeddingConfig }
  | { provider: "mistral"; config?: MistralEmbeddingConfig }
  | { provider: "together"; config?: TogetherEmbeddingConfig }
  | { provider: "ollama"; config?: OllamaEmbeddingConfig }
  | { provider: "voyage"; config?: VoyageEmbeddingConfig }
  | { provider: "custom"; create: () => EmbeddingProvider };
```

### ContextEngineConfig

Low-level engine configuration:

```ts
type ContextEngineConfig = {
  embedding: EmbeddingProvider;
  store: VectorStore;
  defaults?: Partial<ChunkingOptions>;
  chunker?: Chunker;
  idGenerator?: () => string;
  extractors?: AssetExtractor[];
  reranker?: Reranker;
  storage?: Partial<ContentStorageConfig>;
  assetProcessing?: DeepPartial<AssetProcessingConfig>;
  embeddingProcessing?: DeepPartial<EmbeddingProcessingConfig>;
};

type ContentStorageConfig = {
  storeChunkContent: boolean;
  storeDocumentContent: boolean;
};
```

## Connector Types

### ConnectorStream

Async iterable that emits events:

```ts
type ConnectorStreamEvent<TCheckpoint> =
  | { type: "upsert"; sourceId: string; content: string; metadata?: Metadata; assets?: AssetInput[] }
  | { type: "delete"; sourceId?: string; sourceIdPrefix?: string }
  | { type: "progress"; message: string; progress?: number }
  | { type: "warning"; message: string }
  | { type: "checkpoint"; checkpoint: TCheckpoint };
```

### RunConnectorStreamOptions

```ts
type RunConnectorStreamOptions<TCheckpoint> = {
  stream: AsyncIterable<ConnectorStreamEvent<TCheckpoint>>;
  onProgress?: (event: { type: string; message?: string }) => void;
  signal?: AbortSignal;
  checkpoint?: TCheckpoint;
};

type RunConnectorStreamResult<TCheckpoint> = {
  ingestCount: number;
  deleteCount: number;
  warnings: string[];
  checkpoint?: TCheckpoint;
};
```
