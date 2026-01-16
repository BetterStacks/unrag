import path from 'node:path'
import {mkdir, writeFile, readFile} from 'node:fs/promises'

import type {EvalMode, EvalThresholds} from './dataset'
import type {EvalMetricsAtK} from './metrics'

export type EvalCleanupPolicy = 'none' | 'on-success' | 'always'

export type EvalReportV1 = {
	version: '1'
	createdAt: string // ISO string
	dataset: {
		id: string
		version: '1'
		description?: string
	}
	config: {
		mode: EvalMode
		topK: number
		/**
		 * In `retrieve+rerank` mode, the default candidate retrieval size.
		 * If omitted, the runner default is derived per-query as `topK * 3`.
		 */
		rerankTopK?: number
		scopePrefix: string
		ingest: boolean
		cleanup: EvalCleanupPolicy
		includeNdcg: boolean
	}
	engine: {
		embeddingModel?: string
		rerankerName?: string
		rerankerModel?: string
	}
	results: {
		queries: EvalQueryResult[]
		aggregates: EvalAggregateBlock
		timings: EvalTimingAggregates
		thresholdsApplied?: Partial<EvalThresholds>
		thresholdFailures?: string[]
		passed?: boolean
	}
}

export type EvalQueryResult = {
	id: string
	query: string
	topK: number
	/** In `retrieve+rerank` mode, how many candidates were retrieved before reranking. */
	rerankTopK?: number
	scopePrefix: string
	relevant: {sourceIds: string[]}
	retrieved: {
		sourceIds: string[]
		metrics: EvalMetricsAtK
		durationsMs: {
			embeddingMs: number
			retrievalMs: number
			totalMs: number
		}
	}
	reranked?: {
		sourceIds: string[]
		metrics: EvalMetricsAtK
		durationsMs: {
			rerankMs: number
			totalMs: number
		}
		meta?: {
			rerankerName?: string
			model?: string
		}
		warnings?: string[]
	}
	notes?: string
}

export type EvalAggregateBlock = {
	retrieved: EvalAggregatesForStage
	reranked?: EvalAggregatesForStage
}

export type EvalAggregatesForStage = {
	mean: EvalMetricsAtK
	median: EvalMetricsAtK
}

export type EvalTimingAggregates = {
	embeddingMs: Percentiles
	retrievalMs: Percentiles
	retrieveTotalMs: Percentiles
	rerankMs?: Percentiles
	rerankTotalMs?: Percentiles
	/** End-to-end total per query (retrieve total + rerank total when present). */
	totalMs: Percentiles
}

export type Percentiles = {
	p50: number
	p95: number
}

export async function ensureDir(dir: string): Promise<void> {
	await mkdir(dir, {recursive: true})
}

export async function writeEvalReport(
	outputDir: string,
	report: EvalReportV1
): Promise<string> {
	await ensureDir(outputDir)
	const outPath = path.join(outputDir, 'report.json')
	await writeFile(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8')
	return outPath
}

export async function writeEvalSummaryMd(
	outputDir: string,
	report: EvalReportV1
): Promise<string> {
	await ensureDir(outputDir)
	const outPath = path.join(outputDir, 'summary.md')
	const lines: string[] = []
	lines.push(`# Unrag Eval Report`)
	lines.push(``)
	lines.push(`- Dataset: \`${report.dataset.id}\``)
	lines.push(`- Mode: \`${report.config.mode}\``)
	lines.push(`- topK: \`${report.config.topK}\``)
	if (report.config.mode === 'retrieve+rerank') {
		lines.push(
			`- rerankTopK: \`${typeof report.config.rerankTopK === 'number' ? report.config.rerankTopK : 'topK*3'}\``
		)
	}
	lines.push(`- scopePrefix: \`${report.config.scopePrefix}\``)
	lines.push(`- ingest: \`${report.config.ingest}\``)
	lines.push(`- createdAt: \`${report.createdAt}\``)
	lines.push(``)

	const stageLines = (label: string, a: EvalAggregatesForStage) => {
		lines.push(`## ${label}`)
		lines.push(``)
		lines.push(`| metric | mean | median |`)
		lines.push(`| --- | ---: | ---: |`)
		lines.push(
			`| hit@k | ${a.mean.hitAtK.toFixed(3)} | ${a.median.hitAtK.toFixed(3)} |`
		)
		lines.push(
			`| recall@k | ${a.mean.recallAtK.toFixed(3)} | ${a.median.recallAtK.toFixed(3)} |`
		)
		lines.push(
			`| precision@k | ${a.mean.precisionAtK.toFixed(3)} | ${a.median.precisionAtK.toFixed(3)} |`
		)
		lines.push(
			`| mrr@k | ${a.mean.mrrAtK.toFixed(3)} | ${a.median.mrrAtK.toFixed(3)} |`
		)
		if (report.config.includeNdcg) {
			lines.push(
				`| ndcg@k | ${(a.mean.ndcgAtK ?? 0).toFixed(3)} | ${(a.median.ndcgAtK ?? 0).toFixed(3)} |`
			)
		}
		lines.push(``)
	}

	stageLines('Retrieved', report.results.aggregates.retrieved)
	if (report.results.aggregates.reranked)
		stageLines('Reranked', report.results.aggregates.reranked)

	// Worst queries by recall@k (post-rerank if present)
	const sortKey = (q: EvalQueryResult) =>
		q.reranked?.metrics.recallAtK ?? q.retrieved.metrics.recallAtK
	const worst = [...report.results.queries]
		.sort((a, b) => sortKey(a) - sortKey(b))
		.slice(0, 10)
	lines.push(`## Worst queries`)
	lines.push(``)
	lines.push(`| id | recall@k | hit@k | mrr@k |`)
	lines.push(`| --- | ---: | ---: | ---: |`)
	for (const q of worst) {
		const m = q.reranked?.metrics ?? q.retrieved.metrics
		lines.push(
			`| \`${q.id}\` | ${m.recallAtK.toFixed(3)} | ${m.hitAtK.toFixed(0)} | ${m.mrrAtK.toFixed(3)} |`
		)
	}
	lines.push(``)

	if (
		Array.isArray(report.results.thresholdFailures) &&
		report.results.thresholdFailures.length > 0
	) {
		lines.push(`## Threshold failures`)
		lines.push(``)
		for (const f of report.results.thresholdFailures) lines.push(`- ${f}`)
		lines.push(``)
	}

	await writeFile(outPath, lines.join('\n') + '\n', 'utf8')
	return outPath
}

export async function readEvalReportFromFile(
	reportPath: string
): Promise<EvalReportV1> {
	const raw = await readFile(reportPath, 'utf8')
	let json: unknown
	try {
		json = JSON.parse(raw)
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		throw new Error(
			`[unrag:eval] Failed to parse report JSON (${reportPath}): ${msg}`
		)
	}
	if (!json || typeof json !== 'object') {
		throw new Error(
			`[unrag:eval] Invalid report JSON (${reportPath}): must be an object`
		)
	}
	const r = json as any
	if (r.version !== '1') {
		throw new Error(
			`[unrag:eval] Unsupported report version (${reportPath}): ${String(r.version)}`
		)
	}
	return r as EvalReportV1
}

export function percentiles(values: number[]): Percentiles {
	const xs = values
		.filter((v) => Number.isFinite(v))
		.slice()
		.sort((a, b) => a - b)
	if (xs.length === 0) return {p50: 0, p95: 0}
	return {
		p50: quantile(xs, 0.5),
		p95: quantile(xs, 0.95)
	}
}

function quantile(sorted: number[], q: number): number {
	if (sorted.length === 0) return 0
	const pos = (sorted.length - 1) * q
	const base = Math.floor(pos)
	const rest = pos - base
	const a = sorted[base]!
	const b = sorted[Math.min(base + 1, sorted.length - 1)]!
	return a + rest * (b - a)
}

export type EvalDiffV1 = {
	version: '1'
	createdAt: string
	baseline: {reportPath: string; datasetId: string; createdAt?: string}
	candidate: {reportPath?: string; datasetId: string; createdAt?: string}
	deltas: {
		retrieved: Partial<EvalMetricsAtK>
		reranked?: Partial<EvalMetricsAtK>
		p95TotalMs?: number
	}
	worstRegressions: Array<{
		id: string
		deltaRecallAtK: number
		baselineRecallAtK: number
		candidateRecallAtK: number
	}>
}

export function diffEvalReports(args: {
	baseline: EvalReportV1
	candidate: EvalReportV1
	baselinePath: string
	candidatePath?: string
}): EvalDiffV1 {
	const b = args.baseline
	const c = args.candidate

	const deltaStage = (
		bm: EvalMetricsAtK,
		cm: EvalMetricsAtK
	): Partial<EvalMetricsAtK> => ({
		hitAtK: cm.hitAtK - bm.hitAtK,
		recallAtK: cm.recallAtK - bm.recallAtK,
		precisionAtK: cm.precisionAtK - bm.precisionAtK,
		mrrAtK: cm.mrrAtK - bm.mrrAtK,
		...(typeof bm.ndcgAtK === 'number' || typeof cm.ndcgAtK === 'number'
			? {ndcgAtK: (cm.ndcgAtK ?? 0) - (bm.ndcgAtK ?? 0)}
			: {})
	})

	const retrieved = deltaStage(
		b.results.aggregates.retrieved.mean,
		c.results.aggregates.retrieved.mean
	)

	const reranked =
		b.results.aggregates.reranked && c.results.aggregates.reranked
			? deltaStage(
					b.results.aggregates.reranked.mean,
					c.results.aggregates.reranked.mean
				)
			: undefined

	const p95TotalMs =
		c.results.timings.totalMs.p95 - b.results.timings.totalMs.p95

	// Worst regressions by recall@k (post-rerank if present)
	const baselineById = new Map(
		b.results.queries.map((q) => [
			q.id,
			q.reranked?.metrics.recallAtK ?? q.retrieved.metrics.recallAtK
		])
	)
	const candidateById = new Map(
		c.results.queries.map((q) => [
			q.id,
			q.reranked?.metrics.recallAtK ?? q.retrieved.metrics.recallAtK
		])
	)

	const ids = Array.from(
		new Set([...baselineById.keys(), ...candidateById.keys()])
	)
	const regressions = ids
		.map((id) => {
			const br = baselineById.get(id) ?? 0
			const cr = candidateById.get(id) ?? 0
			return {
				id,
				deltaRecallAtK: cr - br,
				baselineRecallAtK: br,
				candidateRecallAtK: cr
			}
		})
		.sort((a, b) => a.deltaRecallAtK - b.deltaRecallAtK)
		.slice(0, 20)

	return {
		version: '1',
		createdAt: new Date().toISOString(),
		baseline: {
			reportPath: args.baselinePath,
			datasetId: b.dataset.id,
			createdAt: b.createdAt
		},
		candidate: {
			reportPath: args.candidatePath,
			datasetId: c.dataset.id,
			createdAt: c.createdAt
		},
		deltas: {retrieved, ...(reranked ? {reranked} : {}), p95TotalMs},
		worstRegressions: regressions
	}
}

export async function writeEvalDiffJson(
	outputDir: string,
	diff: EvalDiffV1
): Promise<string> {
	await ensureDir(outputDir)
	const outPath = path.join(outputDir, 'diff.json')
	await writeFile(outPath, JSON.stringify(diff, null, 2) + '\n', 'utf8')
	return outPath
}

export async function writeEvalDiffMd(
	outputDir: string,
	diff: EvalDiffV1
): Promise<string> {
	await ensureDir(outputDir)
	const outPath = path.join(outputDir, 'diff.md')
	const lines: string[] = []
	lines.push(`# Unrag Eval Diff`)
	lines.push(``)
	lines.push(`- Baseline: \`${diff.baseline.datasetId}\``)
	lines.push(`- Candidate: \`${diff.candidate.datasetId}\``)
	lines.push(``)
	lines.push(`## Aggregate deltas (mean)`)
	lines.push(``)
	lines.push(`| metric | retrieved Δ | reranked Δ |`)
	lines.push(`| --- | ---: | ---: |`)
	const fmt = (n: number | undefined) =>
		typeof n === 'number' ? n.toFixed(3) : '—'
	lines.push(
		`| hit@k | ${fmt(diff.deltas.retrieved.hitAtK)} | ${fmt(diff.deltas.reranked?.hitAtK)} |`
	)
	lines.push(
		`| recall@k | ${fmt(diff.deltas.retrieved.recallAtK)} | ${fmt(diff.deltas.reranked?.recallAtK)} |`
	)
	lines.push(
		`| precision@k | ${fmt(diff.deltas.retrieved.precisionAtK)} | ${fmt(diff.deltas.reranked?.precisionAtK)} |`
	)
	lines.push(
		`| mrr@k | ${fmt(diff.deltas.retrieved.mrrAtK)} | ${fmt(diff.deltas.reranked?.mrrAtK)} |`
	)
	lines.push(``)
	if (typeof diff.deltas.p95TotalMs === 'number') {
		lines.push(
			`- p95 total ms Δ: \`${diff.deltas.p95TotalMs.toFixed(1)}ms\``
		)
		lines.push(``)
	}
	lines.push(`## Worst recall regressions`)
	lines.push(``)
	lines.push(`| id | Δ recall@k | baseline | candidate |`)
	lines.push(`| --- | ---: | ---: | ---: |`)
	for (const r of diff.worstRegressions) {
		lines.push(
			`| \`${r.id}\` | ${r.deltaRecallAtK.toFixed(3)} | ${r.baselineRecallAtK.toFixed(3)} | ${r.candidateRecallAtK.toFixed(3)} |`
		)
	}
	lines.push(``)
	await writeFile(outPath, lines.join('\n') + '\n', 'utf8')
	return outPath
}
