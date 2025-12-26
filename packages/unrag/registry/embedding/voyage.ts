import { embed, embedMany } from "ai";
import { voyage } from "voyage-ai-provider";
import type { EmbeddingProvider, ImageEmbeddingInput } from "../core/types";

type BaseConfig = {
  model?: string;
  timeoutMs?: number;
};

export type VoyageEmbeddingConfig =
  | (BaseConfig & {
      type?: "text";
    })
  | (BaseConfig & {
      type: "multimodal";
      text?: {
        value?: (text: string) => unknown;
      };
      image?: {
        value?: (input: ImageEmbeddingInput) => unknown;
      };
    });

const DEFAULT_TEXT_MODEL = "voyage-3.5-lite";
const DEFAULT_MULTIMODAL_MODEL = "voyage-multimodal-3";

const bytesToDataUrl = (bytes: Uint8Array, mediaType: string) => {
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${mediaType};base64,${base64}`;
};

const defaultTextValue = (text: string) => ({ text: [text] });

const defaultImageValue = (input: ImageEmbeddingInput) => {
  const v =
    typeof input.data === "string"
      ? input.data
      : bytesToDataUrl(input.data, input.mediaType ?? "image/jpeg");
  return { image: [v] };
};

export const createVoyageEmbeddingProvider = (
  config: VoyageEmbeddingConfig = {}
): EmbeddingProvider => {
  const type = config.type ?? "text";
  const isMultimodal = config.type === "multimodal";
  const model =
    config.model ??
    process.env.VOYAGE_MODEL ??
    (type === "multimodal" ? DEFAULT_MULTIMODAL_MODEL : DEFAULT_TEXT_MODEL);
  const timeoutMs = config.timeoutMs;

  const embeddingModel =
    type === "multimodal"
      ? voyage.multimodalEmbeddingModel(model)
      : voyage.textEmbeddingModel(model);

  const resolveTextValue = (text: string) => {
    if (isMultimodal && config.text?.value) {
      return config.text.value(text);
    }
    return defaultTextValue(text);
  };

  const resolveImageValue = (input: ImageEmbeddingInput) => {
    if (isMultimodal && config.image?.value) {
      return config.image.value(input);
    }
    return defaultImageValue(input);
  };

  return {
    name: `voyage:${model}`,
    dimensions: undefined,
    embed: async ({ text }) => {
      const abortSignal = timeoutMs
        ? AbortSignal.timeout(timeoutMs)
        : undefined;

      const value = type === "multimodal" ? resolveTextValue(text) : text;

      const result = await embed({
        model: embeddingModel,
        value,
        ...(abortSignal ? { abortSignal } : {}),
      });

      if (!result.embedding) {
        throw new Error("Embedding missing from Voyage response");
      }

      return result.embedding;
    },
    embedMany: async (inputs) => {
      const abortSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
      const values =
        type === "multimodal"
          ? inputs.map((i) => resolveTextValue(i.text))
          : inputs.map((i) => i.text);

      const result = await embedMany({
        model: embeddingModel,
        values,
        ...(abortSignal ? { abortSignal } : {}),
      });

      const { embeddings } = result;
      if (!Array.isArray(embeddings)) {
        throw new Error("Embeddings missing from Voyage embedMany response");
      }
      return embeddings;
    },
    ...(type === "multimodal"
      ? {
          embedImage: async (input: ImageEmbeddingInput) => {
            const abortSignal = timeoutMs
              ? AbortSignal.timeout(timeoutMs)
              : undefined;

            const value = resolveImageValue(input);

            const result = await embed({
              model: embeddingModel,
              value,
              ...(abortSignal ? { abortSignal } : {}),
            });

            if (!result.embedding) {
              throw new Error("Embedding missing from Voyage response");
            }

            return result.embedding;
          },
        }
      : {}),
  };
};
