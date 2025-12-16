import type {
  Chunk,
  IngestInput,
  IngestResult,
  ResolvedContextEngineConfig,
} from "./types";

const now = () => performance.now();

export const ingest = async (
  config: ResolvedContextEngineConfig,
  input: IngestInput
): Promise<IngestResult> => {
  const totalStart = now();
  const chunkingStart = now();

  const chunkingOptions = {
    ...config.defaults,
    ...input.chunking,
  };

  const metadata = input.metadata ?? {};
  const documentId = config.idGenerator();

  const chunks = config.chunker(input.content, chunkingOptions).map<Chunk>(
    (chunk) => ({
      id: config.idGenerator(),
      documentId,
      sourceId: input.sourceId,
      index: chunk.index,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      metadata,
    })
  );

  const chunkingMs = now() - chunkingStart;
  const embeddingStart = now();

  const embeddedChunks = await Promise.all(
    chunks.map(async (chunk) => {
      const embedding = await config.embedding.embed({
        text: chunk.content,
        metadata,
        position: chunk.index,
        sourceId: chunk.sourceId,
        documentId: chunk.documentId,
      });

      return {
        ...chunk,
        embedding,
      };
    })
  );

  const embeddingMs = now() - embeddingStart;
  const storageStart = now();

  await config.store.upsert(embeddedChunks);

  const storageMs = now() - storageStart;
  const totalMs = now() - totalStart;

  return {
    documentId,
    chunkCount: embeddedChunks.length,
    embeddingModel: config.embedding.name,
    durations: {
      totalMs,
      chunkingMs,
      embeddingMs,
      storageMs,
    },
  };
};
