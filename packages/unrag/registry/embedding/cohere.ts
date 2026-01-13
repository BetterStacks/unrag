import { embed, embedMany, type EmbeddingModel } from "ai";
import type { EmbeddingProvider } from "@registry/core/types";
import { requireOptional } from "@registry/embedding/_shared";

/**
 * Cohere provider module interface.
 */
interface CohereModule {
  cohere: {
    embedding: (model: string) => EmbeddingModel;
  };
}

export type CohereEmbeddingConfig = {
  model?: string;
  timeoutMs?: number;
  inputType?: "search_document" | "search_query" | "classification" | "clustering";
  truncate?: "NONE" | "START" | "END";
};

const DEFAULT_TEXT_MODEL = "embed-english-v3.0";

const buildProviderOptions = (config: CohereEmbeddingConfig) => {
  if (!config.inputType && !config.truncate) {
    return undefined;
  }
  return {
    cohere: {
      ...(config.inputType ? { inputType: config.inputType } : {}),
      ...(config.truncate ? { truncate: config.truncate } : {}),
    },
  };
};

export const createCohereEmbeddingProvider = (
  config: CohereEmbeddingConfig = {}
): EmbeddingProvider => {
  const { cohere } = requireOptional<CohereModule>({
    id: "@ai-sdk/cohere",
    installHint: "bun add @ai-sdk/cohere",
    providerName: "cohere",
  });
  const model =
    config.model ?? process.env.COHERE_EMBEDDING_MODEL ?? DEFAULT_TEXT_MODEL;
  const timeoutMs = config.timeoutMs;
  const providerOptions = buildProviderOptions(config);
  const embeddingModel = cohere.embedding(model);

  return {
    name: `cohere:${model}`,
    dimensions: undefined,
    embed: async ({ text }) => {
      const abortSignal = timeoutMs
        ? AbortSignal.timeout(timeoutMs)
        : undefined;

      const result = await embed({
        model: embeddingModel,
        value: text,
        ...(providerOptions ? { providerOptions } : {}),
        ...(abortSignal ? { abortSignal } : {}),
      });

      if (!result.embedding) {
        throw new Error("Embedding missing from Cohere response");
      }

      return result.embedding;
    },
    embedMany: async (inputs) => {
      const values = inputs.map((i) => i.text);
      const abortSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;

      const result = await embedMany({
        model: embeddingModel,
        values,
        ...(providerOptions ? { providerOptions } : {}),
        ...(abortSignal ? { abortSignal } : {}),
      });

      const { embeddings } = result;
      if (!Array.isArray(embeddings)) {
        throw new Error("Embeddings missing from Cohere embedMany response");
      }
      return embeddings;
    },
  };
};
