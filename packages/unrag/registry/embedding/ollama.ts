import { embed, embedMany } from "ai";
import { createOllama, ollama } from "ollama-ai-provider-v2";
import type { EmbeddingProvider } from "../core/types";

export type OllamaEmbeddingConfig = {
  model?: string;
  timeoutMs?: number;
  baseURL?: string;
  headers?: Record<string, string>;
};

const DEFAULT_TEXT_MODEL = "nomic-embed-text";

const resolveProvider = (config: OllamaEmbeddingConfig) => {
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
