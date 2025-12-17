import type {
  Chunker,
  ContextEngineConfig,
  ResolvedContextEngineConfig,
} from "./types";
import { defaultChunker, resolveChunkingOptions } from "./chunking";

export const defineConfig = (config: ContextEngineConfig): ContextEngineConfig =>
  config;

const defaultIdGenerator = () => crypto.randomUUID();

export const resolveConfig = (
  config: ContextEngineConfig
): ResolvedContextEngineConfig => {
  const chunker: Chunker = config.chunker ?? defaultChunker;

  return {
    embedding: config.embedding,
    store: config.store,
    defaults: resolveChunkingOptions(config.defaults),
    chunker,
    idGenerator: config.idGenerator ?? defaultIdGenerator,
  };
};


