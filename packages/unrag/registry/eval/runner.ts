import type { AssetInput, Metadata } from "@registry/core/types";
import type { ContextEngine } from "@registry/core/context-engine";

import {
  readEvalDatasetFromFile,
  type EvalDatasetV1,
  type EvalMode,
  type EvalThresholds,
} from "@registry/eval/dataset";
import {
  computeMetricsAtK,
  uniqueSourceIdsInOrder,
  type EvalMetricsAtK,
} from "@registry/eval/metrics";
import {
  percentiles,
  type EvalCleanupPolicy,
  type EvalQueryResult,
  type EvalReportV1,
} from "@registry/eval/report";

export type EvalRunArgs = {
  engine: ContextEngine;
  datasetPath: string;
  /** Overrides dataset defaults. */
  mode?: EvalMode;
  /** Overrides dataset defaults. */
  topK?: number;
  /**
   * In `retrieve+rerank` mode, overrides dataset `defaults.rerankTopK`.
   * If omitted, the runner will default to `topK * 3` per query (clamped to at least `topK`).
   */
  rerankTopK?: number;
  /** Overrides dataset defaults. */
  scopePrefix?: string;
  /** If true, ingest dataset documents before running queries (default: true when dataset has documents). */
  ingest?: boolean;
  cleanup?: EvalCleanupPolicy;
  includeNdcg?: boolean;
  /**
   * Allow documents[].assets and pass them through to `engine.ingest`.
   * Default false because URL-based assets introduce network variance / SSRF risks.
   */
  allowAssets?: boolean;
  /**
   * Safety guardrail: scope prefixes should usually be namespaced as `eval:...`.
   * When false, non-eval prefixes are rejected.
   */
  allowNonEvalPrefix?: boolean;
  /**
   * Safety guardrail: when deleting a non-eval prefix, require explicit confirmation.
   * (The generated script will only set this true for non-interactive `--yes` runs.)
   */
  confirmedDangerousDelete?: boolean;
  /** Optional baseline report loaded by the caller (diffing lives outside runner core). */
  baselineReportPath?: string;
  /** Optional thresholds (higher precedence than dataset defaults). */
  thresholds?: Partial<EvalThresholds>;
  /**
   * Loader hook for documents with `loaderRef` instead of inline `content`.
   * The generated script provides a stub that users can customize.
   */
  loadDocumentByRef?: (ref: string) => Promise<string>;
};

export type EvalRunOutput = {
  report: EvalReportV1;
  exitCode: 0 | 1;
  thresholdFailures: string[];
};

const now = () => performance.now();

export async function runEval(args: EvalRunArgs): Promise<EvalRunOutput> {
  const dataset = await readEvalDatasetFromFile(args.datasetPath);

  const includeNdcg = Boolean(args.includeNdcg);
  const cleanup: EvalCleanupPolicy = args.cleanup ?? "none";

  const mode: EvalMode = args.mode ?? dataset.defaults.mode ?? "retrieve";
  const topK: number = args.topK ?? dataset.defaults.topK ?? 10;
  const scopePrefix: string = (args.scopePrefix ?? dataset.defaults.scopePrefix).trim();
  if (!scopePrefix) throw new Error(`[unrag:eval] Missing scopePrefix (dataset.defaults.scopePrefix)`);

  // Guardrails around delete-by-prefix
  const isEvalNamespaced = scopePrefix.startsWith("eval:");
  if (!isEvalNamespaced && !args.allowNonEvalPrefix) {
    throw new Error(
      `[unrag:eval] Refusing to run with scopePrefix="${scopePrefix}" because it does not start with "eval:". ` +
        `Use --allow-non-eval-prefix and --yes only if you understand the delete-by-prefix risk.`
    );
  }

  const datasetHasDocs = Array.isArray(dataset.documents) && dataset.documents.length > 0;
  const ingest = args.ingest ?? datasetHasDocs;

  const thresholdConfig: Partial<EvalThresholds> = deepMergeThresholds(
    dataset.defaults.thresholds ?? {},
    args.thresholds ?? {}
  );

  // Optional ingest stage (isolated by scopePrefix)
  if (ingest && datasetHasDocs) {
    if (!isEvalNamespaced && !args.confirmedDangerousDelete) {
      throw new Error(
        `[unrag:eval] Refusing to delete non-eval scopePrefix="${scopePrefix}" without confirmation. ` +
          `Re-run with --yes (and keep the prefix narrowly scoped).`
      );
    }

    await args.engine.delete({ sourceIdPrefix: scopePrefix });

    for (const doc of dataset.documents ?? []) {
      const sourceId = doc.sourceId;
      if (!sourceId.startsWith(scopePrefix)) {
        throw new Error(
          `[unrag:eval] Dataset document sourceId "${sourceId}" does not start with scopePrefix "${scopePrefix}". ` +
            `To keep eval isolated, ensure dataset documents are namespaced under defaults.scopePrefix.`
        );
      }

      const content = await resolveDocumentContent(doc, args.loadDocumentByRef);

      if (doc.assets !== undefined && !args.allowAssets) {
        throw new Error(
          `[unrag:eval] Dataset includes documents[].assets but assets are disabled by default for safety. ` +
            `Re-run with --allow-assets if you understand the SSRF/network variance implications.`
        );
      }

      await args.engine.ingest({
        sourceId,
        content,
        metadata: normalizeMetadata(doc.metadata),
        assets: (doc.assets as AssetInput[] | undefined) ?? undefined,
      });
    }
  }

  // Query loop
  const queryResults: EvalQueryResult[] = [];
  let embeddingModel: string | undefined;

  for (const q of dataset.queries) {
    const qTopK = q.topK ?? topK;
    const qScopePrefix = (q.scopePrefix ?? scopePrefix).trim();
    const qRerankTopK =
      mode === "retrieve+rerank"
        ? clampRerankTopK({
            topK: qTopK,
            rerankTopK:
              q.rerankTopK ??
              args.rerankTopK ??
              dataset.defaults.rerankTopK ??
              qTopK * 3,
          })
        : undefined;

    const retrieved = await args.engine.retrieve({
      query: q.query,
      topK: mode === "retrieve+rerank" ? qRerankTopK : qTopK,
      scope: { sourceId: qScopePrefix },
    });
    embeddingModel = embeddingModel ?? retrieved.embeddingModel;

    const retrievedSourceIds = uniqueSourceIdsInOrder(retrieved.chunks.map((c) => c.sourceId));
    const retrievedMetrics = computeMetricsAtK({
      retrievedSourceIds,
      relevantSourceIds: q.relevant.sourceIds,
      k: qTopK,
      includeNdcg,
    });

    let rerankedBlock: EvalQueryResult["reranked"] | undefined;
    if (mode === "retrieve+rerank") {
      const rerankStart = now();
      const reranked = await args.engine.rerank({
        query: q.query,
        candidates: retrieved.chunks,
        topK: qTopK,
        onMissingReranker: "throw",
        onMissingText: "skip",
      });
      const rerankTotalMs = now() - rerankStart;

      const rerankedSourceIds = uniqueSourceIdsInOrder(reranked.chunks.map((c) => c.sourceId));
      const rerankedMetrics = computeMetricsAtK({
        retrievedSourceIds: rerankedSourceIds,
        relevantSourceIds: q.relevant.sourceIds,
        k: qTopK,
        includeNdcg,
      });

      rerankedBlock = {
        sourceIds: rerankedSourceIds,
        metrics: rerankedMetrics,
        durationsMs: {
          rerankMs: reranked.durations.rerankMs,
          totalMs: Math.max(reranked.durations.totalMs, rerankTotalMs),
        },
        meta: {
          rerankerName: reranked.meta?.rerankerName,
          model: reranked.meta?.model,
        },
        warnings: reranked.warnings,
      };
    }

    queryResults.push({
      id: q.id,
      query: q.query,
      topK: qTopK,
      ...(qRerankTopK ? { rerankTopK: qRerankTopK } : {}),
      scopePrefix: qScopePrefix,
      relevant: { sourceIds: q.relevant.sourceIds },
      retrieved: {
        sourceIds: retrievedSourceIds,
        metrics: retrievedMetrics,
        durationsMs: retrieved.durations,
      },
      ...(rerankedBlock ? { reranked: rerankedBlock } : {}),
      ...(q.notes ? { notes: q.notes } : {}),
    });
  }

  // Cleanup policy (post-run)
  if (ingest && datasetHasDocs) {
    const shouldCleanup =
      cleanup === "always" ||
      (cleanup === "on-success" && true); // errors would have thrown already
    if (shouldCleanup) {
      await args.engine.delete({ sourceIdPrefix: scopePrefix });
    }
  }

  // Aggregates
  const retrievedAgg = aggregatesFor(queryResults.map((q) => q.retrieved.metrics));
  const rerankedAgg =
    mode === "retrieve+rerank"
      ? aggregatesFor(
          queryResults.map((q) => q.reranked?.metrics).filter(Boolean) as EvalMetricsAtK[]
        )
      : undefined;

  const timingAgg = buildTimingAggregates(mode, queryResults);

  // Threshold evaluation (apply to final stage: reranked if present else retrieved)
  const { failures: thresholdFailures, passed } = evaluateThresholds({
    thresholds: thresholdConfig,
    mode,
    aggregates: rerankedAgg ?? retrievedAgg,
    p95TotalMs: timingAgg.totalMs.p95,
  });

  const createdAt = new Date().toISOString();
  const report: EvalReportV1 = {
    version: "1",
    createdAt,
    dataset: {
      id: dataset.id,
      version: "1",
      ...(dataset.description ? { description: dataset.description } : {}),
    },
    config: {
      mode,
      topK,
      ...(mode === "retrieve+rerank" && (args.rerankTopK ?? dataset.defaults.rerankTopK) !== undefined
        ? { rerankTopK: clampRerankTopK({ topK, rerankTopK: args.rerankTopK ?? dataset.defaults.rerankTopK! }) }
        : {}),
      scopePrefix,
      ingest,
      cleanup,
      includeNdcg,
    },
    engine: {
      embeddingModel,
      rerankerName: queryResults.find((q) => q.reranked)?.reranked?.meta?.rerankerName,
      rerankerModel: queryResults.find((q) => q.reranked)?.reranked?.meta?.model,
    },
    results: {
      queries: queryResults,
      aggregates: {
        retrieved: retrievedAgg,
        ...(rerankedAgg ? { reranked: rerankedAgg } : {}),
      },
      timings: timingAgg,
      thresholdsApplied: thresholdConfig,
      thresholdFailures,
      passed,
    },
  };

  return {
    report,
    thresholdFailures,
    exitCode: passed ? 0 : 1,
  };
}

async function resolveDocumentContent(
  doc: NonNullable<EvalDatasetV1["documents"]>[number],
  loadByRef: EvalRunArgs["loadDocumentByRef"]
): Promise<string> {
  if (typeof doc.content === "string" && doc.content.trim().length > 0) return doc.content;
  if (typeof doc.loaderRef === "string" && doc.loaderRef.trim().length > 0) {
    if (!loadByRef) {
      throw new Error(
        `[unrag:eval] Dataset document uses loaderRef="${doc.loaderRef}" but no loadDocumentByRef hook was provided.`
      );
    }
    const content = await loadByRef(doc.loaderRef);
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error(
        `[unrag:eval] loadDocumentByRef("${doc.loaderRef}") returned empty content.`
      );
    }
    return content;
  }
  throw new Error(`[unrag:eval] Dataset document is missing both content and loaderRef.`);
}

function normalizeMetadata(input: unknown): Metadata | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (v === undefined) continue;
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
      continue;
    }
    if (Array.isArray(v)) {
      const xs = v.filter(
        (x) => x === null || typeof x === "string" || typeof x === "number" || typeof x === "boolean"
      );
      out[k] = xs;
      continue;
    }
    // Drop unsupported nested objects for stability/diff-friendliness.
  }
  return out as Metadata;
}

function aggregatesFor(metrics: EvalMetricsAtK[]) {
  const mean = {
    hitAtK: meanOf(metrics.map((m) => m.hitAtK)),
    recallAtK: meanOf(metrics.map((m) => m.recallAtK)),
    precisionAtK: meanOf(metrics.map((m) => m.precisionAtK)),
    mrrAtK: meanOf(metrics.map((m) => m.mrrAtK)),
    ...(metrics.some((m) => typeof m.ndcgAtK === "number")
      ? { ndcgAtK: meanOf(metrics.map((m) => m.ndcgAtK ?? 0)) }
      : {}),
  };

  const median = {
    hitAtK: medianOf(metrics.map((m) => m.hitAtK)),
    recallAtK: medianOf(metrics.map((m) => m.recallAtK)),
    precisionAtK: medianOf(metrics.map((m) => m.precisionAtK)),
    mrrAtK: medianOf(metrics.map((m) => m.mrrAtK)),
    ...(metrics.some((m) => typeof m.ndcgAtK === "number")
      ? { ndcgAtK: medianOf(metrics.map((m) => m.ndcgAtK ?? 0)) }
      : {}),
  };

  return { mean, median };
}

function meanOf(xs: number[]): number {
  const ys = xs.filter((v) => Number.isFinite(v));
  if (ys.length === 0) return 0;
  return ys.reduce((a, b) => a + b, 0) / ys.length;
}

function medianOf(xs: number[]): number {
  const ys = xs.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (ys.length === 0) return 0;
  const mid = Math.floor(ys.length / 2);
  if (ys.length % 2 === 1) return ys[mid]!;
  return (ys[mid - 1]! + ys[mid]!) / 2;
}

function buildTimingAggregates(mode: EvalMode, qs: EvalQueryResult[]) {
  const embedding = qs.map((q) => q.retrieved.durationsMs.embeddingMs);
  const retrieval = qs.map((q) => q.retrieved.durationsMs.retrievalMs);
  const retrieveTotal = qs.map((q) => q.retrieved.durationsMs.totalMs);

  const total = qs.map((q) => q.retrieved.durationsMs.totalMs + (q.reranked?.durationsMs.totalMs ?? 0));

  if (mode !== "retrieve+rerank") {
    return {
      embeddingMs: percentiles(embedding),
      retrievalMs: percentiles(retrieval),
      retrieveTotalMs: percentiles(retrieveTotal),
      totalMs: percentiles(total),
    };
  }

  const rerankMs = qs.map((q) => q.reranked?.durationsMs.rerankMs ?? 0);
  const rerankTotalMs = qs.map((q) => q.reranked?.durationsMs.totalMs ?? 0);

  return {
    embeddingMs: percentiles(embedding),
    retrievalMs: percentiles(retrieval),
    retrieveTotalMs: percentiles(retrieveTotal),
    rerankMs: percentiles(rerankMs),
    rerankTotalMs: percentiles(rerankTotalMs),
    totalMs: percentiles(total),
  };
}

function deepMergeThresholds(
  base: Partial<EvalThresholds>,
  override: Partial<EvalThresholds>
): Partial<EvalThresholds> {
  const out: Partial<EvalThresholds> = {
    min: { ...(base.min ?? {}) },
    max: { ...(base.max ?? {}) },
  };
  if (override.min) Object.assign(out.min!, override.min);
  if (override.max) Object.assign(out.max!, override.max);
  return out;
}

function evaluateThresholds(args: {
  thresholds: Partial<EvalThresholds>;
  mode: EvalMode;
  aggregates: { mean: EvalMetricsAtK; median: EvalMetricsAtK };
  p95TotalMs: number;
}): { failures: string[]; passed: boolean } {
  const failures: string[] = [];
  const min = args.thresholds.min ?? {};
  const max = args.thresholds.max ?? {};

  if (typeof min.hitAtK === "number" && args.aggregates.mean.hitAtK < min.hitAtK) {
    failures.push(`min.hitAtK: expected >= ${min.hitAtK}, got ${args.aggregates.mean.hitAtK.toFixed(3)}`);
  }
  if (typeof min.recallAtK === "number" && args.aggregates.mean.recallAtK < min.recallAtK) {
    failures.push(`min.recallAtK: expected >= ${min.recallAtK}, got ${args.aggregates.mean.recallAtK.toFixed(3)}`);
  }
  if (typeof min.mrrAtK === "number" && args.aggregates.mean.mrrAtK < min.mrrAtK) {
    failures.push(`min.mrrAtK: expected >= ${min.mrrAtK}, got ${args.aggregates.mean.mrrAtK.toFixed(3)}`);
  }
  if (typeof max.p95TotalMs === "number" && args.p95TotalMs > max.p95TotalMs) {
    failures.push(`max.p95TotalMs: expected <= ${max.p95TotalMs}, got ${args.p95TotalMs.toFixed(1)}ms`);
  }

  return { failures, passed: failures.length === 0 };
}

function clampRerankTopK(args: { topK: number; rerankTopK: number }): number {
  const topK = Math.max(1, Math.floor(args.topK));
  const requested = Math.floor(args.rerankTopK);
  if (!Number.isFinite(requested) || requested <= 0) return topK * 3;
  return Math.max(topK, requested);
}
