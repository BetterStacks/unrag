import { describe, expect, test } from "bun:test";
import { ingest } from "../registry/core/ingest";
import type { ResolvedContextEngineConfig } from "../registry/core/types";

describe("core ingest warnings", () => {
  test("emits warnings for skipped assets (unsupported kind, pdf extraction disabled, image without caption + no multimodal)", async () => {
    const config: ResolvedContextEngineConfig = {
      embedding: {
        name: "test-embedding",
        embed: async () => [0.1, 0.2, 0.3],
        // No embedImage => image assets require caption
      },
      embeddingProcessing: { concurrency: 4, batchSize: 32 },
      store: {
        upsert: async () => {},
        query: async () => [],
        delete: async () => {},
      },
      defaults: { chunkSize: 200, chunkOverlap: 40 },
      chunker: (content) => {
        const text = (content ?? "").trim();
        if (!text) return [];
        return [{ index: 0, content: text, tokenCount: text.split(/\s+/).filter(Boolean).length }];
      },
      idGenerator: () => "id",
      extractors: [],
      storage: { storeChunkContent: true, storeDocumentContent: true },
      assetProcessing: {
        onUnsupportedAsset: "skip",
        onError: "skip",
        concurrency: 1,
        fetch: { enabled: true, maxBytes: 15 * 1024 * 1024, timeoutMs: 20_000 },
        pdf: {
          textLayer: {
            enabled: false,
            maxBytes: 15 * 1024 * 1024,
            maxOutputChars: 200_000,
            minChars: 200,
          },
          llmExtraction: {
            enabled: false,
            model: "google/gemini-2.0-flash",
            prompt: "Extract all readable text...",
            timeoutMs: 60_000,
            maxBytes: 15 * 1024 * 1024,
            maxOutputChars: 200_000,
          },
          ocr: {
            enabled: false,
            maxBytes: 15 * 1024 * 1024,
            maxOutputChars: 200_000,
            minChars: 200,
            dpi: 200,
            lang: "eng",
          },
        },
        image: {
          ocr: {
            enabled: false,
            model: "google/gemini-2.0-flash",
            prompt: "Extract text from image",
            timeoutMs: 60_000,
            maxBytes: 10 * 1024 * 1024,
            maxOutputChars: 50_000,
          },
          captionLlm: {
            enabled: false,
            model: "google/gemini-2.0-flash",
            prompt: "Write a caption for this image",
            timeoutMs: 60_000,
            maxBytes: 10 * 1024 * 1024,
            maxOutputChars: 10_000,
          },
        },
        audio: {
          transcription: {
            enabled: true,
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
            maxBytes: 50 * 1024 * 1024,
            model: "google/gemini-2.0-flash",
            prompt: "Extract text from frame",
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
    };

    const result = await ingest(config, {
      sourceId: "docs:test",
      content: "hello world",
      assets: [
        {
          assetId: "pdf-1",
          kind: "pdf",
          data: { kind: "url", url: "https://example.com/a.pdf", mediaType: "application/pdf" },
        },
        {
          assetId: "img-1",
          kind: "image",
          data: { kind: "url", url: "https://example.com/a.png", mediaType: "image/png" },
          text: "",
        },
        {
          assetId: "audio-1",
          kind: "audio",
          data: { kind: "url", url: "https://example.com/a.mp3", mediaType: "audio/mpeg" },
        },
      ],
    });

    const codes = result.warnings.map((w) => w.code).sort();
    expect(codes).toEqual(
      [
        "asset_skipped_image_no_multimodal_and_no_caption",
        "asset_skipped_pdf_llm_extraction_disabled",
        "asset_skipped_unsupported_kind",
      ].sort()
    );

    // Ensure we still ingested the base text.
    expect(result.chunkCount).toBe(1);
  });
});


