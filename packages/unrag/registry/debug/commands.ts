/**
 * Debug command handlers.
 *
 * These handlers process commands sent from the debug TUI client
 * and return appropriate results.
 */

import type {DebugEmitter} from '@registry/core/debug-emitter'
import type {Metadata} from '@registry/core/types'
import {getUnragDebugRuntime} from '@registry/debug/runtime'
import type {
	ClearBufferResult,
	DebugCommand,
	DebugCommandResult,
	DeleteChunksResult,
	DeleteDocumentResult,
	DoctorResult,
	GetBufferResult,
	GetDocumentResult,
	IngestResult,
	ListDocumentsResult,
	PingResult,
	QueryResult,
	RunEvalResult,
	StoreStatsResult
} from '@registry/debug/types'
import {
	hasVendoredModuleDir,
	isUnragBatteryInstalled
} from '@registry/debug/unrag-json'

type EvalQueryLike = {
	id: string
	retrieved: {metrics: {recallAtK: number; mrrAtK: number}}
	reranked?: {metrics: {recallAtK: number; mrrAtK: number}}
}

type EvalReportLike = {
	dataset: {id: string}
	createdAt: string
	config: {
		mode: 'retrieve' | 'retrieve+rerank'
		topK: number
		rerankTopK?: number
		scopePrefix: string
		ingest: boolean
		cleanup: 'none' | 'on-success' | 'always'
		includeNdcg: boolean
	}
	engine: {
		embeddingModel?: string
		rerankerName?: string
		rerankerModel?: string
	}
	results: {
		queries?: EvalQueryLike[]
		passed?: boolean
		thresholdFailures?: string[]
		aggregates: RunEvalResult extends {summary?: infer S}
			? S extends {aggregates: infer A}
				? A
				: unknown
			: unknown
		timings: RunEvalResult extends {summary?: infer S}
			? S extends {timings: infer T}
				? T
				: unknown
			: unknown
	}
}

/**
 * Handle a debug command and return the result.
 */
export async function handleCommand(
	command: DebugCommand,
	emitter: DebugEmitter,
	startTime: number
): Promise<DebugCommandResult> {
	switch (command.type) {
		case 'doctor':
			return handleDoctor(emitter, startTime)

		case 'run-eval':
			return handleRunEval(command)

		case 'ping':
			return handlePing(emitter, startTime)

		case 'clear-buffer':
			return handleClearBuffer(emitter)

		case 'get-buffer':
			return handleGetBuffer(emitter)

		case 'query':
			return handleQuery(command)

		case 'ingest':
			return handleIngest(command)

		case 'list-documents':
			return handleListDocuments(command)

		case 'get-document':
			return handleGetDocument(command)

		case 'delete-document':
			return handleDeleteDocument(command)

		case 'delete-chunks':
			return handleDeleteChunks(command)

		case 'store-stats':
			return handleStoreStats()

		default: {
			const _exhaustive: never = command
			return {
				type: (command as DebugCommand).type,
				success: false,
				error: `Unknown command type: ${(command as DebugCommand).type}`
			} as DebugCommandResult
		}
	}
}

async function handleRunEval(command: {
	type: 'run-eval'
	datasetPath: string
	mode?: 'retrieve' | 'retrieve+rerank'
	topK?: number
	rerankTopK?: number
	scopePrefix?: string
	ingest?: boolean
	cleanup?: 'none' | 'on-success' | 'always'
	includeNdcg?: boolean
	allowNonEvalPrefix?: boolean
	confirmedDangerousDelete?: boolean
	allowAssets?: boolean
}): Promise<RunEvalResult> {
	const runtime = getUnragDebugRuntime()
	if (!runtime?.engine) {
		return {
			type: 'run-eval',
			success: false,
			error:
				'Eval requires engine registration. ' +
				'In your app, call `registerUnragDebug({ engine })` when UNRAG_DEBUG=true.'
		}
	}

	const datasetPath = (command.datasetPath ?? '').trim()
	if (!datasetPath) {
		return {type: 'run-eval', success: false, error: 'Missing datasetPath.'}
	}

	// IMPORTANT: `eval` is an optional vendored module. Don't hard-import it, or builds fail when it's not installed.
	const evalInstalled =
		isUnragBatteryInstalled('eval') && hasVendoredModuleDir('eval')
	if (!evalInstalled) {
		return {
			type: 'run-eval',
			success: false,
			error:
				'Eval module is not installed in your vendored Unrag code. ' +
				'Install it with `unrag@latest add battery eval` and re-run.'
		}
	}

	try {
		// Load eval runner lazily so bundlers don't require the module to exist.
		// Relative to `debug/commands.ts`, eval lives at `../eval`.
		const evalModulePath = ['..', 'eval'].join('/')
		const evalMod: unknown = await import(evalModulePath)
		const runEvalFn = (evalMod as {runEval?: unknown} | null)?.runEval
		if (typeof runEvalFn !== 'function') {
			return {
				type: 'run-eval',
				success: false,
				error:
					'Eval module is installed but did not export `runEval`. ' +
					'Try reinstalling the eval battery (`unrag@latest add battery eval`).'
			}
		}

		const out = await (runEvalFn as (args: unknown) => Promise<unknown>)({
			engine: runtime.engine,
			datasetPath,
			mode: command.mode,
			topK: command.topK,
			rerankTopK: command.rerankTopK,
			scopePrefix: command.scopePrefix,
			ingest: command.ingest,
			cleanup: command.cleanup,
			includeNdcg: command.includeNdcg,
			allowAssets: command.allowAssets,
			allowNonEvalPrefix: command.allowNonEvalPrefix,
			confirmedDangerousDelete: command.confirmedDangerousDelete
		})

		const r = (out as {report?: unknown} | null)?.report as EvalReportLike
		const queries: EvalQueryLike[] = r.results.queries ?? []
		const retrievedRecall = queries.map(
			(q) => q.retrieved.metrics.recallAtK
		)
		const retrievedMrr = queries.map((q) => q.retrieved.metrics.mrrAtK)
		const rerankedRecall = queries.map(
			(q) => q.reranked?.metrics.recallAtK ?? 0
		)
		const rerankedMrr = queries.map((q) => q.reranked?.metrics.mrrAtK ?? 0)

		const sortKey = (q: (typeof queries)[number]) =>
			q.reranked?.metrics.recallAtK ?? q.retrieved.metrics.recallAtK
		const worst = [...queries]
			.sort((a, b) => sortKey(a) - sortKey(b))
			.slice(0, 8)
			.map((q) => {
				const m = q.reranked?.metrics ?? q.retrieved.metrics
				return {id: q.id, recallAtK: m.recallAtK, mrrAtK: m.mrrAtK}
			})

		return {
			type: 'run-eval',
			success: true,
			summary: {
				datasetId: r.dataset.id,
				createdAt: r.createdAt,
				config: r.config,
				engine: r.engine,
				passed: r.results.passed,
				thresholdFailures: r.results.thresholdFailures,
				aggregates: r.results.aggregates,
				timings: r.results.timings,
				charts: {
					retrievedRecall,
					retrievedMrr,
					...(r.config.mode === 'retrieve+rerank'
						? {rerankedRecall, rerankedMrr}
						: {})
				},
				worst
			}
		}
	} catch (err) {
		return {
			type: 'run-eval',
			success: false,
			error: err instanceof Error ? err.message : String(err)
		}
	}
}

async function handleDoctor(
	emitter: DebugEmitter,
	startTime: number
): Promise<DoctorResult> {
	const rt = getUnragDebugRuntime()
	const checks: DoctorResult['checks'] = []

	const envVal = process.env.UNRAG_DEBUG
	const envOk = envVal === 'true'
	checks.push({
		id: 'env.unrag_debug',
		label: 'UNRAG_DEBUG enabled',
		status: envOk ? 'ok' : 'warn',
		detail: envOk
			? 'UNRAG_DEBUG=true'
			: `UNRAG_DEBUG=${envVal ?? '(unset)'}`,
		fix: envOk ? undefined : 'Set UNRAG_DEBUG=true in your app runtime env.'
	})

	const registered = Boolean(rt)
	checks.push({
		id: 'runtime.registered',
		label: 'registerUnragDebug() called',
		status: registered ? 'ok' : 'error',
		detail: registered ? 'Runtime registered' : 'No runtime registered',
		fix: registered
			? undefined
			: 'In your app, call `registerUnragDebug({ engine, storeInspector })` when UNRAG_DEBUG=true.'
	})

	const hasEngine = Boolean(rt?.engine)
	checks.push({
		id: 'runtime.engine',
		label: 'Engine available (Query Runner)',
		status: hasEngine ? 'ok' : 'error',
		detail: hasEngine ? 'engine registered' : 'engine missing',
		fix: hasEngine
			? undefined
			: 'Pass `engine` to `registerUnragDebug({ engine })`.'
	})

	const hasStoreInspector = Boolean(rt?.storeInspector)
	checks.push({
		id: 'runtime.storeInspector',
		label: 'Store inspector available (Docs)',
		status: hasStoreInspector ? 'ok' : 'warn',
		detail: hasStoreInspector
			? 'storeInspector registered'
			: 'storeInspector missing',
		fix: hasStoreInspector
			? undefined
			: 'If using built-in stores, pass `store.inspector` to `registerUnragDebug({ engine, storeInspector: store.inspector })`.'
	})

	type DoctorEngineInfo = NonNullable<
		NonNullable<NonNullable<DoctorResult['info']>['runtime']>['engineInfo']
	>
	let engineInfo: DoctorEngineInfo | undefined
	const engine = rt?.engine as unknown as
		| {getDebugInfo?: () => unknown}
		| undefined
	if (engine && typeof engine.getDebugInfo === 'function') {
		const raw = engine.getDebugInfo()
		if (raw && typeof raw === 'object') {
			const info = raw as {
				embedding: {
					name: string
					dimensions?: number
					supportsBatch: boolean
					supportsImage: boolean
				}
				storage: {
					storeChunkContent: boolean
					storeDocumentContent: boolean
				}
				defaults: {chunkSize: number; chunkOverlap: number}
				extractorsCount: number
				reranker?: {name: string}
			}
			engineInfo = {
				embedding: info.embedding,
				storage: info.storage,
				defaults: info.defaults,
				extractorsCount: info.extractorsCount,
				rerankerName: info.reranker?.name
			}

			checks.push({
				id: 'engine.storage.chunkContent',
				label: 'Chunk content stored',
				status: info.storage.storeChunkContent ? 'ok' : 'warn',
				detail: info.storage.storeChunkContent
					? 'storeChunkContent=true'
					: 'storeChunkContent=false',
				fix: info.storage.storeChunkContent
					? undefined
					: 'Enable `storage.storeChunkContent=true` to see `chunk.content` in retrieval + rerank diagnostics.'
			})

			checks.push({
				id: 'engine.storage.documentContent',
				label: 'Document content stored',
				status: info.storage.storeDocumentContent ? 'ok' : 'warn',
				detail: info.storage.storeDocumentContent
					? 'storeDocumentContent=true'
					: 'storeDocumentContent=false',
				fix: info.storage.storeDocumentContent
					? undefined
					: 'Enable `storage.storeDocumentContent=true` to keep the original document body in the store.'
			})

			checks.push({
				id: 'engine.reranker',
				label: 'Reranker configured',
				status: info.reranker ? 'ok' : 'warn',
				detail: info.reranker
					? `reranker=${info.reranker.name}`
					: 'no reranker',
				fix: info.reranker
					? undefined
					: 'Install and wire the reranker battery: `unrag add battery reranker`, then set `engine.reranker` in config.'
			})
		}
	}

	return {
		type: 'doctor',
		success: true,
		checks,
		info: {
			sessionId: emitter.getSessionId(),
			uptimeMs: Date.now() - startTime,
			env: {UNRAG_DEBUG: envVal},
			runtime: {
				registered,
				registeredAt: rt?.registeredAt,
				hasEngine,
				hasStoreInspector,
				engineInfo
			}
		}
	}
}

/**
 * Handle ping command.
 */
function handlePing(emitter: DebugEmitter, startTime: number): PingResult {
	return {
		type: 'ping',
		success: true,
		sessionId: emitter.getSessionId(),
		uptime: Date.now() - startTime
	}
}

/**
 * Handle clear-buffer command.
 */
function handleClearBuffer(emitter: DebugEmitter): ClearBufferResult {
	const buffer = emitter.getBuffer()
	const count = buffer.length
	emitter.clearBuffer()

	return {
		type: 'clear-buffer',
		success: true,
		clearedCount: count
	}
}

/**
 * Handle get-buffer command.
 */
function handleGetBuffer(emitter: DebugEmitter): GetBufferResult {
	return {
		type: 'get-buffer',
		success: true,
		events: emitter.getBuffer()
	}
}

/**
 * Handle query command.
 * Note: This requires the context engine to be available.
 * For now, returns a placeholder - actual implementation needs
 * the context engine instance to be passed in.
 */
async function handleQuery(command: {
	type: 'query'
	query: string
	topK?: number
	scope?: string
}): Promise<QueryResult> {
	const runtime = getUnragDebugRuntime()
	if (!runtime?.engine) {
		return {
			type: 'query',
			success: false,
			error:
				'Query command requires engine registration. ' +
				'In your app, call `registerUnragDebug({ engine })` when UNRAG_DEBUG=true.'
		}
	}

	const topK = command.topK ?? 8
	const scopePrefix = (command.scope ?? '').trim()
	const scope = scopePrefix ? {sourceId: scopePrefix} : undefined

	const res = await runtime.engine.retrieve({
		query: command.query,
		topK,
		scope
	})

	return {
		type: 'query',
		success: true,
		chunks: res.chunks.map((c) => ({
			id: c.id,
			content: c.content,
			score: c.score,
			sourceId: c.sourceId,
			documentId: c.documentId,
			metadata: (c.metadata ?? {}) as Record<string, unknown>
		})),
		durations: res.durations
	}
}

/**
 * Handle ingest command.
 * This requires the engine to be registered in the debug runtime.
 */
async function handleIngest(command: {
	type: 'ingest'
	sourceId: string
	content?: string
	contentPath?: string
	metadata?: Metadata
	chunking?: {chunkSize?: number; chunkOverlap?: number}
}): Promise<IngestResult> {
	const runtime = getUnragDebugRuntime()
	if (!runtime?.engine) {
		return {
			type: 'ingest',
			success: false,
			error:
				'Ingest requires engine registration. ' +
				'In your app, call `registerUnragDebug({ engine })` when UNRAG_DEBUG=true.'
		}
	}

	const sourceId = (command.sourceId ?? '').trim()
	if (!sourceId) {
		return {type: 'ingest', success: false, error: 'Missing sourceId.'}
	}

	let content = (command.content ?? '').toString()
	const contentPath = (command.contentPath ?? '').trim()

	if (!content && contentPath) {
		try {
			// Keep this as a dynamic import so bundlers don't pull node:fs into the TUI bundle.
			const fsModulePath = ['node:fs', 'promises'].join('/')
			const fsMod: unknown = await import(fsModulePath)
			const readFile = (fsMod as {readFile?: unknown} | null)?.readFile
			if (typeof readFile !== 'function') {
				return {
					type: 'ingest',
					success: false,
					error: 'Unable to read files in this runtime.'
				}
			}
			content = await (
				readFile as (p: string, enc: string) => Promise<string>
			)(contentPath, 'utf8')

			const maxBytes = 5 * 1024 * 1024
			if (Buffer.byteLength(content, 'utf8') > maxBytes) {
				return {
					type: 'ingest',
					success: false,
					error: `File too large (> ${maxBytes} bytes). Use a smaller file or ingest via your app pipeline.`
				}
			}
		} catch (err) {
			return {
				type: 'ingest',
				success: false,
				error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}`
			}
		}
	}

	if (!content.trim()) {
		return {
			type: 'ingest',
			success: false,
			error: 'Missing content. Provide inline content or a contentPath.'
		}
	}

	try {
		const res = await runtime.engine.ingest({
			sourceId,
			content,
			...(command.metadata ? {metadata: command.metadata} : {}),
			...(command.chunking ? {chunking: command.chunking} : {})
		})

		return {
			type: 'ingest',
			success: true,
			documentId: res.documentId,
			chunkCount: res.chunkCount,
			embeddingModel: res.embeddingModel,
			durations: res.durations,
			warnings: (res.warnings ?? []).map((w: unknown) => {
				const warn =
					w && typeof w === 'object'
						? (w as Record<string, unknown>)
						: {}
				return {
					code: String(warn.code ?? 'unknown'),
					message: String(warn.message ?? ''),
					assetId: warn.assetId ? String(warn.assetId) : undefined,
					assetKind: warn.assetKind
						? String(warn.assetKind)
						: undefined,
					stage: warn.stage ? String(warn.stage) : undefined
				}
			})
		}
	} catch (err) {
		return {
			type: 'ingest',
			success: false,
			error: err instanceof Error ? err.message : String(err)
		}
	}
}

/**
 * Handle delete-chunks command.
 */
async function handleDeleteChunks(command: {
	type: 'delete-chunks'
	chunkIds: string[]
}): Promise<DeleteChunksResult> {
	const runtime = getUnragDebugRuntime()
	if (!runtime?.storeInspector) {
		return {
			type: 'delete-chunks',
			success: false,
			error:
				'Chunk deletes require store inspector registration. ' +
				'In your app, call `registerUnragDebug({ engine, storeInspector })` when UNRAG_DEBUG=true.'
		}
	}

	const chunkIds = Array.isArray(command.chunkIds)
		? command.chunkIds.filter(Boolean)
		: []
	if (chunkIds.length === 0) {
		return {
			type: 'delete-chunks',
			success: false,
			error: 'Missing chunkIds.'
		}
	}

	try {
		const out = await runtime.storeInspector.deleteChunks({chunkIds})
		return {
			type: 'delete-chunks',
			success: true,
			deletedCount: out.deletedCount
		}
	} catch (err) {
		return {
			type: 'delete-chunks',
			success: false,
			error: err instanceof Error ? err.message : String(err)
		}
	}
}

/**
 * Handle list-documents command.
 * Note: This requires store access which depends on the context engine.
 */
async function handleListDocuments(_command: {
	type: 'list-documents'
	prefix?: string
	limit?: number
	offset?: number
}): Promise<ListDocumentsResult> {
	const runtime = getUnragDebugRuntime()
	if (!runtime?.storeInspector) {
		return {
			type: 'list-documents',
			success: false,
			error:
				'List documents requires a store inspector. ' +
				'In your app, call `registerUnragDebug({ engine, storeInspector })`.'
		}
	}

	const data = await runtime.storeInspector.listDocuments({
		prefix: _command.prefix,
		limit: _command.limit,
		offset: _command.offset
	})

	return {
		type: 'list-documents',
		success: true,
		...data
	}
}

/**
 * Handle get-document command.
 */
async function handleGetDocument(_command: {
	type: 'get-document'
	sourceId: string
}): Promise<GetDocumentResult> {
	const runtime = getUnragDebugRuntime()
	if (!runtime?.storeInspector) {
		return {
			type: 'get-document',
			success: false,
			error:
				'Get document requires a store inspector. ' +
				'In your app, call `registerUnragDebug({ engine, storeInspector })`.'
		}
	}

	const data = await runtime.storeInspector.getDocument({
		sourceId: _command.sourceId
	})

	return {
		type: 'get-document',
		success: true,
		...data
	}
}

/**
 * Handle delete-document command.
 */
async function handleDeleteDocument(_command: {
	type: 'delete-document'
	sourceId?: string
	sourceIdPrefix?: string
}): Promise<DeleteDocumentResult> {
	const runtime = getUnragDebugRuntime()

	const hasSourceId =
		typeof _command.sourceId === 'string' && _command.sourceId.length > 0
	const hasPrefix =
		typeof _command.sourceIdPrefix === 'string' &&
		_command.sourceIdPrefix.length > 0
	if (hasSourceId === hasPrefix) {
		return {
			type: 'delete-document',
			success: false,
			error: 'Provide exactly one of "sourceId" or "sourceIdPrefix".'
		}
	}

	const input = (() => {
		if (hasSourceId) {
			return {sourceId: _command.sourceId} as const
		}
		return {sourceIdPrefix: _command.sourceIdPrefix} as const
	})()

	// Prefer inspector (can optionally return counts).
	if (runtime?.storeInspector) {
		const res = await runtime.storeInspector.deleteDocument(input)
		return {
			type: 'delete-document',
			success: true,
			deletedCount: res.deletedCount
		}
	}

	if (!runtime?.engine) {
		return {
			type: 'delete-document',
			success: false,
			error:
				'Delete document requires engine registration (and optionally store inspector). ' +
				'In your app, call `registerUnragDebug({ engine })` when UNRAG_DEBUG=true.'
		}
	}

	await runtime.engine.delete(input)
	return {
		type: 'delete-document',
		success: true
	}
}

/**
 * Handle store-stats command.
 */
async function handleStoreStats(): Promise<StoreStatsResult> {
	const runtime = getUnragDebugRuntime()
	if (!runtime?.storeInspector) {
		return {
			type: 'store-stats',
			success: false,
			error:
				'Store stats requires a store inspector. ' +
				'In your app, call `registerUnragDebug({ engine, storeInspector })`.'
		}
	}

	const data = await runtime.storeInspector.storeStats()
	return {
		type: 'store-stats',
		success: true,
		...data
	}
}
