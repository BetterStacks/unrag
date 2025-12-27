import { embed, embedMany } from "ai";
import type { EmbeddingProvider } from "../core/types";

type BaseConfig = {
  /**
   * AI Gateway model id, e.g. "openai/text-embedding-3-small" or "google/gemini-...".
   */
  model?: string;
  timeoutMs?: number;
};

/**
 * Text-only embedding config for the AI SDK provider.
 */
export type AiEmbeddingConfig = BaseConfig;

const DEFAULT_TEXT_MODEL = "openai/text-embedding-3-small";

export const createAiEmbeddingProvider = (
  config: AiEmbeddingConfig = {}
): EmbeddingProvider => {
  const model =
    config.model ?? process.env.AI_GATEWAY_MODEL ?? DEFAULT_TEXT_MODEL;
  const timeoutMs = config.timeoutMs;

  return {
    name: `ai-sdk:${model}`,
    dimensions: undefined,
    embed: async ({ text }) => {
      const abortSignal = timeoutMs
        ? AbortSignal.timeout(timeoutMs)
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
    embedMany: async (inputs) => {
      const values = inputs.map((i) => i.text);
      const abortSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;

      const result = await embedMany({
        model,
        values,
        ...(abortSignal ? { abortSignal } : {}),
      });

      const embeddings = (result as any)?.embeddings as number[][] | undefined;
      if (!embeddings) {
        throw new Error("Embeddings missing from AI SDK embedMany response");
      }
      return embeddings;
    },
  };
};

