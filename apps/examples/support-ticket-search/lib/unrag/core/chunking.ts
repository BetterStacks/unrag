import type { Chunker, ChunkingOptions, ChunkText } from "./types";

const DEFAULT_CHUNK_SIZE = 200;
const DEFAULT_CHUNK_OVERLAP = 40;

export const defaultChunkingOptions: ChunkingOptions = {
  chunkSize: DEFAULT_CHUNK_SIZE,
  chunkOverlap: DEFAULT_CHUNK_OVERLAP,
};

const splitWords = (content: string) =>
  content
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export const defaultChunker: Chunker = (
  content: string,
  options: ChunkingOptions
): ChunkText[] => {
  const { chunkSize, chunkOverlap } = options;
  const words = splitWords(content);
  const chunks: ChunkText[] = [];

  if (words.length === 0) {
    return chunks;
  }

  let cursor = 0;
  let index = 0;

  const stride = Math.max(1, chunkSize - chunkOverlap);

  while (cursor < words.length) {
    const slice = words.slice(cursor, cursor + chunkSize);
    const chunkContent = slice.join(" ").trim();

    if (chunkContent.length === 0) {
      break;
    }

    chunks.push({
      index,
      content: chunkContent,
      tokenCount: slice.length,
    });

    cursor += stride;
    index += 1;
  }

  return chunks;
};

export const resolveChunkingOptions = (
  overrides?: Partial<ChunkingOptions>
): ChunkingOptions => ({
  ...defaultChunkingOptions,
  ...overrides,
});


