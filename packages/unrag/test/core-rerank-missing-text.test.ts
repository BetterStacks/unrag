import { describe, expect, test } from "bun:test";
import { rerank } from "@registry/core/rerank";
import type {
  Reranker,
  RerankCandidate,
  ResolvedContextEngineConfig,
} from "@registry/core/types";

/**
 * Creates a fake reranker that reverses the order of documents.
 */
const createReverseReranker = (): Reranker => ({
  name: "test-reverse",
  rerank: async ({ documents }) => {
    const order = documents.map((_, i) => documents.length - 1 - i);
    const scores = order.map((_, i) => 1 - i * 0.1);
    return { order, scores, model: "reverse-v1" };
  },
});

/**
 * Creates test candidates with optional empty content.
 */
const createCandidatesWithEmptyContent = (
  items: Array<{ content: string; isEmpty?: boolean }>
): RerankCandidate[] =>
  items.map(({ content, isEmpty }, i) => ({
    id: `chunk-${i}`,
    documentId: `doc-${i}`,
    sourceId: `source-${i}`,
    index: i,
    content: isEmpty ? "" : content,
    tokenCount: content.split(" ").length,
    metadata: {},
    score: 1 - i * 0.1,
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

describe("core rerank - missing text handling", () => {
  test("throws by default when candidate has empty content", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "valid text" },
      { content: "will be empty", isEmpty: true },
      { content: "another valid" },
    ]);

    await expect(
      rerank(config, {
        query: "test query",
        candidates,
      })
    ).rejects.toThrow(/empty content/i);
  });

  test("throws with helpful error message for empty content", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "first", isEmpty: true },
    ]);

    try {
      await rerank(config, { query: "test", candidates });
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("Candidate 0");
      expect((err as Error).message).toContain("storeChunkContent");
      expect((err as Error).message).toContain("resolveText");
      expect((err as Error).message).toContain("onMissingText");
    }
  });

  test("skips candidates with empty content when onMissingText is 'skip'", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "first" },
      { content: "will be empty", isEmpty: true },
      { content: "third" },
    ]);

    const result = await rerank(config, {
      query: "test query",
      candidates,
      onMissingText: "skip",
    });

    // Should return results (with warning)
    expect(result.warnings.some((w) => w.includes("no text"))).toBe(true);
    // The result should still include all candidates in ranking, with skipped ones at end
    expect(result.ranking.length).toBe(3);
  });

  test("returns warning for each skipped candidate", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "valid" },
      { content: "empty1", isEmpty: true },
      { content: "empty2", isEmpty: true },
    ]);

    const result = await rerank(config, {
      query: "test query",
      candidates,
      onMissingText: "skip",
    });

    const skippedWarnings = result.warnings.filter((w) =>
      w.includes("skipped")
    );
    expect(skippedWarnings.length).toBe(2);
  });

  test("uses resolveText hook to get text for empty candidates", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "first" },
      { content: "resolved-content", isEmpty: true },
    ]);

    const resolveText = async (c: RerankCandidate) => {
      // Simulate fetching text from external store
      if (c.id === "chunk-1") return "resolved-content";
      return "";
    };

    const result = await rerank(config, {
      query: "test query",
      candidates,
      resolveText,
    });

    // Should successfully rerank without errors
    expect(result.chunks.length).toBe(2);
    expect(result.warnings.length).toBe(0);
  });

  test("resolveText hook is only called for empty content", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "already has content" },
      { content: "will be resolved", isEmpty: true },
    ]);

    const calls: string[] = [];
    const resolveText = async (c: RerankCandidate) => {
      calls.push(c.id);
      return "resolved";
    };

    await rerank(config, {
      query: "test query",
      candidates,
      resolveText,
    });

    // Should only be called for the empty one
    expect(calls).toEqual(["chunk-1"]);
  });

  test("handles resolveText throwing an error", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "valid" },
      { content: "will fail", isEmpty: true },
    ]);

    const resolveText = async () => {
      throw new Error("Database connection failed");
    };

    // With default policy, should throw
    await expect(
      rerank(config, {
        query: "test",
        candidates,
        resolveText,
      })
    ).rejects.toThrow(/empty content/i);
  });

  test("handles resolveText error with skip policy", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "valid" },
      { content: "will fail", isEmpty: true },
    ]);

    const resolveText = async () => {
      throw new Error("Database error");
    };

    const result = await rerank(config, {
      query: "test",
      candidates,
      resolveText,
      onMissingText: "skip",
    });

    // Should have warning about the failed resolve
    expect(result.warnings.some((w) => w.includes("resolveText failed"))).toBe(
      true
    );
  });

  test("resolveText returning empty string is treated as missing text", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "needs resolve", isEmpty: true },
    ]);

    const resolveText = async () => "";

    await expect(
      rerank(config, {
        query: "test",
        candidates,
        resolveText,
      })
    ).rejects.toThrow(/empty content/i);
  });

  test("returns original order when all candidates have empty text with skip policy", async () => {
    const reranker = createReverseReranker();
    const config = createConfig(reranker);
    const candidates = createCandidatesWithEmptyContent([
      { content: "empty1", isEmpty: true },
      { content: "empty2", isEmpty: true },
      { content: "empty3", isEmpty: true },
    ]);

    const result = await rerank(config, {
      query: "test query",
      candidates,
      onMissingText: "skip",
    });

    // Should return original order since all are skipped
    expect(result.chunks[0]!.id).toBe("chunk-0");
    expect(result.chunks[1]!.id).toBe("chunk-1");
    expect(result.chunks[2]!.id).toBe("chunk-2");
    expect(result.warnings.some((w) => w.includes("All candidates"))).toBe(
      true
    );
  });
});
