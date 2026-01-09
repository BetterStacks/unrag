/**
 * Eval harness battery module.
 *
 * Install via `unrag add battery eval`.
 *
 * This module is designed to be vendored into user repos and executed via a
 * project-local script (e.g. `scripts/unrag-eval.ts`) so users can audit and customize.
 */

export { readEvalDatasetFromFile, parseEvalDataset } from "./dataset";
export type {
  EvalDatasetV1,
  EvalDatasetDocument,
  EvalDatasetQuery,
  EvalMode,
  EvalThresholds,
} from "./dataset";

export { computeMetricsAtK, uniqueSourceIdsInOrder } from "./metrics";
export type { EvalMetricsAtK } from "./metrics";

export { runEval } from "./runner";
export type { EvalRunArgs, EvalRunOutput } from "./runner";

export {
  readEvalReportFromFile,
  writeEvalReport,
  writeEvalSummaryMd,
  diffEvalReports,
  writeEvalDiffJson,
  writeEvalDiffMd,
} from "./report";
export type {
  EvalReportV1,
  EvalQueryResult,
  EvalCleanupPolicy,
  EvalDiffV1,
} from "./report";

