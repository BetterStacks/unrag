/**
 * Unrag eval runner entrypoint (generated).
 *
 * You own this file — customize it freely.
 */

import path from 'node:path'
import {access, readFile} from 'node:fs/promises'

import {createUnragEngine} from '../unrag.config'
import {
	runEval,
	readEvalReportFromFile,
	writeEvalReport,
	writeEvalSummaryMd,
	diffEvalReports,
	writeEvalDiffJson,
	writeEvalDiffMd,
	type EvalMode,
	type EvalThresholds,
	type EvalCleanupPolicy
} from '../lib/unrag/eval'

type CliArgs = {
	dataset?: string
	baseline?: string
	outputDir?: string
	mode?: EvalMode
	topK?: number
	rerankTopK?: number
	scopePrefix?: string
	ingest?: boolean
	cleanup?: EvalCleanupPolicy
	thresholds?: Partial<EvalThresholds>
	ci?: boolean
	allowAssets?: boolean
	allowNonEvalPrefix?: boolean
	yes?: boolean
	includeNdcg?: boolean
}

async function fileExists(p: string): Promise<boolean> {
	try {
		await access(p)
		return true
	} catch {
		return false
	}
}

async function loadEnvFilesBestEffort(projectRoot: string) {
	const nodeEnv = process.env.NODE_ENV ?? 'development'
	const candidates = [
		'.env',
		'.env.local',
		`.env.${nodeEnv}`,
		`.env.${nodeEnv}.local`
	]
	for (const rel of candidates) {
		const abs = path.join(projectRoot, rel)
		if (!(await fileExists(abs))) continue
		const raw = await readFile(abs, 'utf8').catch(() => '')
		for (const line of raw.split(/\r?\n/)) {
			const s = line.trim()
			if (!s || s.startsWith('#')) continue
			const eq = s.indexOf('=')
			if (eq < 0) continue
			const key = s.slice(0, eq).trim()
			const value = s
				.slice(eq + 1)
				.trim()
				.replace(/^"|"$/g, '')
			if (!key) continue
			if (process.env[key] === undefined) process.env[key] = value
		}
	}
}

function parseThresholdExpr(expr: string): Partial<EvalThresholds> {
	const s = String(expr ?? '').trim()
	const eq = s.indexOf('=')
	if (eq < 0)
		throw new Error(`Invalid --threshold: "${s}" (expected key=value)`)
	const key = s.slice(0, eq).trim()
	const value = Number(s.slice(eq + 1).trim())
	if (!Number.isFinite(value))
		throw new Error(`Invalid --threshold value: "${s}"`)

	const out: Partial<EvalThresholds> = {}
	if (key === 'min.hitAtK') out.min = {hitAtK: value}
	else if (key === 'min.recallAtK') out.min = {recallAtK: value}
	else if (key === 'min.mrrAtK') out.min = {mrrAtK: value}
	else if (key === 'max.p95TotalMs') out.max = {p95TotalMs: value}
	else throw new Error(`Unknown threshold key: "${key}"`)
	return out
}

function mergeThresholds(
	a: Partial<EvalThresholds>,
	b: Partial<EvalThresholds>
): Partial<EvalThresholds> {
	return {
		min: {...(a.min ?? {}), ...(b.min ?? {})},
		max: {...(a.max ?? {}), ...(b.max ?? {})}
	}
}

function parseArgs(argv: string[]): CliArgs {
	const out: CliArgs = {}
	const thresholds: Partial<EvalThresholds>[] = []

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]
		if (a === '--dataset') out.dataset = argv[++i]
		else if (a === '--baseline') out.baseline = argv[++i]
		else if (a === '--outputDir' || a === '--output-dir')
			out.outputDir = argv[++i]
		else if (a === '--mode') out.mode = argv[++i] as EvalMode
		else if (a === '--topK' || a === '--top-k') out.topK = Number(argv[++i])
		else if (a === '--rerankTopK' || a === '--rerank-top-k')
			out.rerankTopK = Number(argv[++i])
		else if (a === '--scopePrefix' || a === '--scope-prefix')
			out.scopePrefix = argv[++i]
		else if (a === '--no-ingest') out.ingest = false
		else if (a === '--cleanup') out.cleanup = argv[++i] as EvalCleanupPolicy
		else if (a === '--threshold')
			thresholds.push(parseThresholdExpr(argv[++i] ?? ''))
		else if (a === '--ci') out.ci = true
		else if (a === '--allow-assets') out.allowAssets = true
		else if (
			a === '--allow-non-eval-prefix' ||
			a === '--allow-custom-prefix'
		)
			out.allowNonEvalPrefix = true
		else if (a === '--yes' || a === '-y') out.yes = true
		else if (a === '--include-ndcg') out.includeNdcg = true
		else if (a === '--help' || a === '-h') {
			printHelp()
			process.exit(0)
		}
	}

	for (const t of thresholds)
		out.thresholds = mergeThresholds(out.thresholds ?? {}, t)
	return out
}

function printHelp() {
	console.log(
		[
			'unrag-eval — retrieval eval harness',
			'',
			'Usage:',
			'  bun run scripts/unrag-eval.ts -- --dataset .unrag/eval/datasets/sample.json',
			'',
			'Options:',
			'  --dataset <path>                 Dataset JSON path (required)',
			'  --baseline <report.json>         Baseline report for diffing',
			'  --output-dir <dir>               Output dir (default: .unrag/eval/runs/<ts>-<datasetId>)',
			'  --mode retrieve|retrieve+rerank   Override mode',
			'  --top-k <n>                      Override topK',
			'  --rerank-top-k <n>               In rerank mode, retrieve N candidates before reranking (default: topK*3)',
			'  --scope-prefix <prefix>          Override scopePrefix',
			'  --no-ingest                       Skip dataset document ingest',
			'  --cleanup none|on-success|always  Cleanup policy when ingesting',
			'  --threshold <k=v>                 Repeatable thresholds (e.g. min.recallAtK=0.75)',
			'  --ci                              CI mode (non-interactive)',
			'  --yes, -y                         Allow dangerous operations when explicitly enabled',
			'  --allow-assets                    Allow documents[].assets ingestion (advanced)',
			'  --allow-custom-prefix             Allow scopePrefix outside eval:* (dangerous)',
			'  --include-ndcg                    Compute nDCG@k (optional)'
		].join('\n')
	)
}

async function readConfigFile(projectRoot: string): Promise<any | null> {
	const abs = path.join(projectRoot, '.unrag/eval/config.json')
	if (!(await fileExists(abs))) return null
	const raw = await readFile(abs, 'utf8')
	try {
		return JSON.parse(raw)
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		throw new Error(`Failed to parse .unrag/eval/config.json: ${msg}`)
	}
}

function sanitizeMode(v: any): EvalMode | undefined {
	if (v === 'retrieve' || v === 'retrieve+rerank') return v
	return undefined
}

function sanitizeCleanup(v: any): EvalCleanupPolicy | undefined {
	if (v === 'none' || v === 'on-success' || v === 'always') return v
	return undefined
}

async function main() {
	const projectRoot = path.join(process.cwd())
	await loadEnvFilesBestEffort(projectRoot)

	const cli = parseArgs(process.argv.slice(2))
	const cfg = await readConfigFile(projectRoot)

	const datasetPath =
		cli.dataset ?? cfg?.dataset ?? '.unrag/eval/datasets/sample.json'
	if (!datasetPath) throw new Error('--dataset is required')

	const engine = createUnragEngine()

	const thresholds: Partial<EvalThresholds> = mergeThresholds(
		cfg?.thresholds ?? {},
		cli.thresholds ?? {}
	)

	const result = await runEval({
		engine,
		datasetPath,
		mode: cli.mode ?? sanitizeMode(cfg?.mode),
		topK:
			cli.topK ?? (typeof cfg?.topK === 'number' ? cfg.topK : undefined),
		rerankTopK:
			cli.rerankTopK ??
			(typeof cfg?.rerankTopK === 'number' ? cfg.rerankTopK : undefined),
		scopePrefix:
			cli.scopePrefix ??
			(typeof cfg?.scopePrefix === 'string'
				? cfg.scopePrefix
				: undefined),
		ingest:
			cli.ingest ??
			(typeof cfg?.ingest === 'boolean' ? cfg.ingest : undefined),
		cleanup: cli.cleanup ?? sanitizeCleanup(cfg?.cleanup) ?? 'none',
		includeNdcg: cli.includeNdcg ?? Boolean(cfg?.includeNdcg),
		allowAssets: cli.allowAssets ?? Boolean(cfg?.allowAssets),
		allowNonEvalPrefix:
			cli.allowNonEvalPrefix ?? Boolean(cfg?.allowNonEvalPrefix),
		confirmedDangerousDelete: Boolean(cli.yes),
		thresholds
	})

	const ts = new Date().toISOString().replace(/[:.]/g, '-')
	const outputDir =
		cli.outputDir ??
		cfg?.outputDir ??
		path.join('.unrag/eval/runs', `${ts}-${result.report.dataset.id}`)

	const reportPath = await writeEvalReport(outputDir, result.report)
	const summaryPath = await writeEvalSummaryMd(outputDir, result.report)

	let diffPaths: {json: string; md: string} | null = null
	const baselinePath = cli.baseline ?? cfg?.baseline
	if (baselinePath) {
		const baseline = await readEvalReportFromFile(baselinePath)
		const diff = diffEvalReports({
			baseline,
			candidate: result.report,
			baselinePath,
			candidatePath: reportPath
		})
		const diffJson = await writeEvalDiffJson(outputDir, diff)
		const diffMd = await writeEvalDiffMd(outputDir, diff)
		diffPaths = {json: diffJson, md: diffMd}
	}

	console.log(
		[
			`[unrag:eval] Wrote report: ${reportPath}`,
			`[unrag:eval] Wrote summary: ${summaryPath}`,
			diffPaths
				? `[unrag:eval] Wrote diff: ${diffPaths.json} (+ ${diffPaths.md})`
				: '',
			result.thresholdFailures.length > 0
				? `[unrag:eval] Threshold failures:\n- ${result.thresholdFailures.join('\n- ')}`
				: `[unrag:eval] Thresholds: pass`
		]
			.filter(Boolean)
			.join('\n')
	)

	process.exitCode = result.exitCode
}

main().catch((err) => {
	const msg = err instanceof Error ? (err.stack ?? err.message) : String(err)
	console.error(`[unrag:eval] Error: ${msg}`)
	process.exitCode = 2
})
