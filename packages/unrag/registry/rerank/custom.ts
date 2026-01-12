/**
 * Custom reranker factory.
 *
 * Use this to bring your own reranking logic or integrate with other providers.
 */

import type { Reranker } from "@registry/core/types";
import type { CustomRerankerConfig } from "./types";

/**
 * Create a custom reranker with your own implementation.
 *
 * @example
 * ```ts
 * import { createCustomReranker } from "@unrag/rerank";
 *
 * const reranker = createCustomReranker({
 *   name: "my-reranker",
 *   rerank: async ({ query, documents }) => {
 *     // Your custom logic here
 *     // Return order as indices into documents array (best first)
 *     const scores = await myRerankerApi.score(query, documents);
 *     const order = scores
 *       .map((score, index) => ({ score, index }))
 *       .sort((a, b) => b.score - a.score)
 *       .map(item => item.index);
 *     return { order, scores: order.map(i => scores[i]) };
 *   },
 * });
 * ```
 *
 * @example Using with an LLM for reranking
 * ```ts
 * const reranker = createCustomReranker({
 *   name: "llm-reranker",
 *   rerank: async ({ query, documents }) => {
 *     // Use an LLM to score each document
 *     const scores = await Promise.all(
 *       documents.map(async (doc) => {
 *         const response = await llm.complete({
 *           prompt: `Rate relevance of "${doc}" to query "${query}" from 0-10:`,
 *         });
 *         return parseFloat(response) || 0;
 *       })
 *     );
 *     const order = scores
 *       .map((score, index) => ({ score, index }))
 *       .sort((a, b) => b.score - a.score)
 *       .map(item => item.index);
 *     return { order, scores: order.map(i => scores[i]), model: "custom-llm" };
 *   },
 * });
 * ```
 */
export const createCustomReranker = (config: CustomRerankerConfig): Reranker => {
  return {
    name: config.name,
    rerank: config.rerank,
  };
};
