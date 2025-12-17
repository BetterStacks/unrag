import { embed } from "ai";
import type { EmbeddingProvider } from "../core/types";

export type AiEmbeddingConfig = {
  /**
   * AI Gateway model id, e.g. "openai/text-embedding-3-small"
   */
  model?: string;
  timeoutMs?: number;
};

const DEFAULT_MODEL = "openai/text-embedding-3-small";

export const createAiEmbeddingProvider = (
  config: AiEmbeddingConfig = {}
): EmbeddingProvider => {
  const model = config.model ?? process.env.AI_GATEWAY_MODEL ?? DEFAULT_MODEL;

  return {
    name: `ai-sdk:${model}`,
    dimensions: undefined,
    embed: async ({ text }) => {
      const abortSignal = config.timeoutMs
        ? AbortSignal.timeout(config.timeoutMs)
        : undefined;

      const result = await embed({
        model,
        value: text,
        ...(abortSignal ? { abortSignal } : {}),
      });

      if (!result.embedding) {
        throw new Error("Embedding missing from AI SDK response");
      }

      return result.embedding;
    },
  };
};


