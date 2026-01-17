/**
 * Eval harness battery module.
 *
 * Install via `unrag add battery eval`.
 *
 * This module is designed to be vendored into user repos and executed via a
 * project-local script (e.g. `scripts/unrag-eval.ts`) so users can audit and customize.
 */

export {readEvalDatasetFromFile, parseEvalDataset} from '@unrag/eval/dataset'
export type {
	EvalDatasetV1,
	EvalDatasetDocument,
	EvalDatasetQuery,
	EvalMode,
	EvalThresholds
} from '@unrag/eval/dataset'

export {computeMetricsAtK, uniqueSourceIdsInOrder} from '@unrag/eval/metrics'
export type {EvalMetricsAtK} from '@unrag/eval/metrics'

export {runEval} from '@unrag/eval/runner'
export type {EvalRunArgs, EvalRunOutput} from '@unrag/eval/runner'

export {
	readEvalReportFromFile,
	writeEvalReport,
	writeEvalSummaryMd,
	diffEvalReports,
	writeEvalDiffJson,
	writeEvalDiffMd
} from '@unrag/eval/report'
export type {
	EvalReportV1,
	EvalQueryResult,
	EvalCleanupPolicy,
	EvalDiffV1
} from '@unrag/eval/report'
