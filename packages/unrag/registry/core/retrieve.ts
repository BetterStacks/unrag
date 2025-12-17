import type {
  RetrieveInput,
  RetrieveResult,
  ResolvedContextEngineConfig,
} from "./types";

const now = () => performance.now();

const DEFAULT_TOP_K = 8;

export const retrieve = async (
  config: ResolvedContextEngineConfig,
  input: RetrieveInput
): Promise<RetrieveResult> => {
  const totalStart = now();

  const embeddingStart = now();
  const queryEmbedding = await config.embedding.embed({
    text: input.query,
    metadata: {},
    position: 0,
    sourceId: "query",
    documentId: "query",
  });
  const embeddingMs = now() - embeddingStart;

  const retrievalStart = now();
  const chunks = await config.store.query({
    embedding: queryEmbedding,
    topK: input.topK ?? DEFAULT_TOP_K,
    scope: input.scope,
  });
  const retrievalMs = now() - retrievalStart;

  const totalMs = now() - totalStart;

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


