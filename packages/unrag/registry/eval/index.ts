/**
 * Eval harness battery module.
 *
 * Install via `unrag add battery eval`.
 *
 * This module is designed to be vendored into user repos and executed via a
 * project-local script (e.g. `scripts/unrag-eval.ts`) so users can audit and customize.
 */

export { readEvalDatasetFromFile, parseEvalDataset } from "@registry/eval/dataset";
export type {
  EvalDatasetV1,
  EvalDatasetDocument,
  EvalDatasetQuery,
  EvalMode,
  EvalThresholds,
} from "@registry/eval/dataset";

export { computeMetricsAtK, uniqueSourceIdsInOrder } from "@registry/eval/metrics";
export type { EvalMetricsAtK } from "@registry/eval/metrics";

export { runEval } from "@registry/eval/runner";
export type { EvalRunArgs, EvalRunOutput } from "@registry/eval/runner";

export {
  readEvalReportFromFile,
  writeEvalReport,
  writeEvalSummaryMd,
  diffEvalReports,
  writeEvalDiffJson,
  writeEvalDiffMd,
} from "@registry/eval/report";
export type {
  EvalReportV1,
  EvalQueryResult,
  EvalCleanupPolicy,
  EvalDiffV1,
} from "@registry/eval/report";

