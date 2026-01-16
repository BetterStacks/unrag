/**
 * Cohere reranker implementation using Vercel AI SDK.
 *
 * Uses Cohere's rerank-v3.5 model by default for high-quality relevance scoring.
 */

import type {Reranker} from '@registry/core/types'
import type {CohereRerankerConfig} from '@registry/rerank/types'

const DEFAULT_MODEL = 'rerank-v3.5'
const DEFAULT_MAX_DOCUMENTS = 1000

/**
 * Typed interface for Cohere SDK (lazy loaded).
 */
interface CohereProvider {
	reranking: (model: string) => unknown
}

/**
 * Typed interface for AI SDK rerank function.
 */
interface RerankFunction {
	(args: {
		model: unknown
		documents: string[]
		query: string
	}): Promise<{
		ranking: Array<{
			originalIndex: number
			score: number
		}>
	}>
}

/**
 * Create a Cohere reranker.
 *
 * @example
 * ```ts
 * import { createCohereReranker } from "@unrag/rerank";
 *
 * const reranker = createCohereReranker();
 * // or with custom config:
 * const reranker = createCohereReranker({ model: "rerank-english-v2.0" });
 * ```
 */
export const createCohereReranker = (
	config?: CohereRerankerConfig
): Reranker => {
	const model = config?.model ?? DEFAULT_MODEL
	const maxDocuments = config?.maxDocuments ?? DEFAULT_MAX_DOCUMENTS

	// Lazy load the SDK modules
	let cohereProvider: CohereProvider | null = null
	let rerankFn: RerankFunction | null = null

	const loadSdk = async () => {
		if (cohereProvider && rerankFn) return {cohereProvider, rerankFn}

		try {
			const [cohereModule, aiModule] = await Promise.all([
				import('@ai-sdk/cohere'),
				import('ai')
			])

			cohereProvider = cohereModule.cohere as CohereProvider
			rerankFn = aiModule.rerank as RerankFunction

			return {cohereProvider, rerankFn}
		} catch (err) {
			throw new Error(
				`Failed to load Cohere reranker dependencies. Make sure '@ai-sdk/cohere' and 'ai' are installed: ${err instanceof Error ? err.message : String(err)}`
			)
		}
	}

	return {
		name: 'cohere',
		rerank: async ({query, documents}) => {
			if (documents.length === 0) {
				return {order: [], scores: [], model}
			}

			const {cohereProvider: cohere, rerankFn: rerank} = await loadSdk()

			// Handle batching if documents exceed maxDocuments
			if (documents.length > maxDocuments) {
				// For now, we only process the first batch and warn
				// A more sophisticated implementation could merge results
				console.warn(
					`[unrag:rerank:cohere] Documents (${documents.length}) exceed maxDocuments (${maxDocuments}). Only the first ${maxDocuments} will be reranked.`
				)
				documents = documents.slice(0, maxDocuments)
			}

			const result = await rerank({
				model: cohere.reranking(model),
				documents,
				query
			})

			// Transform AI SDK result to our format
			// result.ranking is sorted by relevance (best first)
			const order: number[] = []
			const scores: number[] = []

			for (const item of result.ranking) {
				order.push(item.originalIndex)
				if (item.score !== undefined) {
					scores.push(item.score)
				}
			}

			return {
				order,
				scores: scores.length === order.length ? scores : undefined,
				model
			}
		}
	}
}
