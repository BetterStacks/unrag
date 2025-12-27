import { embed, embedMany, type EmbeddingModel } from "ai";
import type { EmbeddingProvider } from "../core/types";
import { requireOptional } from "./_shared";

/**
 * Ollama provider instance interface.
 */
interface OllamaProvider {
  textEmbeddingModel: (model: string) => EmbeddingModel<string>;
}

/**
 * Ollama provider module interface.
 */
interface OllamaModule {
  createOllama: (config: { baseURL?: string; headers?: Record<string, string> }) => OllamaProvider;
  ollama: OllamaProvider;
}

export type OllamaEmbeddingConfig = {
  model?: string;
  timeoutMs?: number;
  baseURL?: string;
  headers?: Record<string, string>;
};

const DEFAULT_TEXT_MODEL = "nomic-embed-text";

const resolveProvider = (config: OllamaEmbeddingConfig): OllamaProvider => {
  const { createOllama, ollama } = requireOptional<OllamaModule>({
    id: "ollama-ai-provider-v2",
    installHint: "bun add ollama-ai-provider-v2",
    providerName: "ollama",
  });
  if (config.baseURL || config.headers) {
    return createOllama({
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      ...(config.headers ? { headers: config.headers } : {}),
    });
  }
  return ollama;
};

export const createOllamaEmbeddingProvider = (
  config: OllamaEmbeddingConfig = {}
): EmbeddingProvider => {
  const model =
    config.model ?? process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_TEXT_MODEL;
  const timeoutMs = config.timeoutMs;
  const provider = resolveProvider(config);
  const embeddingModel = provider.textEmbeddingModel(model);

  return {
    name: `ollama:${model}`,
    dimensions: undefined,
    embed: async ({ text }) => {
      const abortSignal = timeoutMs
        ? AbortSignal.timeout(timeoutMs)
        : undefined;

      const result = await embed({
        model: embeddingModel,
        value: text,
        ...(abortSignal ? { abortSignal } : {}),
      });

      if (!result.embedding) {
        throw new Error("Embedding missing from Ollama response");
      }

      return result.embedding;
    },
    embedMany: async (inputs) => {
      const values = inputs.map((i) => i.text);
      const abortSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;

      const result = await embedMany({
        model: embeddingModel,
        values,
        ...(abortSignal ? { abortSignal } : {}),
      });

      const { embeddings } = result;
      if (!Array.isArray(embeddings)) {
        throw new Error("Embeddings missing from Ollama embedMany response");
      }
      return embeddings;
    },
  };
};
