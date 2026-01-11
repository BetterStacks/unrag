import { embed, embedMany, type EmbeddingModel } from "ai";
import type { EmbeddingProvider, ImageEmbeddingInput } from "../core/types";
import { requireOptional } from "./_shared";

/**
 * Voyage AI provider module interface.
 */
interface VoyageModule {
  voyage: {
    embeddingModel?: (model: string) => EmbeddingModel;
    textEmbeddingModel?: (model: string) => EmbeddingModel;
    multimodalEmbeddingModel?: (model: string) => EmbeddingModel<unknown>;
  };
}

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

const defaultTextValue = (text: string) => ({
  text: [text],
});

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
  const { voyage } = requireOptional<VoyageModule>({
    id: "voyage-ai-provider",
    installHint: "bun add voyage-ai-provider",
    providerName: "voyage",
  });
  const type = config.type ?? "text";
  const isMultimodal = config.type === "multimodal";
  const model =
    config.model ??
    process.env.VOYAGE_MODEL ??
    (type === "multimodal" ? DEFAULT_MULTIMODAL_MODEL : DEFAULT_TEXT_MODEL);
  const timeoutMs = config.timeoutMs;

  const textEmbeddingModel =
    type === "multimodal"
      ? undefined
      : typeof voyage.embeddingModel === "function"
        ? voyage.embeddingModel(model)
        : voyage.textEmbeddingModel?.(model);
  const multimodalEmbeddingModel =
    type === "multimodal" ? voyage.multimodalEmbeddingModel?.(model) : undefined;

  // AI SDK 6 types only accept string inputs; cast multimodal models/values.
  const multimodalModel = multimodalEmbeddingModel as unknown as EmbeddingModel;

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

      const result =
        type === "multimodal"
          ? await embed({
              model: multimodalModel,
              value: resolveTextValue(text) as unknown as string,
              ...(abortSignal ? { abortSignal } : {}),
            })
          : await embed({
              model: textEmbeddingModel!,
              value: text,
              ...(abortSignal ? { abortSignal } : {}),
            });

      if (!result.embedding) {
        throw new Error("Embedding missing from Voyage response");
      }

      return result.embedding;
    },
    embedMany: async (inputs) => {
      const abortSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
      const result =
        type === "multimodal"
          ? await embedMany({
              model: multimodalModel,
              values: inputs.map((i) => resolveTextValue(i.text)) as unknown as string[],
              ...(abortSignal ? { abortSignal } : {}),
            })
          : await embedMany({
              model: textEmbeddingModel!,
              values: inputs.map((i) => i.text),
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
              model: multimodalModel,
              value: value as unknown as string,
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
