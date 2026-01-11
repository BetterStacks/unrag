import { embed, embedMany, type EmbeddingModel } from "ai";
import type { EmbeddingProvider } from "@registry/core/types";
import { requireOptional } from "./_shared";

/**
 * Google AI provider module interface.
 */
interface GoogleModule {
  google: {
    embedding: (model: string) => EmbeddingModel;
  };
}

export type GoogleEmbeddingTaskType =
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING"
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "QUESTION_ANSWERING"
  | "FACT_VERIFICATION"
  | "CODE_RETRIEVAL_QUERY";

export type GoogleEmbeddingConfig = {
  model?: string;
  timeoutMs?: number;
  outputDimensionality?: number;
  taskType?: GoogleEmbeddingTaskType;
};

const DEFAULT_TEXT_MODEL = "gemini-embedding-001";

const buildProviderOptions = (config: GoogleEmbeddingConfig) => {
  if (config.outputDimensionality === undefined && config.taskType === undefined) {
    return undefined;
  }
  return {
    google: {
      ...(config.outputDimensionality !== undefined
        ? { outputDimensionality: config.outputDimensionality }
        : {}),
      ...(config.taskType ? { taskType: config.taskType } : {}),
    },
  };
};

export const createGoogleEmbeddingProvider = (
  config: GoogleEmbeddingConfig = {}
): EmbeddingProvider => {
  const { google } = requireOptional<GoogleModule>({
    id: "@ai-sdk/google",
    installHint: "bun add @ai-sdk/google",
    providerName: "google",
  });
  const model =
    config.model ??
    process.env.GOOGLE_GENERATIVE_AI_EMBEDDING_MODEL ??
    DEFAULT_TEXT_MODEL;
  const timeoutMs = config.timeoutMs;
  const providerOptions = buildProviderOptions(config);
  const embeddingModel = google.embedding(model);

  return {
    name: `google:${model}`,
    dimensions: config.outputDimensionality,
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
        throw new Error("Embedding missing from Google response");
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
        throw new Error("Embeddings missing from Google embedMany response");
      }
      return embeddings;
    },
  };
};
