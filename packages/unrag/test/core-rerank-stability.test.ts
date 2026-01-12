import { describe, expect, test } from "bun:test";
import { rerank } from "@registry/core/rerank";
import type {
  Reranker,
  RerankCandidate,
  ResolvedContextEngineConfig,
} from "@registry/core/types";

/**
 * Creates a reranker that assigns the same score to all documents (tie scenario).
 */
const createTieReranker = (): Reranker => ({
  name: "test-tie",
  rerank: async ({ documents }) => {
    // Return documents in their original order but with equal scores
    const order = documents.map((_, i) => i);
    const scores = documents.map(() => 0.5);
    return { order, scores, model: "tie-v1" };
  },
});

/**
 * Creates a reranker that returns no scores (undefined).
 */
const createNoScoreReranker = (): Reranker => ({
  name: "test-no-score",
  rerank: async ({ documents }) => {
    const order = documents.map((_, i) => i);
    // No scores provided
    return { order, model: "no-score-v1" };
  },
});

/**
 * Creates a reranker that partially orders (some equal scores).
 */
const createPartialOrderReranker = (): Reranker => ({
  name: "test-partial",
  rerank: async ({ documents }) => {
    // First item gets high score, rest get same low score
    const order = documents.map((_, i) => i);
    const scores = documents.map((_, i) => (i === 0 ? 1.0 : 0.3));
    return { order, scores, model: "partial-v1" };
  },
});

/**
 * Creates test candidates.
 */
const createCandidates = (texts: string[]): RerankCandidate[] =>
  texts.map((content, i) => ({
    id: `chunk-${i}`,
    documentId: `doc-${i}`,
    sourceId: `source-${i}`,
    index: i,
    content,
    tokenCount: content.split(" ").length,
    metadata: {},
    score: 1 - i * 0.1, // Original retrieval score
  }));

/**
 * Creates a minimal resolved config with a reranker.
 */
const createConfig = (reranker: Reranker): ResolvedContextEngineConfig =>
  ({
    reranker,
    embedding: {} as any,
    store: {} as any,
    defaults: { chunkSize: 200, chunkOverlap: 40 },
    chunker: () => [],
    idGenerator: () => crypto.randomUUID(),
    extractors: [],
    storage: { storeChunkContent: true, storeDocumentContent: true },
    assetProcessing: {} as any,
    embeddingProcessing: { concurrency: 4, batchSize: 32 },
  }) as ResolvedContextEngineConfig;

describe("core rerank - stable ordering", () => {
  test("preserves original order for tied scores", async () => {
    const reranker = createTieReranker();
    const config = createConfig(reranker);
    const candidates = createCandidates(["first", "second", "third", "fourth"]);

    const result = await rerank(config, {
      query: "test query",
      candidates,
    });

    // With equal scores, original order should be preserved
    expect(result.chunks[0]!.id).toBe("chunk-0");
    expect(result.chunks[1]!.id).toBe("chunk-1");
    expect(result.chunks[2]!.id).toBe("chunk-2");
    expect(result.chunks[3]!.id).toBe("chunk-3");
  });

  test("preserves original order when reranker returns no scores", async () => {
    const reranker = createNoScoreReranker();
    const config = createConfig(reranker);
    const candidates = createCandidates(["a", "b", "c"]);

    const result = await rerank(config, {
      query: "test query",
      candidates,
    });

    // Without scores, should maintain the order returned by reranker
    expect(result.chunks[0]!.id).toBe("chunk-0");
    expect(result.chunks[1]!.id).toBe("chunk-1");
    expect(result.chunks[2]!.id).toBe("chunk-2");
  });

  test("ranking items without scores have undefined rerankScore", async () => {
    const reranker = createNoScoreReranker();
    const config = createConfig(reranker);
    const candidates = createCandidates(["a", "b"]);

    const result = await rerank(config, {
      query: "test query",
      candidates,
    });

    expect(result.ranking[0]!.rerankScore).toBeUndefined();
    expect(result.ranking[1]!.rerankScore).toBeUndefined();
  });

  test("handles partial ordering (some tied)", async () => {
    const reranker = createPartialOrderReranker();
    const config = createConfig(reranker);
    const candidates = createCandidates(["best", "tied-a", "tied-b", "tied-c"]);

    const result = await rerank(config, {
      query: "test query",
      candidates,
    });

    // First item should be first (highest score)
    expect(result.chunks[0]!.content).toBe("best");
    // Tied items should maintain relative order
    expect(result.chunks[1]!.content).toBe("tied-a");
    expect(result.chunks[2]!.content).toBe("tied-b");
    expect(result.chunks[3]!.content).toBe("tied-c");
  });

  test("skipped candidates appear after valid candidates in ranking", async () => {
    // Create a reranker that only sees the valid documents
    const reranker: Reranker = {
      name: "test-ordered",
      rerank: async ({ documents }) => ({
        order: documents.map((_, i) => i),
        scores: documents.map((_, i) => 1 - i * 0.1),
      }),
    };
    const config = createConfig(reranker);

    const candidates: RerankCandidate[] = [
      {
        id: "chunk-0",
        documentId: "doc-0",
        sourceId: "source-0",
        index: 0,
        content: "valid content",
        tokenCount: 2,
        metadata: {},
        score: 0.9,
      },
      {
        id: "chunk-1",
        documentId: "doc-1",
        sourceId: "source-1",
        index: 1,
        content: "", // Empty - will be skipped
        tokenCount: 0,
        metadata: {},
        score: 0.8,
      },
      {
        id: "chunk-2",
        documentId: "doc-2",
        sourceId: "source-2",
        index: 2,
        content: "another valid",
        tokenCount: 2,
        metadata: {},
        score: 0.7,
      },
    ];

    const result = await rerank(config, {
      query: "test query",
      candidates,
      onMissingText: "skip",
    });

    // Skipped candidates should appear at the end of ranking
    const rankingIndices = result.ranking.map((r) => r.index);
    expect(rankingIndices.indexOf(1)).toBeGreaterThan(rankingIndices.indexOf(0));
    expect(rankingIndices.indexOf(1)).toBeGreaterThan(rankingIndices.indexOf(2));
  });

  test("multiple runs produce consistent ordering", async () => {
    const reranker = createTieReranker();
    const config = createConfig(reranker);
    const candidates = createCandidates(["a", "b", "c", "d", "e"]);

    // Run multiple times and verify consistent results
    const results = await Promise.all([
      rerank(config, { query: "test", candidates }),
      rerank(config, { query: "test", candidates }),
      rerank(config, { query: "test", candidates }),
    ]);

    const firstOrder = results[0]!.chunks.map((c) => c.id);
    for (const result of results.slice(1)) {
      const order = result.chunks.map((c) => c.id);
      expect(order).toEqual(firstOrder);
    }
  });

  test("maintains chunk properties after reranking", async () => {
    const reranker = createTieReranker();
    const config = createConfig(reranker);

    const originalCandidates = createCandidates(["test content"]);
    originalCandidates[0]!.metadata = { key: "value" };
    originalCandidates[0]!.documentContent = "full document";

    const result = await rerank(config, {
      query: "test",
      candidates: originalCandidates,
    });

    const chunk = result.chunks[0]!;
    expect(chunk.id).toBe("chunk-0");
    expect(chunk.content).toBe("test content");
    expect(chunk.metadata).toEqual({ key: "value" });
    expect(chunk.documentContent).toBe("full document");
    expect(chunk.score).toBe(1); // Original retrieval score preserved (1 - 0 * 0.1 = 1)
  });
});
