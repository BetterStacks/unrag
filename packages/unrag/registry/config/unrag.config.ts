/**
 * Root Unrag config (generated).
 *
 * This file is meant to be the single place you tweak:
 * - Defaults (chunking + retrieval)
 * - Engine settings (storage, asset processing, extractors)
 * - Embedding provider/model/timeouts
 * - How you construct your DB client (Pool/Prisma/etc) and vector store adapter
 *
 * The files under your install dir (e.g. `lib/unrag/**`) are intended to be
 * treated like vendored source code.
 */

// @ts-nocheck

// __UNRAG_IMPORTS__

export const unrag = defineUnragConfig({
  defaults: {
  chunking: {
    chunkSize: 200, // __UNRAG_DEFAULT_chunkSize__
    chunkOverlap: 40, // __UNRAG_DEFAULT_chunkOverlap__
  },
  retrieval: {
    topK: 8, // __UNRAG_DEFAULT_topK__
  },
  },
  embedding: {
    provider: "ai",
    config: {
      model: "openai/text-embedding-3-small", // __UNRAG_EMBEDDING_MODEL__
      timeoutMs: 15_000, // __UNRAG_EMBEDDING_TIMEOUT__
    },
  },
  engine: {
  /**
   * Storage controls.
   *
   * - storeChunkContent: whether `chunk.content` is persisted and returned by retrieval.
   * - storeDocumentContent: whether the full original document text is stored in `documents.content`.
   */
  storage: {
    storeChunkContent: true, // __UNRAG_STORAGE_storeChunkContent__
    storeDocumentContent: true, // __UNRAG_STORAGE_storeDocumentContent__
  },
    /**
     * Optional extractor modules that can process non-text assets into text outputs.
     *
     * To install:
     * - `unrag add extractor pdf-llm`
     *
     * Then import it in this file and add it here, for example:
     * - `import { createPdfLlmExtractor } from "./lib/unrag/extractors/pdf-llm";`
     * - `extractors: [createPdfLlmExtractor()]`
     */
    extractors: [
      // __UNRAG_EXTRACTORS__
    ],
  // __UNRAG_ASSET_PROCESSING_OVERRIDES__
  },
} as const);

// __UNRAG_CREATE_ENGINE__


