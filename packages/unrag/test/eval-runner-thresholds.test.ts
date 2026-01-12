import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";

import { runEval } from "@registry/eval/runner";

const workspaceTmpRoot = path.join(process.cwd(), "tmp", "test-runs");

async function writeJson(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

describe("eval runner thresholds", () => {
  let runDir: string;

  beforeEach(async () => {
    runDir = path.join(workspaceTmpRoot, crypto.randomUUID());
    await rm(runDir, { recursive: true, force: true });
    await mkdir(runDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(runDir, { recursive: true, force: true });
  });

  test("fails thresholds with exitCode=1", async () => {
    const datasetPath = path.join(runDir, "dataset.json");
    await writeJson(datasetPath, {
      version: "1",
      id: "t",
      defaults: { scopePrefix: "eval:t:", topK: 2, mode: "retrieve" },
      queries: [
        {
          id: "q1",
          query: "refund window",
          relevant: { sourceIds: ["eval:t:doc:refund"] },
        },
      ],
    });

    const engine = {
      retrieve: async () => ({
        chunks: [
          {
            id: "c1",
            documentId: "d1",
            sourceId: "eval:t:doc:other",
            index: 0,
            content: "other",
            tokenCount: 1,
            metadata: {},
            score: 0.9,
          },
        ],
        embeddingModel: "test-embed",
        durations: { embeddingMs: 1, retrievalMs: 1, totalMs: 2 },
      }),
      rerank: async () => {
        throw new Error("not used");
      },
      ingest: async () => {
        throw new Error("not used");
      },
      delete: async () => {},
    } as any;

    const result = await runEval({
      engine,
      datasetPath,
      ingest: false,
      thresholds: { min: { recallAtK: 0.75 } },
    });

    expect(result.exitCode).toBe(1);
    expect(result.thresholdFailures.length).toBeGreaterThan(0);
  });

  test("passes thresholds when recall meets minimum", async () => {
    const datasetPath = path.join(runDir, "dataset.json");
    await writeJson(datasetPath, {
      version: "1",
      id: "t2",
      defaults: { scopePrefix: "eval:t2:", topK: 2, mode: "retrieve" },
      queries: [
        {
          id: "q1",
          query: "refund window",
          relevant: { sourceIds: ["eval:t2:doc:refund"] },
        },
      ],
    });

    const engine = {
      retrieve: async () => ({
        chunks: [
          {
            id: "c1",
            documentId: "d1",
            sourceId: "eval:t2:doc:refund",
            index: 0,
            content: "refund policy",
            tokenCount: 2,
            metadata: {},
            score: 0.9,
          },
        ],
        embeddingModel: "test-embed",
        durations: { embeddingMs: 1, retrievalMs: 1, totalMs: 2 },
      }),
      rerank: async () => {
        throw new Error("not used");
      },
      ingest: async () => {
        throw new Error("not used");
      },
      delete: async () => {},
    } as any;

    const result = await runEval({
      engine,
      datasetPath,
      ingest: false,
      thresholds: { min: { recallAtK: 0.5 } },
    });

    expect(result.exitCode).toBe(0);
    expect(result.thresholdFailures.length).toBe(0);
    expect(result.report.engine.embeddingModel).toBe("test-embed");
  });

  test("in retrieve+rerank mode, retrieves rerankTopK candidates and thresholds apply to reranked stage", async () => {
    const datasetPath = path.join(runDir, "dataset.json");
    await writeJson(datasetPath, {
      version: "1",
      id: "t3",
      defaults: { scopePrefix: "eval:t3:", topK: 2, rerankTopK: 6, mode: "retrieve+rerank" },
      queries: [
        {
          id: "q1",
          query: "refund window",
          relevant: { sourceIds: ["eval:t3:doc:refund"] },
        },
      ],
    });

    let observedRetrieveTopK: number | null = null;
    let observedRerankCandidateCount: number | null = null;
    let observedRerankTopK: number | null = null;

    const makeChunk = (sourceId: string, id: string) => ({
      id,
      documentId: "d1",
      sourceId,
      index: 0,
      content: `content for ${sourceId}`,
      tokenCount: 1,
      metadata: {},
      score: 0.9,
    });

    const candidates = [
      makeChunk("eval:t3:doc:other-1", "c1"),
      makeChunk("eval:t3:doc:other-2", "c2"),
      makeChunk("eval:t3:doc:other-3", "c3"),
      makeChunk("eval:t3:doc:other-4", "c4"),
      makeChunk("eval:t3:doc:refund", "c5"), // relevant is outside topK=2
      makeChunk("eval:t3:doc:other-5", "c6"),
    ];

    const engine = {
      retrieve: async (input: any) => {
        observedRetrieveTopK = input?.topK ?? null;
        return {
          chunks: candidates,
          embeddingModel: "test-embed",
          durations: { embeddingMs: 1, retrievalMs: 1, totalMs: 2 },
        };
      },
      rerank: async (input: any) => {
        observedRerankCandidateCount = Array.isArray(input?.candidates) ? input.candidates.length : null;
        observedRerankTopK = input?.topK ?? null;
        return {
          chunks: [candidates[4], candidates[0]].filter(Boolean), // promote relevant
          ranking: [],
          meta: { rerankerName: "test-reranker", model: "test-model" },
          durations: { rerankMs: 3, totalMs: 3 },
          warnings: [],
        };
      },
      ingest: async () => {
        throw new Error("not used");
      },
      delete: async () => {},
    } as any;

    const result = await runEval({
      engine,
      datasetPath,
      ingest: false,
      thresholds: { min: { recallAtK: 1 } },
    });

    expect(observedRetrieveTopK).toBe(6);
    expect(observedRerankCandidateCount).toBe(6);
    expect(observedRerankTopK).toBe(2);

    expect(result.report.config.mode).toBe("retrieve+rerank");
    expect(result.report.config.rerankTopK).toBe(6);
    expect(result.report.results.queries[0]?.rerankTopK).toBe(6);

    // Retrieved@2 misses the relevant doc; reranked@2 finds it.
    expect(result.report.results.queries[0]?.retrieved.metrics.recallAtK).toBe(0);
    expect(result.report.results.queries[0]?.reranked?.metrics.recallAtK).toBe(1);

    // Thresholds should apply to reranked stage in retrieve+rerank mode.
    expect(result.exitCode).toBe(0);
    expect(result.thresholdFailures.length).toBe(0);
  });
});

