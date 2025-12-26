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
  /**
   * Rich media processing controls.
   *
   * Notes:
   * - This generated config is cost-safe by default (all extraction is off).
   * - `unrag init --rich-media` can enable rich media ingestion for you (extractors + assetProcessing flags).
   * - Tighten fetch allowlists/limits in production if you ingest URL-based assets.
   */
  // __UNRAG_ASSET_PROCESSING_BLOCK_START__
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
        enabled: false, // __UNRAG_FLAG_pdf_textLayer__
        maxBytes: 15 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 200,
        // maxPages: 200,
      },
      llmExtraction: {
        enabled: false, // __UNRAG_FLAG_pdf_llmExtraction__
        model: "google/gemini-2.0-flash",
        prompt:
          "Extract all readable text from this PDF as faithfully as possible. Preserve structure with headings and lists when obvious. Output plain text or markdown only. Do not add commentary.",
        timeoutMs: 60_000,
        maxBytes: 15 * 1024 * 1024,
        maxOutputChars: 200_000,
      },
      // Worker-only OCR pipelines typically require native binaries (poppler/tesseract) or external services.
      ocr: {
        enabled: false, // __UNRAG_FLAG_pdf_ocr__
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
        enabled: false, // __UNRAG_FLAG_image_ocr__
        model: "google/gemini-2.0-flash",
        prompt:
          "Extract all readable text from this image as faithfully as possible. Output plain text only. Do not add commentary.",
        timeoutMs: 60_000,
        maxBytes: 10 * 1024 * 1024,
        maxOutputChars: 50_000,
      },
      captionLlm: {
        enabled: false, // __UNRAG_FLAG_image_captionLlm__
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
        enabled: false, // __UNRAG_FLAG_audio_transcription__
        model: "openai/whisper-1",
        timeoutMs: 120_000,
        maxBytes: 25 * 1024 * 1024,
      },
    },
    video: {
      transcription: {
        enabled: false, // __UNRAG_FLAG_video_transcription__
        model: "openai/whisper-1",
        timeoutMs: 120_000,
        maxBytes: 50 * 1024 * 1024,
      },
      frames: {
        enabled: false, // __UNRAG_FLAG_video_frames__
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
        enabled: false, // __UNRAG_FLAG_file_text__
        maxBytes: 5 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 50,
      },
      docx: {
        enabled: false, // __UNRAG_FLAG_file_docx__
        maxBytes: 15 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 50,
      },
      pptx: {
        enabled: false, // __UNRAG_FLAG_file_pptx__
        maxBytes: 30 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 50,
      },
      xlsx: {
        enabled: false, // __UNRAG_FLAG_file_xlsx__
        maxBytes: 30 * 1024 * 1024,
        maxOutputChars: 200_000,
        minChars: 50,
      },
    },
  },
  // __UNRAG_ASSET_PROCESSING_BLOCK_END__
  },
} as const);

// __UNRAG_CREATE_ENGINE__


