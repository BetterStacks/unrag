import { embed, embedMany } from "ai";
import type { EmbeddingProvider } from "../core/types";
import { requireOptional } from "./_shared";

export type BedrockEmbeddingConfig = {
  model?: string;
  timeoutMs?: number;
  dimensions?: number;
  normalize?: boolean;
};

const DEFAULT_TEXT_MODEL = "amazon.titan-embed-text-v2:0";

const buildProviderOptions = (config: BedrockEmbeddingConfig) => {
  if (config.dimensions === undefined && config.normalize === undefined) {
    return undefined;
  }
  return {
    bedrock: {
      ...(config.dimensions !== undefined ? { dimensions: config.dimensions } : {}),
      ...(config.normalize !== undefined ? { normalize: config.normalize } : {}),
    },
  };
};

export const createBedrockEmbeddingProvider = (
  config: BedrockEmbeddingConfig = {}
): EmbeddingProvider => {
  const { bedrock } = requireOptional<any>({
    id: "@ai-sdk/amazon-bedrock",
    installHint: "bun add @ai-sdk/amazon-bedrock",
    providerName: "bedrock",
  });
  const model =
    config.model ?? process.env.BEDROCK_EMBEDDING_MODEL ?? DEFAULT_TEXT_MODEL;
  const timeoutMs = config.timeoutMs;
  const providerOptions = buildProviderOptions(config);
  const embeddingModel = bedrock.embedding(model);

  return {
    name: `bedrock:${model}`,
    dimensions: config.dimensions,
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
        throw new Error("Embedding missing from Bedrock response");
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
        throw new Error("Embeddings missing from Bedrock embedMany response");
      }
      return embeddings;
    },
  };
};
