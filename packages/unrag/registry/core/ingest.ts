import type {
  AssetInput,
  AssetProcessingConfig,
  Chunk,
  IngestInput,
  IngestResult,
  IngestWarning,
  ResolvedContextEngineConfig,
} from "./types";
import { extractPdfTextWithLlm } from "./pdf-llm";

const now = () => performance.now();

const mergeDeep = <T extends Record<string, any>>(
  base: T,
  overrides: any | undefined
): T => {
  if (!overrides) return base;
  const out: any = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(overrides)) {
    const nextVal = overrides[key];
    if (nextVal === undefined) continue;
    const baseVal = (base as any)[key];
    if (
      baseVal &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal) &&
      nextVal &&
      typeof nextVal === "object" &&
      !Array.isArray(nextVal)
    ) {
      out[key] = mergeDeep(baseVal, nextVal);
    } else {
      out[key] = nextVal;
    }
  }
  return out as T;
};

const asMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
};

export const ingest = async (
  config: ResolvedContextEngineConfig,
  input: IngestInput
): Promise<IngestResult> => {
  const totalStart = now();
  const chunkingStart = now();

  const chunkingOptions = {
    ...config.defaults,
    ...input.chunking,
  };

  const metadata = input.metadata ?? {};
  const documentId = config.idGenerator();

  const assetProcessing: AssetProcessingConfig = mergeDeep(
    config.assetProcessing,
    input.assetProcessing
  );

  type PreparedChunk = {
    chunk: Chunk;
    embed:
      | { kind: "text"; text: string }
      | { kind: "image"; data: Uint8Array | string; mediaType?: string; assetId?: string };
  };

  const prepared: PreparedChunk[] = [];
  const warnings: IngestWarning[] = [];

  const baseTextChunks = config.chunker(input.content, chunkingOptions);
  for (const c of baseTextChunks) {
    prepared.push({
      chunk: {
        id: config.idGenerator(),
        documentId,
        sourceId: input.sourceId,
        index: c.index,
        content: c.content,
        tokenCount: c.tokenCount,
        metadata,
        documentContent: input.content,
      },
      embed: { kind: "text", text: c.content },
    });
  }

  const assets: AssetInput[] = Array.isArray(input.assets) ? input.assets : [];
  let nextIndex = baseTextChunks.length;

  for (const asset of assets) {
    const assetUri =
      asset.uri ?? (asset.data.kind === "url" ? asset.data.url : undefined);
    const assetMediaType =
      asset.data.kind === "bytes" ? asset.data.mediaType : asset.data.mediaType;

    const assetMeta = {
      ...metadata,
      ...(asset.metadata ?? {}),
      assetKind: asset.kind,
      assetId: asset.assetId,
      ...(assetUri ? { assetUri } : {}),
      ...(assetMediaType ? { assetMediaType } : {}),
    };

    if (asset.kind === "pdf") {
      if (!assetProcessing.pdf.llmExtraction.enabled) {
        if (assetProcessing.onUnsupportedAsset === "fail") {
          throw new Error(
            "PDF encountered but pdf.llmExtraction is disabled (enable assetProcessing.pdf.llmExtraction.enabled)"
          );
        }
        warnings.push({
          code: "asset_skipped_pdf_llm_extraction_disabled",
          message:
            "PDF skipped because assetProcessing.pdf.llmExtraction.enabled is false. Enable it to extract and embed PDF text.",
          assetId: asset.assetId,
          assetKind: "pdf",
          ...(assetUri ? { assetUri } : {}),
          ...(assetMediaType ? { assetMediaType } : {}),
        });
        continue;
      }

      try {
        const extracted = await extractPdfTextWithLlm({
          data: asset.data,
          metadata: assetMeta,
          fetchConfig: assetProcessing.fetch,
          llm: assetProcessing.pdf.llmExtraction,
        });

        if (!extracted.trim()) {
          warnings.push({
            code: "asset_skipped_pdf_empty_extraction",
            message:
              "PDF extraction returned empty text. The PDF may be scanned/image-only or the model failed to extract readable content.",
            assetId: asset.assetId,
            assetKind: "pdf",
            ...(assetUri ? { assetUri } : {}),
            ...(assetMediaType ? { assetMediaType } : {}),
          });
          continue;
        }

        const pdfChunks = config.chunker(extracted, chunkingOptions);
        for (const c of pdfChunks) {
          prepared.push({
            chunk: {
              id: config.idGenerator(),
              documentId,
              sourceId: input.sourceId,
              index: nextIndex + c.index,
              content: c.content,
              tokenCount: c.tokenCount,
              metadata: { ...assetMeta, extractor: "pdf:llm" },
              documentContent: input.content,
            },
            embed: { kind: "text", text: c.content },
          });
        }
        nextIndex += pdfChunks.length;
      } catch (err) {
        if (assetProcessing.onError === "fail") throw err;
        warnings.push({
          code: "asset_processing_error",
          message: `PDF processing failed but was skipped due to onError="skip": ${asMessage(err)}`,
          assetId: asset.assetId,
          assetKind: "pdf",
          stage: "extract",
          ...(assetUri ? { assetUri } : {}),
          ...(assetMediaType ? { assetMediaType } : {}),
        });
      }

      continue;
    }

    if (asset.kind === "image") {
      // If we can't embed the image bytes/URL directly, fall back to caption text (if present).
      const caption = (asset.text ?? "").trim();

      if (config.embedding.embedImage) {
        const data =
          asset.data.kind === "bytes" ? asset.data.bytes : asset.data.url;
        const mediaType =
          asset.data.kind === "bytes"
            ? asset.data.mediaType
            : asset.data.mediaType;

        prepared.push({
          chunk: {
            id: config.idGenerator(),
            documentId,
            sourceId: input.sourceId,
            index: nextIndex,
            content: caption,
            tokenCount: caption ? caption.split(/\s+/).filter(Boolean).length : 0,
            metadata: { ...assetMeta, extractor: "image:embed" },
            documentContent: input.content,
          },
          embed: { kind: "image", data, mediaType, assetId: asset.assetId },
        });
        nextIndex += 1;
        continue;
      }

      if (caption) {
        const captionChunks = config.chunker(caption, chunkingOptions);
        for (const c of captionChunks) {
          prepared.push({
            chunk: {
              id: config.idGenerator(),
              documentId,
              sourceId: input.sourceId,
              index: nextIndex + c.index,
              content: c.content,
              tokenCount: c.tokenCount,
              metadata: { ...assetMeta, extractor: "image:caption" },
              documentContent: input.content,
            },
            embed: { kind: "text", text: c.content },
          });
        }
        nextIndex += captionChunks.length;
      } else {
        warnings.push({
          code: "asset_skipped_image_no_multimodal_and_no_caption",
          message:
            "Image skipped because embedding provider does not support embedImage() and assets[].text (caption/alt) is empty.",
          assetId: asset.assetId,
          assetKind: "image",
          ...(assetUri ? { assetUri } : {}),
          ...(assetMediaType ? { assetMediaType } : {}),
        });
      }

      continue;
    }

    // Audio/video/file are not extracted in this plan.
    if (assetProcessing.onUnsupportedAsset === "fail") {
      throw new Error(`Unsupported asset kind: ${asset.kind}`);
    }
    warnings.push({
      code: "asset_skipped_unsupported_kind",
      message: `Asset skipped because kind "${asset.kind}" is not supported by the built-in pipeline.`,
      assetId: asset.assetId,
      assetKind: asset.kind,
      ...(assetUri ? { assetUri } : {}),
      ...(assetMediaType ? { assetMediaType } : {}),
    });
  }

  const chunkingMs = now() - chunkingStart;
  const embeddingStart = now();

  const embeddedChunks = await Promise.all(
    prepared.map(async ({ chunk, embed }) => {
      if (embed.kind === "image") {
        const embedImage = config.embedding.embedImage;
        if (!embedImage) {
          throw new Error("Image embedding requested but provider does not support embedImage()");
        }
        const embedding = await embedImage({
          data: embed.data,
          mediaType: embed.mediaType,
          metadata: chunk.metadata,
          position: chunk.index,
          sourceId: chunk.sourceId,
          documentId: chunk.documentId,
          assetId: embed.assetId,
        });
        return { ...chunk, embedding };
      }

      const embedding = await config.embedding.embed({
        text: embed.text,
        metadata: chunk.metadata,
        position: chunk.index,
        sourceId: chunk.sourceId,
        documentId: chunk.documentId,
      });

      return { ...chunk, embedding };
    })
  );

  const embeddingMs = now() - embeddingStart;
  const storageStart = now();

  await config.store.upsert(embeddedChunks);

  const storageMs = now() - storageStart;
  const totalMs = now() - totalStart;

  return {
    documentId,
    chunkCount: embeddedChunks.length,
    embeddingModel: config.embedding.name,
    warnings,
    durations: {
      totalMs,
      chunkingMs,
      embeddingMs,
      storageMs,
    },
  };
};


