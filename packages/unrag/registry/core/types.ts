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

export type EmbeddingInput = {
  text: string;
  metadata: Metadata;
  position: number;
  sourceId: string;
  documentId: string;
};

export type EmbeddingProvider = {
  name: string;
  dimensions?: number;
  embed: (input: EmbeddingInput) => Promise<number[]>;
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
};

export type ResolvedContextEngineConfig = {
  embedding: EmbeddingProvider;
  store: VectorStore;
  defaults: ChunkingOptions;
  chunker: Chunker;
  idGenerator: () => string;
};


