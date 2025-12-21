export type MetadataValue = string | number | boolean | null;

export type Metadata = Record<
  string,
  MetadataValue | MetadataValue[] | undefined
>;

export type Chunk = {
  id: string;
  documentId: string;
  sourceId: string;
  index: number;
  content: string;
  tokenCount: number;
  metadata: Metadata;
  embedding?: number[];
  documentContent?: string;
};

export type ChunkText = {
  index: number;
  content: string;
  tokenCount: number;
};

export type ChunkingOptions = {
  chunkSize: number;
  chunkOverlap: number;
};

export type Chunker = (content: string, options: ChunkingOptions) => ChunkText[];

/**
 * Data reference for an ingested asset.
 *
 * Prefer `bytes` when possible (most reliable). URLs are convenient for connectors
 * but require network fetch at ingest time (see assetProcessing.fetch safety settings).
 */
export type AssetData =
  | {
      kind: "url";
      /** HTTPS URL to fetch the bytes from. */
      url: string;
      /** Optional request headers (e.g. signed URLs). */
      headers?: Record<string, string>;
      /**
       * Optional media type hint.
       * Useful when the URL doesn't have a stable extension (e.g. signed URLs).
       */
      mediaType?: string;
      /** Optional filename hint. */
      filename?: string;
    }
  | {
      kind: "bytes";
      /** Raw bytes of the asset. */
      bytes: Uint8Array;
      /** IANA media type (e.g. "application/pdf", "image/png"). */
      mediaType: string;
      /** Optional filename hint. */
      filename?: string;
    };

export type AssetKind = "image" | "pdf" | "audio" | "video" | "file";

/**
 * Non-text input attached to an ingested document.
 *
 * Connectors should emit stable `assetId`s (e.g. Notion block id) so downstream
 * systems can associate chunks back to their originating rich media.
 */
export type AssetInput = {
  /** Stable identifier within the document/source (e.g. block id). */
  assetId: string;
  kind: AssetKind;
  data: AssetData;
  /**
   * Optional stable-ish URI for debugging/display (may be the same as data.url).
   * This value is stored in metadata; do not assume it will be fetchable later.
   */
  uri?: string;
  /**
   * Optional text already known for the asset (caption/alt text).
   * This can be embedded as normal text chunks and can also be passed to extractors.
   */
  text?: string;
  /** Optional per-asset metadata (merged into chunk metadata). */
  metadata?: Metadata;
};

export type AssetPolicy = "skip" | "fail";

export type AssetFetchConfig = {
  /**
   * When true, the engine may fetch asset bytes from URLs during ingest.
   * Disable in high-security environments; provide `bytes` instead.
   */
  enabled: boolean;
  /**
   * Optional allowlist of hostnames. When set, only these hosts can be fetched.
   * Recommended to mitigate SSRF.
   */
  allowedHosts?: string[];
  /** Hard cap on fetched bytes. */
  maxBytes: number;
  /** Fetch timeout in milliseconds. */
  timeoutMs: number;
  /** Extra headers to attach to all fetches (merged with per-asset headers). */
  headers?: Record<string, string>;
};

export type PdfLlmExtractionConfig = {
  /**
   * When enabled, PDFs are sent to an LLM to extract text, which is then chunked
   * and embedded as normal text.
   *
   * Library default: false (cost-safe).
   * Generated config template may set this to true for convenience.
   */
  enabled: boolean;
  /**
   * AI Gateway model id (Vercel AI SDK), e.g. "google/gemini-2.0-flash".
   * This must be a model that supports file inputs for PDF extraction.
   */
  model: string;
  /**
   * Prompt used for extraction. Keep it deterministic: \"extract faithfully\".
   * The output is later chunked and embedded.
   */
  prompt: string;
  /** LLM call timeout in milliseconds. */
  timeoutMs: number;
  /** Hard cap on input PDF bytes. */
  maxBytes: number;
  /** Hard cap on extracted text length (characters). */
  maxOutputChars: number;
};

export type AssetProcessingConfig = {
  /**
   * What to do when an asset kind is present but unsupported (e.g. audio in v1).
   * Recommended default: \"skip\".
   */
  onUnsupportedAsset: AssetPolicy;
  /** What to do when processing an asset fails (fetch/LLM errors). */
  onError: AssetPolicy;
  /** Network fetch settings for URL-based assets. */
  fetch: AssetFetchConfig;
  pdf: {
    llmExtraction: PdfLlmExtractionConfig;
  };
};

/**
 * Deep partial for ergonomic overrides.
 * Used for engine defaults and per-ingest overrides.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type EmbeddingInput = {
  text: string;
  metadata: Metadata;
  position: number;
  sourceId: string;
  documentId: string;
};

export type ImageEmbeddingInput = {
  /** Image bytes or URL. */
  data: Uint8Array | string;
  /** IANA media type (recommended when data is bytes). */
  mediaType?: string;
  metadata: Metadata;
  position: number;
  sourceId: string;
  documentId: string;
  assetId?: string;
};

export type EmbeddingProvider = {
  name: string;
  dimensions?: number;
  embed: (input: EmbeddingInput) => Promise<number[]>;
  /**
   * Optional batch embedding for performance.
   * When present, the engine may embed text chunks in a single call.
   */
  embedMany?: (inputs: EmbeddingInput[]) => Promise<number[][]>;
  /**
   * Optional image embedding for unified multimodal retrieval.
   * Only used when the configured provider supports it.
   */
  embedImage?: (input: ImageEmbeddingInput) => Promise<number[]>;
};

export type DeleteInput =
  | {
      /** Delete a single logical document by exact `sourceId`. */
      sourceId: string;
      sourceIdPrefix?: never;
    }
  | {
      /**
       * Delete all logical documents whose `sourceId` starts with the prefix.
       * This matches Unrag's prefix scoping behavior in retrieval.
       */
      sourceId?: never;
      sourceIdPrefix: string;
    };

export type VectorStore = {
  /**
   * Persist (replace) a single document's chunks.
   *
   * The store treats `chunks[0].sourceId` as the logical identifier for the document.
   * Calling `upsert()` multiple times with the same `sourceId` replaces the previously
   * stored content for that document (including when the chunk count changes).
   */
  upsert: (chunks: Chunk[]) => Promise<void>;
  query: (params: {
    embedding: number[];
    topK: number;
    scope?: {
      sourceId?: string;
    };
  }) => Promise<Array<Chunk & { score: number }>>;
  delete: (input: DeleteInput) => Promise<void>;
};

export type IngestInput = {
  sourceId: string;
  content: string;
  metadata?: Metadata;
  chunking?: Partial<ChunkingOptions>;
  /** Optional rich media attached to the document. */
  assets?: AssetInput[];
  /**
   * Per-ingest overrides for asset processing. Merged with engine defaults.
   * Use this to toggle expensive features (like PDF LLM extraction) per run.
   */
  assetProcessing?: DeepPartial<AssetProcessingConfig>;
};

export type IngestResult = {
  documentId: string;
  chunkCount: number;
  embeddingModel: string;
  durations: {
    totalMs: number;
    chunkingMs: number;
    embeddingMs: number;
    storageMs: number;
  };
};

export type RetrieveInput = {
  query: string;
  topK?: number;
  scope?: {
    sourceId?: string;
  };
};

export type RetrieveResult = {
  chunks: Array<Chunk & { score: number }>;
  embeddingModel: string;
  durations: {
    totalMs: number;
    embeddingMs: number;
    retrievalMs: number;
  };
};

export type ContextEngineConfig = {
  embedding: EmbeddingProvider;
  store: VectorStore;
  defaults?: Partial<ChunkingOptions>;
  chunker?: Chunker;
  idGenerator?: () => string;
  /**
   * Asset processing defaults. If omitted, rich media is ignored (except image
   * captions, which can still be ingested via `assets[].text` if you choose).
   */
  assetProcessing?: DeepPartial<AssetProcessingConfig>;
};

export type ResolvedContextEngineConfig = {
  embedding: EmbeddingProvider;
  store: VectorStore;
  defaults: ChunkingOptions;
  chunker: Chunker;
  idGenerator: () => string;
  assetProcessing: AssetProcessingConfig;
};


