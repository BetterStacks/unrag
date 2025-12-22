/**
 * Root Unrag config (generated).
 *
 * This file is meant to be the single place you tweak:
 * - Embedding provider/model/timeouts
 * - Chunking defaults
 * - Retrieval defaults
 * - Optional extractor modules (PDF/OCR/transcription/etc)
 * - How you construct your DB client (Pool/Prisma/etc)
 *
 * The files under your install dir (e.g. `lib/unrag/**`) are intended to be
 * treated like vendored source code.
 */

// __UNRAG_IMPORTS__

export const unragConfig = {
  chunking: {
    chunkSize: 200,
    chunkOverlap: 40,
  },
  retrieval: {
    topK: 8,
  },
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
  embedding: {
    type: "text",
    model: "openai/text-embedding-3-small",
    timeoutMs: 15_000,
  },
  /**
   * Rich media processing controls.
   *
   * Notes:
   * - The library defaults are cost-safe (PDF LLM extraction is off).
   * - This generated config opts you into PDF extraction for convenience.
   * - To actually extract PDFs, install and register a PDF extractor module:
   *   - `unrag add extractor pdf-llm`
   *   - import it in this file and add it to the `extractors` array in createUnragEngine()
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
} as const;

// __UNRAG_CREATE_ENGINE__


