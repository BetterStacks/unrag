import { embed, embedMany } from "ai";
import type { EmbeddingProvider } from "../core/types";
import { requireOptional } from "./_shared";

export type TogetherEmbeddingConfig = {
  model?: string;
  timeoutMs?: number;
};

const DEFAULT_TEXT_MODEL = "togethercomputer/m2-bert-80M-2k-retrieval";

export const createTogetherEmbeddingProvider = (
  config: TogetherEmbeddingConfig = {}
): EmbeddingProvider => {
  const { togetherai } = requireOptional<any>({
    id: "@ai-sdk/togetherai",
    installHint: "bun add @ai-sdk/togetherai",
    providerName: "together",
  });
  const model =
    config.model ??
    process.env.TOGETHER_AI_EMBEDDING_MODEL ??
    DEFAULT_TEXT_MODEL;
  const timeoutMs = config.timeoutMs;
  const embeddingModel =
    "embeddingModel" in togetherai
      ? (togetherai as any).embeddingModel(model)
      : (togetherai as any).textEmbeddingModel(model);

  return {
    name: `together:${model}`,
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
        throw new Error("Embedding missing from Together.ai response");
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
        throw new Error("Embeddings missing from Together.ai embedMany response");
      }
      return embeddings;
    },
  };
};
