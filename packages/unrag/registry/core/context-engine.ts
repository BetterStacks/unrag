import { deleteDocuments } from "./delete";
import { ingest, planIngest } from "./ingest";
import { retrieve } from "./retrieve";
import { defineConfig, resolveConfig } from "./config";
import { createAiEmbeddingProvider } from "../embedding/ai";
import type {
  AssetExtractor,
  ContextEngineConfig,
  DeleteInput,
  DefineUnragConfigInput,
  EmbeddingProvider,
  IngestInput,
  IngestResult,
  IngestPlanResult,
  ResolvedContextEngineConfig,
  RetrieveInput,
  RetrieveResult,
  UnragCreateEngineRuntime,
} from "./types";

export class ContextEngine {
  private readonly config: ResolvedContextEngineConfig;

  constructor(config: ContextEngineConfig) {
    this.config = resolveConfig(config);
  }

  async ingest(input: IngestInput): Promise<IngestResult> {
    return ingest(this.config, input);
  }

  /**
   * Dry-run for ingestion. Returns which assets would be processed and by which extractors,
   * without calling external services.
   *
   * Note: chunk counts/embeddings are not produced in dry-run.
   */
  async planIngest(input: IngestInput): Promise<IngestPlanResult> {
    return planIngest(this.config, input);
  }

  async retrieve(input: RetrieveInput): Promise<RetrieveResult> {
    return retrieve(this.config, input);
  }

  async delete(input: DeleteInput): Promise<void> {
    return deleteDocuments(this.config, input);
  }
}

export const createContextEngine = (config: ContextEngineConfig) =>
  new ContextEngine(config);

export { defineConfig };

/**
 * Ergonomic, higher-level config wrapper.
 *
 * This helps keep `unrag.config.ts` as a single source of truth while still
 * allowing runtime wiring (DB client/store, optional extractors).
 */
export const defineUnragConfig = <T extends DefineUnragConfigInput>(config: T) => {
  let embeddingProvider: EmbeddingProvider | undefined;

  const getEmbeddingProvider = () => {
    if (embeddingProvider) return embeddingProvider;

    if (config.embedding.provider === "ai") {
      embeddingProvider = createAiEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    embeddingProvider = config.embedding.create();
    return embeddingProvider;
  };

  const defaults = {
    chunking: config.defaults?.chunking ?? {},
    retrieval: {
      topK: config.defaults?.retrieval?.topK ?? 8,
    },
  } as const;

  const createEngineConfig = (runtime: UnragCreateEngineRuntime): ContextEngineConfig => {
    const baseExtractors = (config.engine?.extractors ?? []) as AssetExtractor[];
    const extractors =
      typeof runtime.extractors === "function"
        ? runtime.extractors(baseExtractors)
        : runtime.extractors ?? baseExtractors;

    return defineConfig({
      ...(config.engine ?? {}),
      defaults: defaults.chunking,
      embedding: getEmbeddingProvider(),
      store: runtime.store,
      extractors,
    });
  };

  return {
    defaults,
    createEngineConfig,
    createEngine: (runtime: UnragCreateEngineRuntime) =>
      new ContextEngine(createEngineConfig(runtime)),
  };
};


