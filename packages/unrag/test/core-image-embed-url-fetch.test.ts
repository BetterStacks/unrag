import { describe, expect, test } from "bun:test";
import { ingest } from "@registry/core/ingest";
import type { ResolvedContextEngineConfig } from "@registry/core/types";

describe("image embedding URL hardening", () => {
  test("fetches image URL using assetProcessing.fetch and passes bytes (not URL) to embedImage", async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    let embedImageCalls = 0;

    try {
      globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
        fetchCalls.push({ url: String(url), init });
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": "3",
          },
        });
      }) as typeof fetch;

      const config: ResolvedContextEngineConfig = {
        embedding: {
          name: "test-embedding",
          embed: async () => [0.1, 0.2, 0.3],
          embedImage: async (input) => {
            embedImageCalls += 1;
            expect(input.data).toBeInstanceOf(Uint8Array);
            expect(input.mediaType).toBe("image/png");
            return [0.9, 0.8, 0.7];
          },
        },
        embeddingProcessing: { concurrency: 2, batchSize: 8 },
        store: {
          upsert: async (chunks) => ({ documentId: chunks[0]?.documentId ?? "doc" }),
          query: async () => [],
          delete: async () => {},
        },
        defaults: { chunkSize: 200, chunkOverlap: 40 },
        chunker: (content) => [
          { index: 0, content: String(content ?? ""), tokenCount: 1 },
        ],
        idGenerator: () => "id",
        extractors: [],
        storage: { storeChunkContent: true, storeDocumentContent: true },
        assetProcessing: {
          onUnsupportedAsset: "skip",
          onError: "skip",
          concurrency: 1,
          hooks: { onEvent: undefined },
          fetch: {
            enabled: true,
            allowedHosts: ["example.com"],
            maxBytes: 1024,
            timeoutMs: 10_000,
            headers: { "x-global": "1" },
          },
          pdf: {
            textLayer: {
              enabled: false,
              maxBytes: 15 * 1024 * 1024,
              maxOutputChars: 200_000,
              minChars: 200,
              maxPages: undefined,
            },
            llmExtraction: {
              enabled: false,
              model: "google/gemini-2.0-flash",
              prompt: "Extract",
              timeoutMs: 60_000,
              maxBytes: 15 * 1024 * 1024,
              maxOutputChars: 200_000,
            },
            ocr: {
              enabled: false,
              maxBytes: 15 * 1024 * 1024,
              maxOutputChars: 200_000,
              minChars: 200,
              maxPages: undefined,
              pdftoppmPath: undefined,
              tesseractPath: undefined,
              dpi: 200,
              lang: "eng",
            },
          },
          image: {
            ocr: {
              enabled: false,
              model: "google/gemini-2.0-flash",
              prompt: "OCR",
              timeoutMs: 60_000,
              maxBytes: 10 * 1024 * 1024,
              maxOutputChars: 50_000,
            },
            captionLlm: {
              enabled: false,
              model: "google/gemini-2.0-flash",
              prompt: "Caption",
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
              ffmpegPath: undefined,
              maxBytes: 50 * 1024 * 1024,
              model: "google/gemini-2.0-flash",
              prompt: "Frames",
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
        sourceId: "docs:image-url",
        content: "hello",
        assets: [
          {
            assetId: "img-1",
            kind: "image",
            data: {
              kind: "url",
              url: "https://example.com/a.png",
              headers: { "x-asset": "2" },
            },
          },
        ],
      });

      expect(result.warnings).toEqual([]);
      expect(embedImageCalls).toBe(1);
      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0]!.url).toBe("https://example.com/a.png");

      const rawHeaders = fetchCalls[0]!.init?.headers ?? {};
      const headers =
        rawHeaders instanceof Headers
          ? Object.fromEntries(rawHeaders.entries())
          : (rawHeaders as Record<string, string>);
      expect(headers["user-agent"]).toBe("unrag/asset-fetch");
      expect(headers["x-global"]).toBe("1");
      expect(headers["x-asset"]).toBe("2");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("when fetch is disabled and onError=skip, emits asset_processing_error(stage=fetch) and does not call embedImage", async () => {
    const originalFetch = globalThis.fetch;
    let embedImageCalls = 0;

    try {
      globalThis.fetch = (async () => {
        throw new Error("fetch should not be called when fetch is disabled");
      }) as typeof fetch;

      const config: ResolvedContextEngineConfig = {
        embedding: {
          name: "test-embedding",
          embed: async () => [0.1, 0.2, 0.3],
          embedImage: async () => {
            embedImageCalls += 1;
            return [0.9, 0.8, 0.7];
          },
        },
        embeddingProcessing: { concurrency: 2, batchSize: 8 },
        store: {
          upsert: async (chunks) => ({ documentId: chunks[0]?.documentId ?? "doc" }),
          query: async () => [],
          delete: async () => {},
        },
        defaults: { chunkSize: 200, chunkOverlap: 40 },
        chunker: (content) => [
          { index: 0, content: String(content ?? ""), tokenCount: 1 },
        ],
        idGenerator: () => "id",
        extractors: [],
        storage: { storeChunkContent: true, storeDocumentContent: true },
        assetProcessing: {
          onUnsupportedAsset: "skip",
          onError: "skip",
          concurrency: 1,
          hooks: { onEvent: undefined },
          fetch: {
            enabled: false,
            allowedHosts: ["example.com"],
            maxBytes: 1024,
            timeoutMs: 10_000,
            headers: {},
          },
          pdf: {
            textLayer: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1, maxPages: undefined },
            llmExtraction: { enabled: false, model: "m", prompt: "p", timeoutMs: 1, maxBytes: 1, maxOutputChars: 1 },
            ocr: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1, maxPages: undefined, pdftoppmPath: undefined, tesseractPath: undefined, dpi: 200, lang: "eng" },
          },
          image: {
            ocr: { enabled: false, model: "m", prompt: "p", timeoutMs: 1, maxBytes: 1, maxOutputChars: 1 },
            captionLlm: { enabled: false, model: "m", prompt: "p", timeoutMs: 1, maxBytes: 1, maxOutputChars: 1 },
          },
          audio: { transcription: { enabled: false, model: "m", timeoutMs: 1, maxBytes: 1 } },
          video: {
            transcription: { enabled: false, model: "m", timeoutMs: 1, maxBytes: 1 },
            frames: { enabled: false, sampleFps: 0.2, maxFrames: 1, ffmpegPath: undefined, maxBytes: 1, model: "m", prompt: "p", timeoutMs: 1, maxOutputChars: 1 },
          },
          file: {
            text: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1 },
            docx: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1 },
            pptx: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1 },
            xlsx: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1 },
          },
        },
      };

      const result = await ingest(config, {
        sourceId: "docs:image-url-disabled",
        content: "hello",
        assets: [
          {
            assetId: "img-1",
            kind: "image",
            data: { kind: "url", url: "https://example.com/a.png" },
          },
        ],
      });

      expect(embedImageCalls).toBe(0);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]?.code).toBe("asset_processing_error");
      expect((result.warnings[0] as any).stage).toBe("fetch");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("when fetch is disabled and onError=fail, ingest throws", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () => {
        throw new Error("fetch should not be called when fetch is disabled");
      }) as typeof fetch;

      const config: ResolvedContextEngineConfig = {
        embedding: {
          name: "test-embedding",
          embed: async () => [0.1, 0.2, 0.3],
          embedImage: async () => [0.9, 0.8, 0.7],
        },
        embeddingProcessing: { concurrency: 2, batchSize: 8 },
        store: {
          upsert: async (chunks) => ({ documentId: chunks[0]?.documentId ?? "doc" }),
          query: async () => [],
          delete: async () => {},
        },
        defaults: { chunkSize: 200, chunkOverlap: 40 },
        chunker: (content) => [
          { index: 0, content: String(content ?? ""), tokenCount: 1 },
        ],
        idGenerator: () => "id",
        extractors: [],
        storage: { storeChunkContent: true, storeDocumentContent: true },
        assetProcessing: {
          onUnsupportedAsset: "skip",
          onError: "fail",
          concurrency: 1,
          hooks: { onEvent: undefined },
          fetch: {
            enabled: false,
            allowedHosts: ["example.com"],
            maxBytes: 1024,
            timeoutMs: 10_000,
            headers: {},
          },
          pdf: {
            textLayer: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1, maxPages: undefined },
            llmExtraction: { enabled: false, model: "m", prompt: "p", timeoutMs: 1, maxBytes: 1, maxOutputChars: 1 },
            ocr: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1, maxPages: undefined, pdftoppmPath: undefined, tesseractPath: undefined, dpi: 200, lang: "eng" },
          },
          image: {
            ocr: { enabled: false, model: "m", prompt: "p", timeoutMs: 1, maxBytes: 1, maxOutputChars: 1 },
            captionLlm: { enabled: false, model: "m", prompt: "p", timeoutMs: 1, maxBytes: 1, maxOutputChars: 1 },
          },
          audio: { transcription: { enabled: false, model: "m", timeoutMs: 1, maxBytes: 1 } },
          video: {
            transcription: { enabled: false, model: "m", timeoutMs: 1, maxBytes: 1 },
            frames: { enabled: false, sampleFps: 0.2, maxFrames: 1, ffmpegPath: undefined, maxBytes: 1, model: "m", prompt: "p", timeoutMs: 1, maxOutputChars: 1 },
          },
          file: {
            text: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1 },
            docx: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1 },
            pptx: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1 },
            xlsx: { enabled: false, maxBytes: 1, maxOutputChars: 1, minChars: 1 },
          },
        },
      };

      await expect(
        ingest(config, {
          sourceId: "docs:image-url-disabled-fail",
          content: "hello",
          assets: [
            {
              assetId: "img-1",
              kind: "image",
              data: { kind: "url", url: "https://example.com/a.png" },
            },
          ],
        })
      ).rejects.toThrow("Asset fetch disabled");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

