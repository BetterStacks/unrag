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
  ResolvedContextEngineConfig,
} from "./types";

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

  const assets: AssetInput[] = Array.isArray(input.assets) ? input.assets : [];
  type PreparedChunkSpec = Omit<Chunk, "id" | "index"> & {
    metadata: Record<string, any>;
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
    assetMeta: Record<string, any>;
    assetUri?: string;
    assetMediaType?: string;
    extractors: AssetExtractor[];
    stopOnFirstNonEmpty: boolean;
  }): Promise<{ specs: PreparedChunkSpec[]; warnings: IngestWarning[] }> => {
    const outSpecs: PreparedChunkSpec[] = [];
    const outWarnings: IngestWarning[] = [];

    for (const ex of args.extractors) {
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
                extractor: ex.name,
                extractorLabel: item.label,
                ...(item.confidence !== undefined
                  ? { extractorConfidence: item.confidence }
                  : {}),
                ...(item.pageRange ? { extractorPageRange: item.pageRange } : {}),
                ...(item.timeRangeSec ? { extractorTimeRangeSec: item.timeRangeSec } : {}),
                ...(res?.metadata ? { extractorMeta: res.metadata } : {}),
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

    return { specs: outSpecs, warnings: outWarnings };
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

      if (config.embedding.embedImage) {
        const data =
          asset.data.kind === "bytes" ? asset.data.bytes : asset.data.url;
        const mediaType =
          asset.data.kind === "bytes"
            ? asset.data.mediaType
            : asset.data.mediaType;

        return {
          specs: [
            {
              documentId,
              sourceId: input.sourceId,
              content: storedCaption,
              tokenCount: storedCaptionTokenCount,
              metadata: { ...assetMeta, extractor: "image:embed" },
              documentContent: storedDocumentContent,
              embed: { kind: "image", data, mediaType, assetId: asset.assetId },
              storedContent: storedCaption,
              storedTokenCount: storedCaptionTokenCount,
            },
          ],
          warnings: [],
        };
      }

      if (caption) {
        const captionChunks = config.chunker(caption, chunkingOptions);
        const specs: PreparedChunkSpec[] = captionChunks.map((c) => ({
          documentId,
          sourceId: input.sourceId,
          content: storeChunkContent ? c.content : "",
          tokenCount: storeChunkContent ? c.tokenCount : 0,
          metadata: { ...assetMeta, extractor: "image:caption" },
          documentContent: storedDocumentContent,
          embed: { kind: "text", text: c.content },
          storedContent: storeChunkContent ? c.content : "",
          storedTokenCount: storeChunkContent ? c.tokenCount : 0,
        }));
        return { specs, warnings: [] };
      }

      return skip({
        code: "asset_skipped_image_no_multimodal_and_no_caption",
        message:
          "Image skipped because embedding provider does not support embedImage() and assets[].text (caption/alt) is empty.",
        assetId: asset.assetId,
        assetKind: "image",
        ...(assetUri ? { assetUri } : {}),
        ...(assetMediaType ? { assetMediaType } : {}),
      });
    }

    // PDF handling uses extractors when enabled.
    if (asset.kind === "pdf") {
      if (!assetProcessing.pdf.llmExtraction.enabled) {
        return skip({
          code: "asset_skipped_pdf_llm_extraction_disabled",
          message:
            "PDF skipped because assetProcessing.pdf.llmExtraction.enabled is false. Enable it and install/configure a PDF extractor to extract and embed PDF text.",
          assetId: asset.assetId,
          assetKind: "pdf",
          ...(assetUri ? { assetUri } : {}),
          ...(assetMediaType ? { assetMediaType } : {}),
        });
      }

      const matching = config.extractors.filter((ex) =>
        ex.supports({ asset, ctx: extractorCtx })
      );
      if (matching.length === 0) {
        return skip({
          code: "asset_skipped_unsupported_kind",
          message:
            'PDF extraction is enabled but no installed extractor supports this asset. Install/configure a PDF extractor module (e.g. "pdf-llm").',
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
        code: "asset_processing_error",
        message: "All configured extractors returned empty text outputs for this asset.",
        assetId: asset.assetId,
        assetKind: asset.kind,
        stage: "extract",
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
      if (!assetProcessing.pdf.llmExtraction.enabled) {
        emit({
          code: "asset_skipped_pdf_llm_extraction_disabled",
          message:
            "PDF would be skipped because assetProcessing.pdf.llmExtraction.enabled is false.",
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

      if (matchingExtractors.length === 0) {
        emit({
          code: "asset_skipped_unsupported_kind",
          message:
            'PDF extraction is enabled but no installed extractor supports this asset. Install/configure a PDF extractor module (e.g. "pdf-llm").',
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
      if (config.embedding.embedImage) {
        plan.push({
          assetId: asset.assetId,
          kind: asset.kind,
          uri: asset.uri,
          status: "will_process",
          extractors: ["image:embed"],
        });
        continue;
      }

      const caption = (asset.text ?? "").trim();
      if (!caption) {
        emit({
          code: "asset_skipped_image_no_multimodal_and_no_caption",
          message:
            "Image would be skipped because embedding provider does not support embedImage() and assets[].text is empty.",
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

      plan.push({
        assetId: asset.assetId,
        kind: asset.kind,
        uri: asset.uri,
        status: "will_process",
        extractors: ["image:caption"],
      });
      continue;
    }

    if (matchingExtractors.length === 0) {
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


