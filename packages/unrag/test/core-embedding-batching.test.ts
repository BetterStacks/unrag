import { describe, expect, test } from "bun:test";
import { ingest } from "@registry/core/ingest";
import type { ResolvedContextEngineConfig } from "@registry/core/types";

const multiChunker: ResolvedContextEngineConfig["chunker"] = (content) => {
  const parts = String(content ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((p, i) => ({
    index: i,
    content: p,
    tokenCount: p.split(/\s+/).filter(Boolean).length,
  }));
};

const baseConfig = (embedding: ResolvedContextEngineConfig["embedding"]): ResolvedContextEngineConfig => ({
  embedding,
  embeddingProcessing: { concurrency: 2, batchSize: 2 },
  store: {
    upsert: async (chunks) => ({ documentId: chunks[0]?.documentId ?? "test-doc-id" }),
    query: async () => [],
    delete: async () => {},
  },
  defaults: { chunkSize: 200, chunkOverlap: 40 },
  chunker: multiChunker,
  idGenerator: () => crypto.randomUUID(),
  extractors: [],
  storage: { storeChunkContent: true, storeDocumentContent: true },
  assetProcessing: {
    onUnsupportedAsset: "skip",
    onError: "skip",
    concurrency: 1,
    fetch: { enabled: true, maxBytes: 15 * 1024 * 1024, timeoutMs: 20_000 },
    pdf: {
      textLayer: { enabled: false, maxBytes: 15 * 1024 * 1024, maxOutputChars: 200_000, minChars: 200 },
      llmExtraction: {
        enabled: false,
        model: "google/gemini-2.0-flash",
        prompt: "Extract all readable text...",
        timeoutMs: 60_000,
        maxBytes: 15 * 1024 * 1024,
        maxOutputChars: 200_000,
      },
      ocr: { enabled: false, maxBytes: 15 * 1024 * 1024, maxOutputChars: 200_000, minChars: 200, dpi: 200, lang: "eng" },
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
    audio: { transcription: { enabled: false, model: "openai/whisper-1", timeoutMs: 120_000, maxBytes: 25 * 1024 * 1024 } },
    video: {
      transcription: { enabled: false, model: "openai/whisper-1", timeoutMs: 120_000, maxBytes: 50 * 1024 * 1024 },
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
      text: { enabled: false, maxBytes: 5 * 1024 * 1024, maxOutputChars: 200_000, minChars: 50 },
      docx: { enabled: false, maxBytes: 15 * 1024 * 1024, maxOutputChars: 200_000, minChars: 50 },
      pptx: { enabled: false, maxBytes: 30 * 1024 * 1024, maxOutputChars: 200_000, minChars: 50 },
      xlsx: { enabled: false, maxBytes: 30 * 1024 * 1024, maxOutputChars: 200_000, minChars: 50 },
    },
  },
});

describe("core embedding batching + concurrency", () => {
  test("uses embedMany when present (batching by batchSize)", async () => {
    let embedCalls = 0;
    let embedManyCalls = 0;

    const config = baseConfig({
      name: "test-embedding",
      embed: async () => {
        embedCalls++;
        return [0.1, 0.2, 0.3];
      },
      embedMany: async (inputs) => {
        embedManyCalls++;
        return inputs.map((_, i) => [i, i + 1, i + 2]);
      },
    });

    config.embeddingProcessing = { concurrency: 2, batchSize: 2 };

    const result = await ingest(config, {
      sourceId: "docs:embedmany",
      content: "a|b|c",
    });

    expect(result.chunkCount).toBe(3);
    expect(embedCalls).toBe(0);
    expect(embedManyCalls).toBe(2); // 3 chunks with batchSize 2 => 2 calls
  });

  test("bounds concurrency for embedMany batches", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const config = baseConfig({
      name: "test-embedding",
      embed: async () => [0.1, 0.2, 0.3],
      embedMany: async (inputs) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 15));
        inFlight--;
        return inputs.map(() => [0.1, 0.2, 0.3]);
      },
    });

    // Make each chunk its own batch to stress concurrency.
    config.embeddingProcessing = { concurrency: 2, batchSize: 1 };

    await ingest(config, {
      sourceId: "docs:embedmany-concurrency",
      content: "a|b|c|d|e|f",
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  test("falls back to embed() and bounds concurrency when embedMany is absent", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let embedCalls = 0;

    const config = baseConfig({
      name: "test-embedding",
      embed: async () => {
        embedCalls++;
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 15));
        inFlight--;
        return [0.1, 0.2, 0.3];
      },
    });

    config.embeddingProcessing = { concurrency: 2, batchSize: 10 };

    const result = await ingest(config, {
      sourceId: "docs:embed-fallback",
      content: "a|b|c|d|e|f",
    });

    expect(result.chunkCount).toBe(6);
    expect(embedCalls).toBe(6);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});


