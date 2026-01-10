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

import { defineUnragConfig } from "./lib/unrag/core";
import { createDrizzleVectorStore } from "./lib/unrag/store/drizzle";
import { createCohereReranker } from "./lib/unrag/rerank";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

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
      model: "openai/text-embedding-3-small",
      timeoutMs: 15_000,
    },
  },
  engine: {
  /**
   * Reranker for second-stage ranking after retrieval.
   */
  reranker: createCohereReranker(),
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
    extractors: [

    ],
  /**
   * Rich media processing controls.
   *
   * Notes:
   * - This generated config is cost-safe by default (all extraction is off).
   * - `unrag init --rich-media` can enable rich media ingestion for you (extractors + assetProcessing flags).
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
      // Fast/cheap text-layer extraction (requires installing a PDF text-layer extractor module).
      textLayer: {
        enabled: false,
        maxBytes: 15 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 200,
        // maxPages: 200,
      },
      llmExtraction: {
        enabled: false,
        model: "google/gemini-2.0-flash",
        prompt:
          "Extract all readable text from this PDF as faithfully as possible. Preserve structure with headings and lists when obvious. Output plain text or markdown only. Do not add commentary.",
        timeoutMs: 60_000,
        maxBytes: 15 * 1024 * 1024,
        maxOutputChars: 200_000,
      },
      // Worker-only OCR pipelines typically require native binaries (poppler/tesseract) or external services.
      ocr: {
        enabled: false,
        maxBytes: 15 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 200,
        // maxPages: 200,
        // pdftoppmPath: "/usr/bin/pdftoppm",
        // tesseractPath: "/usr/bin/tesseract",
        // dpi: 200,
        // lang: "eng",
      },
    },
    image: {
      ocr: {
        enabled: false,
        model: "google/gemini-2.0-flash",
        prompt:
          "Extract all readable text from this image as faithfully as possible. Output plain text only. Do not add commentary.",
        timeoutMs: 60_000,
        maxBytes: 10 * 1024 * 1024,
        maxOutputChars: 50_000,
      },
      captionLlm: {
        enabled: false,
        model: "google/gemini-2.0-flash",
        prompt:
          "Write a concise, information-dense caption for this image. Include names, numbers, and labels if visible. Output plain text only.",
        timeoutMs: 60_000,
        maxBytes: 10 * 1024 * 1024,
        maxOutputChars: 10_000,
      },
    },
    audio: {
      transcription: {
        enabled: false,
        model: "openai/whisper-1",
        timeoutMs: 120_000,
        maxBytes: 25 * 1024 * 1024,
      },
    },
    video: {
      transcription: {
        enabled: false,
        model: "openai/whisper-1",
        timeoutMs: 120_000,
        maxBytes: 50 * 1024 * 1024,
      },
      frames: {
        enabled: false,
        sampleFps: 0.2,
        maxFrames: 50,
        // ffmpegPath: "/usr/bin/ffmpeg",
        maxBytes: 50 * 1024 * 1024,
        model: "google/gemini-2.0-flash",
        prompt:
          "Extract all readable text from this video frame as faithfully as possible. Output plain text only. Do not add commentary.",
        timeoutMs: 60_000,
        maxOutputChars: 50_000,
      },
    },
    file: {
      text: {
        enabled: false,
        maxBytes: 5 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 50,
      },
      docx: {
        enabled: false,
        maxBytes: 15 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 50,
      },
      pptx: {
        enabled: false,
        maxBytes: 30 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 50,
      },
      xlsx: {
        enabled: false,
        maxBytes: 30 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 50,
      },
    },
  },
  
  },
} as const);

export function createUnragEngine() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const pool = (globalThis as any).__unragPool ?? new Pool({ connectionString: databaseUrl });
  (globalThis as any).__unragPool = pool;

  const db = (globalThis as any).__unragDrizzleDb ?? drizzle(pool);
  (globalThis as any).__unragDrizzleDb = db;

  const store = createDrizzleVectorStore(db);

  return unrag.createEngine({ store });
}


