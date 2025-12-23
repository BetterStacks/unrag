import { experimental_transcribe as transcribe } from "ai";
import type { AssetExtractor } from "../../core/types";
import { getAssetBytes } from "../_shared/fetch";

/**
 * Audio transcription via the AI SDK `transcribe()` API.
 */
export function createAudioTranscribeExtractor(): AssetExtractor {
  return {
    name: "audio:transcribe",
    supports: ({ asset, ctx }) =>
      asset.kind === "audio" && ctx.assetProcessing.audio.transcription.enabled,
    extract: async ({ asset, ctx }) => {
      const cfg = ctx.assetProcessing.audio.transcription;
      const fetchConfig = ctx.assetProcessing.fetch;

      const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes);
      const { bytes } = await getAssetBytes({
        data: asset.data,
        fetchConfig,
        maxBytes,
        defaultMediaType: "audio/mpeg",
      });

      const abortSignal = AbortSignal.timeout(cfg.timeoutMs);

      const result = await transcribe({
        model: cfg.model as any,
        audio: bytes,
        abortSignal,
      });

      const segments: any[] = Array.isArray((result as any)?.segments)
        ? (result as any).segments
        : [];

      if (segments.length > 0) {
        return {
          texts: segments
            .map((s, i) => {
              const t = String(s?.text ?? "").trim();
              if (!t) return null;
              const start = Number(s?.startSecond ?? NaN);
              const end = Number(s?.endSecond ?? NaN);
              return {
                label: `segment-${i + 1}`,
                content: t,
                ...(Number.isFinite(start) && Number.isFinite(end)
                  ? { timeRangeSec: [start, end] as [number, number] }
                  : {}),
              };
            })
            .filter(Boolean) as any,
          diagnostics: {
            model: cfg.model,
            seconds:
              typeof (result as any)?.durationInSeconds === "number"
                ? (result as any).durationInSeconds
                : undefined,
          },
        };
      }

      const text = String((result as any)?.text ?? "").trim();
      if (!text) return { texts: [], diagnostics: { model: cfg.model } };

      return {
        texts: [{ label: "transcript", content: text }],
        diagnostics: { model: cfg.model },
      };
    },
  };
}


