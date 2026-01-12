/**
 * Reranker battery types.
 *
 * These are thin wrappers/re-exports from core types, plus battery-specific config types.
 */

// Re-export core Reranker interface
export type {
  Reranker,
  RerankerRerankArgs,
  RerankerRerankResult,
} from "@registry/core/types";

/**
 * Configuration for creating a Cohere reranker.
 */
export type CohereRerankerConfig = {
  /**
   * Cohere reranking model to use.
   * @default "rerank-v3.5"
   */
  model?: string;
  /**
   * Optional API key override. If not provided, uses COHERE_API_KEY env var.
   */
  apiKey?: string;
  /**
   * Optional base URL for Cohere API.
   */
  baseUrl?: string;
  /**
   * Maximum number of documents to rerank per request.
   * If candidates exceed this, they will be processed in batches.
   * @default 1000
   */
  maxDocuments?: number;
};

/**
 * Configuration for creating a custom reranker.
 */
export type CustomRerankerConfig = {
  /**
   * Name for the custom reranker (used in metadata).
   */
  name: string;
  /**
   * The rerank function to use.
   */
  rerank: (args: {
    query: string;
    documents: string[];
  }) => Promise<{
    order: number[];
    scores?: number[];
    model?: string;
  }>;
};
