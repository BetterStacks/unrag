import { generateText, type LanguageModel } from "ai";
import type { AssetExtractor } from "@registry/core/types";
import { getAssetBytes } from "@registry/extractors/_shared/fetch";
import { normalizeMediaType } from "@registry/extractors/_shared/media";
import { capText } from "@registry/extractors/_shared/text";

/**
 * Model reference type that accepts both string gateway IDs and LanguageModel instances.
 */
type ModelRef = string | LanguageModel;

/**
 * Image OCR via a vision-capable LLM.
 *
 * This extractor is intended for screenshots, charts, diagrams, and images with embedded text.
 */
export function createImageOcrExtractor(): AssetExtractor {
  return {
    name: "image:ocr",
    supports: ({ asset, ctx }) =>
      asset.kind === "image" && ctx.assetProcessing.image.ocr.enabled,
    extract: async ({ asset, ctx }) => {
      const cfg = ctx.assetProcessing.image.ocr;
      const fetchConfig = ctx.assetProcessing.fetch;

      const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes);
      const { bytes, mediaType } = await getAssetBytes({
        data: asset.data,
        fetchConfig,
        maxBytes,
        defaultMediaType: "image/jpeg",
      });

      const abortSignal = AbortSignal.timeout(cfg.timeoutMs);

      const result = await generateText({
        model: cfg.model as ModelRef,
        abortSignal,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: cfg.prompt },
              {
                type: "image",
                image: bytes,
                mediaType: normalizeMediaType(mediaType),
              },
            ],
          },
        ],
      });

      const text = (result.text ?? "").trim();
      if (!text) return { texts: [], diagnostics: { model: cfg.model } };

      return {
        texts: [{ label: "ocr", content: capText(text, cfg.maxOutputChars) }],
        diagnostics: { model: cfg.model },
      };
    },
  };
}


