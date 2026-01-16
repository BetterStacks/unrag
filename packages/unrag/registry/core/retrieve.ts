import type {
	RetrieveInput,
	RetrieveResult,
	ResolvedContextEngineConfig
} from '@registry/core/types'
import {getDebugEmitter} from '@registry/core/debug-emitter'

const now = () => performance.now()

const DEFAULT_TOP_K = 8

const createId = (): string => {
	if (
		typeof crypto !== 'undefined' &&
		typeof crypto.randomUUID === 'function'
	) {
		return crypto.randomUUID()
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

export const retrieve = async (
	config: ResolvedContextEngineConfig,
	input: RetrieveInput
): Promise<RetrieveResult> => {
	const debug = getDebugEmitter()
	const totalStart = now()
	const topK = input.topK ?? DEFAULT_TOP_K
	const opId = createId()
	const rootSpanId = createId()
	const embeddingSpanId = createId()
	const retrievalSpanId = createId()

	debug.emit({
		type: 'retrieve:start',
		query: input.query,
		topK,
		scope: input.scope,
		opName: 'retrieve',
		opId,
		spanId: rootSpanId
	})

	const embeddingStart = now()
	const queryEmbedding = await config.embedding.embed({
		text: input.query,
		metadata: {},
		position: 0,
		sourceId: 'query',
		documentId: 'query'
	})
	const embeddingMs = now() - embeddingStart

	debug.emit({
		type: 'retrieve:embedding-complete',
		query: input.query,
		embeddingProvider: config.embedding.name,
		embeddingDimension: queryEmbedding.length,
		durationMs: embeddingMs,
		opName: 'retrieve',
		opId,
		spanId: embeddingSpanId,
		parentSpanId: rootSpanId
	})

	const retrievalStart = now()
	const chunks = await config.store.query({
		embedding: queryEmbedding,
		topK,
		scope: input.scope
	})
	const retrievalMs = now() - retrievalStart

	debug.emit({
		type: 'retrieve:database-complete',
		query: input.query,
		resultsCount: chunks.length,
		durationMs: retrievalMs,
		opName: 'retrieve',
		opId,
		spanId: retrievalSpanId,
		parentSpanId: rootSpanId
	})

	const totalMs = now() - totalStart

	debug.emit({
		type: 'retrieve:complete',
		query: input.query,
		resultsCount: chunks.length,
		topK,
		totalDurationMs: totalMs,
		embeddingMs,
		retrievalMs,
		opName: 'retrieve',
		opId,
		spanId: rootSpanId
	})

	return {
		chunks,
		embeddingModel: config.embedding.name,
		durations: {
			totalMs,
			embeddingMs,
			retrievalMs
		}
	}
}
