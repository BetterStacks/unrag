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

// __UNRAG_IMPORTS__

export const unrag = defineUnragConfig({
  defaults: {
  chunking: {
    chunkSize: 200,
    chunkOverlap: 40,
  },
  retrieval: {
    topK: 8,
  },
  },
  embedding: {
    provider: "ai",
    config: {
      type: "text",
      model: "openai/text-embedding-3-small",
      timeoutMs: 15_000,
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
    storeChunkContent: true,
    storeDocumentContent: true,
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
    extractors: [],
  /**
   * Rich media processing controls.
   *
   * Notes:
   * - The library defaults are cost-safe (PDF LLM extraction is off).
   * - This generated config opts you into PDF extraction for convenience.
   * - Tighten fetch allowlists/limits in production if you ingest URL-based assets.
   */
  assetProcessing: {
    onUnsupportedAsset: "skip",
    onError: "skip",
    concurrency: 4,
    fetch: {
      enabled: true,
      maxBytes: 15 * 1024 * 1024,
      timeoutMs: 20_000,
      // allowedHosts: ["..."], // recommended to mitigate SSRF
    },
    pdf: {
      llmExtraction: {
        enabled: true,
        model: "google/gemini-2.0-flash",
        prompt:
          "Extract all readable text from this PDF as faithfully as possible. Preserve structure with headings and lists when obvious. Output plain text or markdown only. Do not add commentary.",
        timeoutMs: 60_000,
        maxBytes: 15 * 1024 * 1024,
        maxOutputChars: 200_000,
      },
    },
  },
  },
} as const);

// __UNRAG_CREATE_ENGINE__


