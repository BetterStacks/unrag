/**
 * Reranker battery module.
 *
 * Provides reranking implementations for second-stage ranking after retrieval.
 * Install via `unrag add battery reranker`.
 *
 * @example Default Cohere reranker
 * ```ts
 * import { createCohereReranker } from "@unrag/rerank";
 *
 * const reranker = createCohereReranker();
 * ```
 *
 * @example Custom reranker
 * ```ts
 * import { createCustomReranker } from "@unrag/rerank";
 *
 * const reranker = createCustomReranker({
 *   name: "my-reranker",
 *   rerank: async ({ query, documents }) => {
 *     // Your logic here
 *     return { order: [0, 1, 2] };
 *   },
 * });
 * ```
 */

// Factories
export {createCohereReranker} from '@unrag/rerank/cohere'
export {createCustomReranker} from '@unrag/rerank/custom'

// Types
export type {
	Reranker,
	RerankerRerankArgs,
	RerankerRerankResult,
	CohereRerankerConfig,
	CustomRerankerConfig
} from '@unrag/rerank/types'

