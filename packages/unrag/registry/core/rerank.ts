import {getDebugEmitter} from '@registry/core/debug-emitter'
import type {
	RerankCandidate,
	RerankInput,
	RerankRankingItem,
	RerankResult,
	ResolvedContextEngineConfig
} from '@registry/core/types'

const now = () => performance.now()

const createId = (): string => {
	if (
		typeof crypto !== 'undefined' &&
		typeof crypto.randomUUID === 'function'
	) {
		return crypto.randomUUID()
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Rerank candidates using the configured reranker.
 *
 * This is a pure function that takes the resolved config and input,
 * and returns reranked results with robust error handling.
 */
export const rerank = async (
	config: ResolvedContextEngineConfig,
	input: RerankInput
): Promise<RerankResult> => {
	const debug = getDebugEmitter()
	const totalStart = now()
	const warnings: string[] = []
	const opId = createId()
	const rootSpanId = createId()

	const {
		query,
		candidates,
		topK: requestedTopK,
		onMissingReranker = 'throw',
		onMissingText = 'throw',
		resolveText
	} = input

	// Validate candidates
	if (!Array.isArray(candidates) || candidates.length === 0) {
		return {
			chunks: [],
			ranking: [],
			meta: {rerankerName: 'none'},
			durations: {rerankMs: 0, totalMs: now() - totalStart},
			warnings: ['No candidates provided for reranking.']
		}
	}

	// Clamp topK to valid range
	const topK = Math.max(
		1,
		Math.min(requestedTopK ?? candidates.length, candidates.length)
	)

	// Handle missing reranker
	if (!config.reranker) {
		if (onMissingReranker === 'skip') {
			warnings.push('Reranker not configured; returning original order.')
			return {
				chunks: candidates.slice(0, topK),
				ranking: candidates.slice(0, topK).map((_, i) => ({index: i})),
				meta: {rerankerName: 'none'},
				durations: {rerankMs: 0, totalMs: now() - totalStart},
				warnings
			}
		}
		throw new Error(
			"Reranker not configured. Install the reranker battery (`unrag add battery reranker`) and wire it in your config, or use `onMissingReranker: 'skip'`."
		)
	}

	debug.emit({
		type: 'rerank:start',
		query,
		candidateCount: candidates.length,
		topK,
		rerankerName: config.reranker.name,
		opName: 'rerank',
		opId,
		spanId: rootSpanId
	})

	// Resolve text for each candidate
	const documents: string[] = []
	const validCandidateIndices: number[] = []
	const skippedIndices: number[] = []

	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i]
		if (!candidate) {
			continue
		}
		let text = candidate.content?.trim() ?? ''

		// Try resolveText hook if content is empty
		if (!text && resolveText) {
			try {
				text = (await resolveText(candidate))?.trim() ?? ''
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				warnings.push(`resolveText failed for candidate ${i}: ${msg}`)
			}
		}

		if (!text) {
			if (onMissingText === 'skip') {
				skippedIndices.push(i)
				warnings.push(`Candidate ${i} has no text; skipped.`)
				continue
			}
			throw new Error(
				`Candidate ${i} (id=${candidate.id}) has empty content. Enable 'storeChunkContent' in engine config, provide 'resolveText' hook, or use 'onMissingText: \"skip\"'.`
			)
		}

		documents.push(text)
		validCandidateIndices.push(i)
	}

	// If no valid documents, return original order
	if (documents.length === 0) {
		warnings.push(
			'All candidates have missing text; returning original order.'
		)
		return {
			chunks: candidates.slice(0, topK),
			ranking: candidates.slice(0, topK).map((_, i) => ({index: i})),
			meta: {rerankerName: config.reranker.name},
			durations: {rerankMs: 0, totalMs: now() - totalStart},
			warnings
		}
	}

	// Call the reranker
	const rerankStart = now()
	const result = await config.reranker.rerank({query, documents})
	const rerankMs = now() - rerankStart

	// Build ranking from reranker result
	// `result.order` is indices into the `documents` array (which maps to validCandidateIndices)
	const ranking: RerankRankingItem[] = []

	for (let rank = 0; rank < result.order.length; rank++) {
		const docIndex = result.order[rank]
		if (docIndex === undefined) {
			continue
		}
		const originalCandidateIndex = validCandidateIndices[docIndex]
		if (originalCandidateIndex === undefined) {
			continue
		}

		ranking.push({
			index: originalCandidateIndex,
			rerankScore: result.scores?.[rank]
		})
	}

	// Append skipped candidates at the end (stable tie-breaking: original order)
	for (const skippedIndex of skippedIndices) {
		ranking.push({index: skippedIndex})
	}

	// Apply stable sort for items with equal/undefined scores: preserve original retrieval order
	// The reranker already provides order, so we trust it for scored items.
	// Skipped items are already appended in original order.

	// Select top-K chunks
	const topKRanking = ranking.slice(0, topK)
	const chunks: RerankCandidate[] = []
	for (const r of topKRanking) {
		const candidate = candidates[r.index]
		if (candidate) {
			chunks.push(candidate)
		}
	}

	const totalMs = now() - totalStart

	debug.emit({
		type: 'rerank:complete',
		query,
		inputCount: candidates.length,
		outputCount: chunks.length,
		rerankMs,
		totalMs,
		rerankerName: config.reranker.name,
		model: result.model,
		opName: 'rerank',
		opId,
		spanId: rootSpanId
	})

	return {
		chunks,
		ranking,
		meta: {
			rerankerName: config.reranker.name,
			model: result.model
		},
		durations: {
			rerankMs,
			totalMs
		},
		warnings
	}
}
