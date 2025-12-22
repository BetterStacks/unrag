import { embed, embedMany } from "ai";
import type { EmbeddingProvider, ImageEmbeddingInput } from "../core";

type BaseConfig = {
  /**
   * AI Gateway model id, e.g. "openai/text-embedding-3-small" or "google/gemini-...".
   */
  model?: string;
  timeoutMs?: number;
};

export type AiEmbeddingConfig =
  | (BaseConfig & {
      /**
       * Defaults to "text" for backwards compatibility.
       * - "text": only supports embedding strings
       * - "multimodal": additionally enables `embedImage()` for image assets (when the model supports it)
       */
      type?: "text";
    })
  | (BaseConfig & {
      type: "multimodal";
      /**
       * Controls how images are translated into AI SDK `embed()` values.
       * Different providers use different shapes; this is the escape hatch.
       */
      image?: {
        value?: (input: ImageEmbeddingInput) => unknown;
      };
    });

const DEFAULT_TEXT_MODEL = "openai/text-embedding-3-small";
const DEFAULT_MULTIMODAL_MODEL = "voyage/voyage-multimodal-3";

const bytesToDataUrl = (bytes: Uint8Array, mediaType: string) => {
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${mediaType};base64,${base64}`;
};

const defaultImageValue = (input: ImageEmbeddingInput) => {
  const v =
    typeof input.data === "string"
      ? input.data
      : bytesToDataUrl(input.data, input.mediaType ?? "image/jpeg");
  // This matches common multimodal embedding providers (e.g. Voyage) where
  // the embedding value is an object containing one or more images.
  return { image: [v] };
};

export const createAiEmbeddingProvider = (
  config: AiEmbeddingConfig = {}
): EmbeddingProvider => {
  const type = (config as any).type ?? "text";
  const model =
    config.model ??
    process.env.AI_GATEWAY_MODEL ??
    (type === "multimodal" ? DEFAULT_MULTIMODAL_MODEL : DEFAULT_TEXT_MODEL);
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
    ...(type === "multimodal"
      ? {
          embedImage: async (input: ImageEmbeddingInput) => {
            const abortSignal = timeoutMs
              ? AbortSignal.timeout(timeoutMs)
              : undefined;

            const imageValue =
              (config as any)?.image?.value?.(input) ?? defaultImageValue(input);

            const result = await embed({
              model,
              value: imageValue,
              ...(abortSignal ? { abortSignal } : {}),
            });

            if (!result.embedding) {
              throw new Error("Embedding missing from AI SDK response");
            }

            return result.embedding;
          },
        }
      : {}),
  };
};


