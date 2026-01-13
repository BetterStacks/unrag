import type {
  RetrieveInput,
  RetrieveResult,
  ResolvedContextEngineConfig,
} from "@registry/core/types";
import { getDebugEmitter } from "@registry/core/debug-emitter";

const now = () => performance.now();

const DEFAULT_TOP_K = 8;

export const retrieve = async (
  config: ResolvedContextEngineConfig,
  input: RetrieveInput
): Promise<RetrieveResult> => {
  const debug = getDebugEmitter();
  const totalStart = now();
  const topK = input.topK ?? DEFAULT_TOP_K;

  debug.emit({
    type: "retrieve:start",
    query: input.query,
    topK,
    scope: input.scope,
  });

  const embeddingStart = now();
  const queryEmbedding = await config.embedding.embed({
    text: input.query,
    metadata: {},
    position: 0,
    sourceId: "query",
    documentId: "query",
  });
  const embeddingMs = now() - embeddingStart;

  debug.emit({
    type: "retrieve:embedding-complete",
    query: input.query,
    embeddingProvider: config.embedding.name,
    embeddingDimension: queryEmbedding.length,
    durationMs: embeddingMs,
  });

  const retrievalStart = now();
  const chunks = await config.store.query({
    embedding: queryEmbedding,
    topK,
    scope: input.scope,
  });
  const retrievalMs = now() - retrievalStart;

  debug.emit({
    type: "retrieve:database-complete",
    query: input.query,
    resultsCount: chunks.length,
    durationMs: retrievalMs,
  });

  const totalMs = now() - totalStart;

  debug.emit({
    type: "retrieve:complete",
    query: input.query,
    resultsCount: chunks.length,
    topK,
    totalDurationMs: totalMs,
    embeddingMs,
    retrievalMs,
  });

  return {
    chunks,
    embeddingModel: config.embedding.name,
    durations: {
      totalMs,
      embeddingMs,
      retrievalMs,
    },
  };
};


