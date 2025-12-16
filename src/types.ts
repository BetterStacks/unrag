export type Metadata = Record<string, string | number | boolean | null | undefined>;

export type IngestMetadata = Metadata & {
  orgId?: string;
  projectId?: string;
  tags?: string[];
};

export type Chunk = {
  id: string;
  documentId: string;
  sourceId: string;
  index: number;
  content: string;
  tokenCount: number;
  metadata: IngestMetadata;
  embedding?: number[];
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
  metadata: IngestMetadata;
  position: number;
  sourceId: string;
  documentId: string;
};

export type EmbeddingProvider = {
  name: string;
  dimensions?: number;
  embed: (input: EmbeddingInput) => Promise<number[]>;
};

export type VectorStore = {
  upsert: (chunks: Chunk[]) => Promise<void>;
  query: (params: {
    embedding: number[];
    topK: number;
    scope?: {
      orgId?: string;
      projectId?: string;
      sourceId?: string;
    };
  }) => Promise<Array<Chunk & { score: number }>>;
};

export type IngestInput = {
  sourceId: string;
  content: string;
  metadata?: IngestMetadata;
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
    orgId?: string;
    projectId?: string;
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
