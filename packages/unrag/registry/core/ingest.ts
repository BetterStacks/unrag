import type {
  AssetInput,
  AssetProcessingConfig,
  AssetProcessingPlanItem,
  IngestPlanResult,
  AssetExtractor,
  AssetExtractorContext,
  Chunk,
  IngestInput,
  IngestResult,
  IngestWarning,
  Metadata,
  ResolvedContextEngineConfig,
} from "./types";
import { mergeDeep } from "./deep-merge";
import { getAssetBytes } from "@registry/extractors/_shared/fetch";
import { getDebugEmitter } from "./debug-emitter";

const now = () => performance.now();

const asMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> => {
  const limit = Math.max(1, Math.floor(concurrency || 1));
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = nextIdx++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]!, i);
    }
  });

  await Promise.all(workers);
  return results;
};

export const ingest = async (
  config: ResolvedContextEngineConfig,
  input: IngestInput
): Promise<IngestResult> => {
  const debug = getDebugEmitter();
  const totalStart = now();
  const chunkingStart = now();

  const storeChunkContent = config.storage.storeChunkContent;
  const storeDocumentContent = config.storage.storeDocumentContent;
  const storedDocumentContent = storeDocumentContent ? input.content : "";

  const chunkingOptions = {
    ...config.defaults,
    ...input.chunking,
  };

  const metadata = input.metadata ?? {};
  const documentId = config.idGenerator();
  const assets: AssetInput[] = Array.isArray(input.assets) ? input.assets : [];

  debug.emit({
    type: "ingest:start",
    sourceId: input.sourceId,
    documentId,
    contentLength: input.content.length,
    assetCount: assets.length,
  });

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
        content: storeChunkContent ? c.content : "",
        tokenCount: storeChunkContent ? c.tokenCount : 0,
        metadata,
        documentContent: storedDocumentContent,
      },
      embed: { kind: "text", text: c.content },
    });
  }

  type PreparedChunkSpec = Omit<Chunk, "id" | "index"> & {
    metadata: Metadata;
    embed:
      | { kind: "text"; text: string }
      | { kind: "image"; data: Uint8Array | string; mediaType?: string; assetId?: string };
    storedContent: string;
    storedTokenCount: number;
  };

  const extractorCtx: AssetExtractorContext = {
    sourceId: input.sourceId,
    documentId,
    documentMetadata: metadata,
    assetProcessing,
  };

  const runExtractors = async (args: {
    asset: AssetInput;
    assetMeta: Metadata;
    assetUri?: string;
    assetMediaType?: string;
    extractors: AssetExtractor[];
    stopOnFirstNonEmpty: boolean;
  }): Promise<{
    specs: PreparedChunkSpec[];
    warnings: IngestWarning[];
    attemptedExtractors: string[];
  }> => {
    const outSpecs: PreparedChunkSpec[] = [];
    const outWarnings: IngestWarning[] = [];
    const attemptedExtractors: string[] = [];

    for (const ex of args.extractors) {
      attemptedExtractors.push(ex.name);
      const start = now();
      assetProcessing.hooks?.onEvent?.({
        type: "extractor:start",
        sourceId: input.sourceId,
        documentId,
        assetId: args.asset.assetId,
        assetKind: args.asset.kind,
        extractor: ex.name,
      });

      try {
        const res = await ex.extract({ asset: args.asset, ctx: extractorCtx });
        const durationMs = now() - start;
        const items = Array.isArray(res?.texts) ? res.texts : [];
        assetProcessing.hooks?.onEvent?.({
          type: "extractor:success",
          sourceId: input.sourceId,
          documentId,
          assetId: args.asset.assetId,
          assetKind: args.asset.kind,
          extractor: ex.name,
          durationMs,
          textItemCount: items.length,
        });

        const nonEmptyItems = items
          .map((t) => ({ ...t, content: (t.content ?? "").toString() }))
          .filter((t) => t.content.trim().length > 0);

        for (const item of nonEmptyItems) {
          const chunks = config.chunker(item.content, chunkingOptions);
          for (const c of chunks) {
            outSpecs.push({
              documentId,
              sourceId: input.sourceId,
              content: storeChunkContent ? c.content : "",
              tokenCount: storeChunkContent ? c.tokenCount : 0,
              documentContent: storedDocumentContent,
              metadata: {
                ...args.assetMeta,
                ...(res?.metadata ?? {}),
                extractor: ex.name,
                extractorLabel: item.label,
                ...(item.confidence !== undefined
                  ? { extractorConfidence: item.confidence }
                  : {}),
                ...(item.pageRange ? { extractorPageRange: item.pageRange } : {}),
                ...(item.timeRangeSec ? { extractorTimeRangeSec: item.timeRangeSec } : {}),
              },
              embed: { kind: "text", text: c.content },
              storedContent: storeChunkContent ? c.content : "",
              storedTokenCount: storeChunkContent ? c.tokenCount : 0,
            });
          }
        }

        if (outSpecs.length > 0 && args.stopOnFirstNonEmpty) {
          break;
        }
      } catch (err) {
        const durationMs = now() - start;
        assetProcessing.hooks?.onEvent?.({
          type: "extractor:error",
          sourceId: input.sourceId,
          documentId,
          assetId: args.asset.assetId,
          assetKind: args.asset.kind,
          extractor: ex.name,
          durationMs,
          errorMessage: asMessage(err),
        });

        if (assetProcessing.onError === "fail") throw err;
        outWarnings.push({
          code: "asset_processing_error",
          message: `Asset processing failed but was skipped due to onError="skip": ${asMessage(err)}`,
          assetId: args.asset.assetId,
          assetKind: args.asset.kind,
          stage: "extract",
          ...(args.assetUri ? { assetUri: args.assetUri } : {}),
          ...(args.assetMediaType ? { assetMediaType: args.assetMediaType } : {}),
        });

        // try next extractor as fallback
      }
    }

    return { specs: outSpecs, warnings: outWarnings, attemptedExtractors };
  };

  const processAsset = async (
    asset: AssetInput
  ): Promise<{ specs: PreparedChunkSpec[]; warnings: IngestWarning[] }> => {
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

    assetProcessing.hooks?.onEvent?.({
      type: "asset:start",
      sourceId: input.sourceId,
      documentId,
      assetId: asset.assetId,
      assetKind: asset.kind,
      ...(assetUri ? { assetUri } : {}),
      ...(assetMediaType ? { assetMediaType } : {}),
    });

    const shouldFailForWarning = (w: IngestWarning): boolean => {
      if (w.code === "asset_processing_error") {
        return assetProcessing.onError === "fail";
      }
      if (w.code === "asset_skipped_pdf_empty_extraction") {
        return assetProcessing.onError === "fail";
      }
      if (w.code === "asset_skipped_extraction_empty") {
        return assetProcessing.onError === "fail";
      }
      return assetProcessing.onUnsupportedAsset === "fail";
    };

    const skip = (w: IngestWarning) => {
      assetProcessing.hooks?.onEvent?.({
        type: "asset:skipped",
        sourceId: input.sourceId,
        documentId,
        ...w,
      });
      if (shouldFailForWarning(w)) {
        throw new Error(w.message);
      }
      return { specs: [], warnings: [w] };
    };

    // Image handling stays in core for now (direct embed or caption fallback).
    if (asset.kind === "image") {
      const caption = (asset.text ?? "").trim();
      const storedCaption = storeChunkContent ? caption : "";
      const storedCaptionTokenCount = storedCaption
        ? storedCaption.split(/\s+/).filter(Boolean).length
        : 0;

      const specs: PreparedChunkSpec[] = [];
      const warnings: IngestWarning[] = [];

      // If provider supports image embedding, ensure URL-based images are fetched server-side
      // using the same guarded fetch policy as extractors (assetProcessing.fetch).
      if (config.embedding.embedImage) {
        let data: Uint8Array;
        let mediaType: string | undefined;

        if (asset.data.kind === "bytes") {
          data = asset.data.bytes;
          mediaType = asset.data.mediaType;
        } else {
          try {
            const fetched = await getAssetBytes({
              data: asset.data,
              fetchConfig: assetProcessing.fetch,
              maxBytes: assetProcessing.fetch.maxBytes,
              defaultMediaType: "image/jpeg",
            });
            data = fetched.bytes;
            mediaType = fetched.mediaType;
          } catch (err) {
            if (assetProcessing.onError === "fail") throw err;

            return skip({
              code: "asset_processing_error",
              message: `Asset processing failed but was skipped due to onError="skip": ${asMessage(err)}`,
              assetId: asset.assetId,
              assetKind: "image",
              stage: "fetch",
              ...(assetUri ? { assetUri } : {}),
              ...(assetMediaType ? { assetMediaType } : {}),
            });
          }
        }

        specs.push({
          documentId,
          sourceId: input.sourceId,
          content: storedCaption,
          tokenCount: storedCaptionTokenCount,
          metadata: { ...assetMeta, extractor: "image:embed" },
          documentContent: storedDocumentContent,
          embed: { kind: "image", data, mediaType, assetId: asset.assetId },
          storedContent: storedCaption,
          storedTokenCount: storedCaptionTokenCount,
        });
      } else if (caption) {
        const captionChunks = config.chunker(caption, chunkingOptions);
        for (const c of captionChunks) {
          specs.push({
            documentId,
            sourceId: input.sourceId,
            content: storeChunkContent ? c.content : "",
            tokenCount: storeChunkContent ? c.tokenCount : 0,
            metadata: { ...assetMeta, extractor: "image:caption" },
            documentContent: storedDocumentContent,
            embed: { kind: "text", text: c.content },
            storedContent: storeChunkContent ? c.content : "",
            storedTokenCount: storeChunkContent ? c.tokenCount : 0,
          });
        }
      }

      const matching = config.extractors.filter((ex) =>
        ex.supports({ asset, ctx: extractorCtx })
      );

      if (matching.length > 0) {
        const r = await runExtractors({
          asset,
          assetMeta,
          assetUri,
          assetMediaType,
          extractors: matching,
          stopOnFirstNonEmpty: true,
        });
        specs.push(...r.specs);
        warnings.push(...r.warnings);
      }

      if (specs.length > 0) {
        return { specs, warnings };
      }

      return skip({
        code: "asset_skipped_image_no_multimodal_and_no_caption",
        message:
          "Image skipped because embedding provider does not support embedImage(), assets[].text (caption/alt) is empty, and no enabled image extractors are configured.",
        assetId: asset.assetId,
        assetKind: "image",
        ...(assetUri ? { assetUri } : {}),
        ...(assetMediaType ? { assetMediaType } : {}),
      });
    }

    // PDF handling uses extractors when enabled.
    if (asset.kind === "pdf") {
      const matching = config.extractors.filter((ex) =>
        ex.supports({ asset, ctx: extractorCtx })
      );
      if (matching.length === 0) {
        // If ALL configured PDF extraction approaches are disabled, emit a specific warning.
        if (
          !assetProcessing.pdf.llmExtraction.enabled &&
          !assetProcessing.pdf.textLayer.enabled &&
          !assetProcessing.pdf.ocr.enabled
        ) {
          return skip({
            code: "asset_skipped_pdf_llm_extraction_disabled",
            message:
              "PDF skipped because no PDF extraction strategy is enabled (assetProcessing.pdf.*.enabled are all false).",
            assetId: asset.assetId,
            assetKind: "pdf",
            ...(assetUri ? { assetUri } : {}),
            ...(assetMediaType ? { assetMediaType } : {}),
          });
        }

        return skip({
          code: "asset_skipped_unsupported_kind",
          message:
            'PDF extraction is enabled but no installed extractor supports this asset. Install/configure a PDF extractor module (e.g. "pdf-llm", "pdf-text-layer").',
          assetId: asset.assetId,
          assetKind: "pdf",
          ...(assetUri ? { assetUri } : {}),
          ...(assetMediaType ? { assetMediaType } : {}),
        });
      }

      const { specs, warnings: w } = await runExtractors({
        asset,
        assetMeta,
        assetUri,
        assetMediaType,
        extractors: matching,
        stopOnFirstNonEmpty: true,
      });

      if (specs.length === 0) {
        return skip({
          code: "asset_skipped_pdf_empty_extraction",
          message:
            "PDF extraction returned empty text. The PDF may be scanned/image-only or the extractor failed to extract readable content.",
          assetId: asset.assetId,
          assetKind: "pdf",
          ...(assetUri ? { assetUri } : {}),
          ...(assetMediaType ? { assetMediaType } : {}),
        });
      }

      return { specs, warnings: w };
    }

    // Audio/video/file: attempt extractors if any, otherwise treat as unsupported.
    const matching = config.extractors.filter((ex) =>
      ex.supports({ asset, ctx: extractorCtx })
    );
    if (matching.length === 0) {
      // Distinguish \"disabled by config\" vs \"no extractor installed\".
      const disabledByConfig =
        (asset.kind === "audio" && !assetProcessing.audio.transcription.enabled) ||
        (asset.kind === "video" &&
          !assetProcessing.video.transcription.enabled &&
          !assetProcessing.video.frames.enabled) ||
        (asset.kind === "file" &&
          !assetProcessing.file.text.enabled &&
          !assetProcessing.file.docx.enabled &&
          !assetProcessing.file.pptx.enabled &&
          !assetProcessing.file.xlsx.enabled);

      if (disabledByConfig) {
        return skip({
          code: "asset_skipped_extraction_disabled",
          message: `Asset skipped because extraction for kind "${asset.kind}" is disabled by config.`,
          assetId: asset.assetId,
          assetKind: asset.kind,
          ...(assetUri ? { assetUri } : {}),
          ...(assetMediaType ? { assetMediaType } : {}),
        });
      }

      return skip({
        code: "asset_skipped_unsupported_kind",
        message: `Asset skipped because kind "${asset.kind}" is not supported by the built-in pipeline.`,
        assetId: asset.assetId,
        assetKind: asset.kind,
        ...(assetUri ? { assetUri } : {}),
        ...(assetMediaType ? { assetMediaType } : {}),
      });
    }

    const { specs, warnings: w } = await runExtractors({
      asset,
      assetMeta,
      assetUri,
      assetMediaType,
      extractors: matching,
      stopOnFirstNonEmpty: true,
    });

    if (specs.length === 0) {
      return skip({
        code: "asset_skipped_extraction_empty",
        message:
          "All configured extractors returned empty text outputs for this asset.",
        assetId: asset.assetId,
        assetKind: asset.kind,
        ...(assetUri ? { assetUri } : {}),
        ...(assetMediaType ? { assetMediaType } : {}),
      });
    }

    return { specs, warnings: w };
  };

  const assetResults = await mapWithConcurrency(
    assets,
    assetProcessing.concurrency,
    async (asset) => processAsset(asset)
  );

  let nextIndex = baseTextChunks.length;
  for (const r of assetResults) {
    for (let i = 0; i < r.specs.length; i++) {
      const spec = r.specs[i]!;
      prepared.push({
        chunk: {
          id: config.idGenerator(),
          documentId: spec.documentId,
          sourceId: spec.sourceId,
          index: nextIndex++,
          content: spec.storedContent,
          tokenCount: spec.storedTokenCount,
          metadata: spec.metadata,
          documentContent: spec.documentContent,
        },
        embed: spec.embed,
      });
    }
    warnings.push(...r.warnings);
  }

  const chunkingMs = now() - chunkingStart;

  debug.emit({
    type: "ingest:chunking-complete",
    sourceId: input.sourceId,
    documentId,
    chunkCount: prepared.length,
    durationMs: chunkingMs,
  });

  const embeddingStart = now();

  debug.emit({
    type: "ingest:embedding-start",
    sourceId: input.sourceId,
    documentId,
    chunkCount: prepared.length,
    embeddingProvider: config.embedding.name,
  });

  const embeddedChunks: Chunk[] = new Array(prepared.length);

  const textSpecs: Array<{
    idx: number;
    chunk: Chunk;
    input: {
      text: string;
      metadata: Metadata;
      position: number;
      sourceId: string;
      documentId: string;
    };
  }> = [];

  const imageSpecs: Array<{
    idx: number;
    chunk: Chunk;
    input: {
      data: Uint8Array | string;
      mediaType?: string;
      metadata: Metadata;
      position: number;
      sourceId: string;
      documentId: string;
      assetId?: string;
    };
  }> = [];

  for (let i = 0; i < prepared.length; i++) {
    const { chunk, embed } = prepared[i]!;
    if (embed.kind === "image") {
      imageSpecs.push({
        idx: i,
        chunk,
        input: {
          data: embed.data,
          mediaType: embed.mediaType,
          metadata: chunk.metadata,
          position: chunk.index,
          sourceId: chunk.sourceId,
          documentId: chunk.documentId,
          assetId: embed.assetId,
        },
      });
      continue;
    }

    textSpecs.push({
      idx: i,
      chunk,
      input: {
        text: embed.text,
        metadata: chunk.metadata,
        position: chunk.index,
        sourceId: chunk.sourceId,
        documentId: chunk.documentId,
      },
    });
  }

  const concurrency = config.embeddingProcessing.concurrency;

  // Text embeddings (prefer batch when supported).
  if (textSpecs.length > 0) {
    const embedMany = config.embedding.embedMany;
    if (embedMany) {
      const batchSize = Math.max(1, Math.floor(config.embeddingProcessing.batchSize || 1));
      const batches: Array<typeof textSpecs> = [];
      for (let i = 0; i < textSpecs.length; i += batchSize) {
        batches.push(textSpecs.slice(i, i + batchSize));
      }

      const batchEmbeddings = await mapWithConcurrency(
        batches,
        concurrency,
        async (batch, batchIndex) => {
          const batchStart = now();
          const embeddings = await embedMany(batch.map((b) => b.input));
          if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
            throw new Error(
              `embedMany() returned ${Array.isArray(embeddings) ? embeddings.length : "non-array"} embeddings for a batch of ${batch.length}`
            );
          }
          debug.emit({
            type: "ingest:embedding-batch",
            sourceId: input.sourceId,
            documentId,
            batchIndex,
            batchSize: batch.length,
            durationMs: now() - batchStart,
          });
          return embeddings;
        }
      );

      let batchIdx = 0;
      for (const batch of batches) {
        const embeddings = batchEmbeddings[batchIdx++]!;
        for (let i = 0; i < batch.length; i++) {
          const spec = batch[i]!;
          embeddedChunks[spec.idx] = { ...spec.chunk, embedding: embeddings[i]! };
        }
      }
    } else {
      const embeddings = await mapWithConcurrency(textSpecs, concurrency, async (spec) =>
        config.embedding.embed(spec.input)
      );
      for (let i = 0; i < textSpecs.length; i++) {
        const spec = textSpecs[i]!;
        embeddedChunks[spec.idx] = { ...spec.chunk, embedding: embeddings[i]! };
      }
    }
  }

  // Image embeddings (bounded concurrency).
  if (imageSpecs.length > 0) {
    const embedImage = config.embedding.embedImage;
    if (!embedImage) {
      throw new Error("Image embedding requested but provider does not support embedImage()");
    }

    const embeddings = await mapWithConcurrency(imageSpecs, concurrency, async (spec) =>
      embedImage(spec.input)
    );
    for (let i = 0; i < imageSpecs.length; i++) {
      const spec = imageSpecs[i]!;
      embeddedChunks[spec.idx] = { ...spec.chunk, embedding: embeddings[i]! };
    }
  }

  // Safety check: ensure all chunks got an embedding.
  for (let i = 0; i < embeddedChunks.length; i++) {
    if (!embeddedChunks[i]) {
      throw new Error("Internal error: missing embedding for one or more chunks");
    }
  }

  const embeddingMs = now() - embeddingStart;

  debug.emit({
    type: "ingest:embedding-complete",
    sourceId: input.sourceId,
    documentId,
    totalEmbeddings: embeddedChunks.length,
    durationMs: embeddingMs,
  });

  const storageStart = now();

  const { documentId: canonicalDocumentId } = await config.store.upsert(embeddedChunks);

  const storageMs = now() - storageStart;

  debug.emit({
    type: "ingest:storage-complete",
    sourceId: input.sourceId,
    documentId: canonicalDocumentId,
    chunksStored: embeddedChunks.length,
    durationMs: storageMs,
  });

  const totalMs = now() - totalStart;

  debug.emit({
    type: "ingest:complete",
    sourceId: input.sourceId,
    documentId: canonicalDocumentId,
    totalChunks: embeddedChunks.length,
    totalDurationMs: totalMs,
    warnings: warnings.map((w) => w.message),
  });

  return {
    documentId: canonicalDocumentId,
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

/**
 * Dry-run for ingestion. Returns which assets would be processed and why,
 * without calling external services or writing to the store.
 */
export const planIngest = async (
  config: ResolvedContextEngineConfig,
  input: IngestInput
): Promise<IngestPlanResult> => {
  const documentId = config.idGenerator();
  const metadata = input.metadata ?? {};

  const assetProcessing: AssetProcessingConfig = mergeDeep(
    config.assetProcessing,
    input.assetProcessing
  );

  const assets: AssetInput[] = Array.isArray(input.assets) ? input.assets : [];
  const warnings: IngestWarning[] = [];
  const plan: AssetProcessingPlanItem[] = [];

  for (const asset of assets) {
    const assetUri =
      asset.uri ?? (asset.data.kind === "url" ? asset.data.url : undefined);
    const assetMediaType =
      asset.data.kind === "bytes" ? asset.data.mediaType : asset.data.mediaType;

    const emit = (w: IngestWarning) => {
      warnings.push(w);
      assetProcessing.hooks?.onEvent?.({
        type: "asset:skipped",
        sourceId: input.sourceId,
        documentId,
        ...w,
      });
    };

    assetProcessing.hooks?.onEvent?.({
      type: "asset:start",
      sourceId: input.sourceId,
      documentId,
      assetId: asset.assetId,
      assetKind: asset.kind,
      ...(assetUri ? { assetUri } : {}),
      ...(assetMediaType ? { assetMediaType } : {}),
    });

    const extractorCtx: AssetExtractorContext = {
      sourceId: input.sourceId,
      documentId,
      documentMetadata: metadata,
      assetProcessing,
    };

    const matchingExtractors = config.extractors.filter((ex) =>
      ex.supports({ asset, ctx: extractorCtx })
    );

    if (asset.kind === "pdf") {
      if (matchingExtractors.length === 0) {
        if (
          !assetProcessing.pdf.llmExtraction.enabled &&
          !assetProcessing.pdf.textLayer.enabled &&
          !assetProcessing.pdf.ocr.enabled
        ) {
          emit({
            code: "asset_skipped_pdf_llm_extraction_disabled",
            message:
              "PDF would be skipped because no PDF extraction strategy is enabled (assetProcessing.pdf.*.enabled are all false).",
            assetId: asset.assetId,
            assetKind: "pdf",
            ...(assetUri ? { assetUri } : {}),
            ...(assetMediaType ? { assetMediaType } : {}),
          });
          plan.push({
            assetId: asset.assetId,
            kind: asset.kind,
            uri: asset.uri,
            status: "will_skip",
            reason: "asset_skipped_pdf_llm_extraction_disabled",
          });
          continue;
        }

        emit({
          code: "asset_skipped_unsupported_kind",
          message:
            'PDF extraction is enabled but no installed extractor supports this asset. Install/configure a PDF extractor module (e.g. "pdf-llm", "pdf-text-layer").',
          assetId: asset.assetId,
          assetKind: "pdf",
          ...(assetUri ? { assetUri } : {}),
          ...(assetMediaType ? { assetMediaType } : {}),
        });
        plan.push({
          assetId: asset.assetId,
          kind: asset.kind,
          uri: asset.uri,
          status: "will_skip",
          reason: "asset_skipped_unsupported_kind",
        });
        continue;
      }

      plan.push({
        assetId: asset.assetId,
        kind: asset.kind,
        uri: asset.uri,
        status: "will_process",
        extractors: matchingExtractors.map((e) => e.name),
      });
      continue;
    }

    if (asset.kind === "image") {
      const extractors: string[] = [];
      if (config.embedding.embedImage) {
        extractors.push("image:embed");
      } else {
        const caption = (asset.text ?? "").trim();
        if (caption) {
          extractors.push("image:caption");
        }
      }

      extractors.push(...matchingExtractors.map((e) => e.name));

      if (extractors.length > 0) {
        plan.push({
          assetId: asset.assetId,
          kind: asset.kind,
          uri: asset.uri,
          status: "will_process",
          extractors,
        });
        continue;
      }

      emit({
        code: "asset_skipped_image_no_multimodal_and_no_caption",
        message:
          "Image would be skipped because embedding provider does not support embedImage(), assets[].text is empty, and no enabled image extractors are configured.",
        assetId: asset.assetId,
        assetKind: "image",
        ...(assetUri ? { assetUri } : {}),
        ...(assetMediaType ? { assetMediaType } : {}),
      });
      plan.push({
        assetId: asset.assetId,
        kind: asset.kind,
        uri: asset.uri,
        status: "will_skip",
        reason: "asset_skipped_image_no_multimodal_and_no_caption",
      });
      continue;
    }

    if (matchingExtractors.length === 0) {
      const disabledByConfig =
        (asset.kind === "audio" && !assetProcessing.audio.transcription.enabled) ||
        (asset.kind === "video" &&
          !assetProcessing.video.transcription.enabled &&
          !assetProcessing.video.frames.enabled) ||
        (asset.kind === "file" &&
          !assetProcessing.file.text.enabled &&
          !assetProcessing.file.docx.enabled &&
          !assetProcessing.file.pptx.enabled &&
          !assetProcessing.file.xlsx.enabled);

      if (disabledByConfig) {
        emit({
          code: "asset_skipped_extraction_disabled",
          message: `Asset would be skipped because extraction for kind "${asset.kind}" is disabled by config.`,
          assetId: asset.assetId,
          assetKind: asset.kind,
          ...(assetUri ? { assetUri } : {}),
          ...(assetMediaType ? { assetMediaType } : {}),
        });
        plan.push({
          assetId: asset.assetId,
          kind: asset.kind,
          uri: asset.uri,
          status: "will_skip",
          reason: "asset_skipped_extraction_disabled",
        });
        continue;
      }

      emit({
        code: "asset_skipped_unsupported_kind",
        message: `Asset would be skipped because kind "${asset.kind}" is not supported by the built-in pipeline.`,
        assetId: asset.assetId,
        assetKind: asset.kind,
        ...(assetUri ? { assetUri } : {}),
        ...(assetMediaType ? { assetMediaType } : {}),
      });
      plan.push({
        assetId: asset.assetId,
        kind: asset.kind,
        uri: asset.uri,
        status: "will_skip",
        reason: "asset_skipped_unsupported_kind",
      });
      continue;
    }

    plan.push({
      assetId: asset.assetId,
      kind: asset.kind,
      uri: asset.uri,
      status: "will_process",
      extractors: matchingExtractors.map((e) => e.name),
    });
  }

  return {
    documentId,
    sourceId: input.sourceId,
    assets: plan,
    warnings,
  };
};


