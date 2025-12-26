export type StoreAdapter = "drizzle" | "prisma" | "raw-sql";
export type EmbeddingType = "text" | "multimodal";
export type PackageManager = "bun" | "pnpm" | "npm" | "yarn";

export type WizardStateV1 = {
  v: 1;
  install: {
    installDir: string;
    storeAdapter: StoreAdapter;
    aliasBase: string;
  };
  modules: {
    extractors: string[];
    connectors: string[];
  };
  defaults: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
  };
  embedding: {
    type: EmbeddingType;
    model: string;
    timeoutMs: number;
  };
  storage: {
    storeChunkContent: boolean;
    storeDocumentContent: boolean;
  };
};

export type RegistryManifest = {
  version: number;
  extractors: Array<{
    id: string;
    label?: string;
    group?: string;
    description?: string;
    hint?: string;
    workerOnly?: boolean;
    configComplexity?: string;
    docsPath?: string | null;
  }>;
  connectors: Array<{
    id: string;
    displayName?: string;
    description?: string;
    status?: "available" | "coming-soon";
    types?: string[];
    docsPath?: string | null;
    envVars?: Array<{
      name: string;
      required?: boolean;
      notes?: string;
    }>;
  }>;
};


