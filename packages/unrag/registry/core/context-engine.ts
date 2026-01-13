import { deleteDocuments } from "./delete";
import { ingest, planIngest } from "./ingest";
import { rerank } from "./rerank";
import { retrieve } from "./retrieve";
import { defineConfig, resolveConfig } from "./config";
import { createAiEmbeddingProvider } from "@registry/embedding/ai";
import { createOpenAiEmbeddingProvider } from "@registry/embedding/openai";
import { createGoogleEmbeddingProvider } from "@registry/embedding/google";
import { createOpenRouterEmbeddingProvider } from "@registry/embedding/openrouter";
import { createAzureEmbeddingProvider } from "@registry/embedding/azure";
import { createVertexEmbeddingProvider } from "@registry/embedding/vertex";
import { createBedrockEmbeddingProvider } from "@registry/embedding/bedrock";
import { createCohereEmbeddingProvider } from "@registry/embedding/cohere";
import { createMistralEmbeddingProvider } from "@registry/embedding/mistral";
import { createTogetherEmbeddingProvider } from "@registry/embedding/together";
import { createOllamaEmbeddingProvider } from "@registry/embedding/ollama";
import { createVoyageEmbeddingProvider } from "@registry/embedding/voyage";
import type {
  AssetExtractor,
  ContextEngineConfig,
  DeleteInput,
  DefineUnragConfigInput,
  EmbeddingProvider,
  IngestInput,
  IngestResult,
  IngestPlanResult,
  RerankInput,
  RerankResult,
  ResolvedContextEngineConfig,
  RetrieveInput,
  RetrieveResult,
  UnragCreateEngineRuntime,
} from "./types";

export class ContextEngine {
  private readonly config: ResolvedContextEngineConfig;

  constructor(config: ContextEngineConfig) {
    this.config = resolveConfig(config);

    // Auto-start debug server when UNRAG_DEBUG=true
    if (process.env.UNRAG_DEBUG === "true") {
      this.initDebugServer();
    }
  }

  /**
   * Initialize the debug WebSocket server.
   * This is done asynchronously to avoid blocking engine creation.
   */
  private initDebugServer(): void {
    import("@registry/debug/server")
      .then(({ startDebugServer }) => {
        startDebugServer().catch((err) => {
          console.warn(
            "[unrag:debug] Failed to start debug server:",
            err instanceof Error ? err.message : String(err)
          );
        });
      })
      .catch(() => {
        // Debug battery not installed - silently ignore
      });
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

  /**
   * Rerank retrieved candidates using the configured reranker.
   *
   * This is an explicit second-stage ranking step that can improve precision
   * by reordering candidates based on a more expensive relevance model.
   *
   * @example
   * ```ts
   * const retrieved = await engine.retrieve({ query, topK: 30 });
   * const reranked = await engine.rerank({
   *   query,
   *   candidates: retrieved.chunks,
   *   topK: 8,
   * });
   * ```
   */
  async rerank(input: RerankInput): Promise<RerankResult> {
    return rerank(this.config, input);
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

    if (config.embedding.provider === "openai") {
      embeddingProvider = createOpenAiEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "google") {
      embeddingProvider = createGoogleEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "openrouter") {
      embeddingProvider = createOpenRouterEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "azure") {
      embeddingProvider = createAzureEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "vertex") {
      embeddingProvider = createVertexEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "bedrock") {
      embeddingProvider = createBedrockEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "cohere") {
      embeddingProvider = createCohereEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "mistral") {
      embeddingProvider = createMistralEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "together") {
      embeddingProvider = createTogetherEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "ollama") {
      embeddingProvider = createOllamaEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    if (config.embedding.provider === "voyage") {
      embeddingProvider = createVoyageEmbeddingProvider(config.embedding.config);
      return embeddingProvider;
    }

    embeddingProvider = config.embedding.create();
    return embeddingProvider;
  };

  const defaults = {
    chunking: config.defaults?.chunking ?? {},
    embedding: config.defaults?.embedding ?? {},
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
      embeddingProcessing: {
        ...(defaults.embedding ?? {}),
        ...(config.engine?.embeddingProcessing ?? {}),
      },
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
