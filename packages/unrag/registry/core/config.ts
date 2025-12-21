import type {
  Chunker,
  ContextEngineConfig,
  ResolvedContextEngineConfig,
  AssetProcessingConfig,
  DeepPartial,
} from "./types";
import { defaultChunker, resolveChunkingOptions } from "./chunking";

export const defineConfig = (config: ContextEngineConfig): ContextEngineConfig =>
  config;

const defaultIdGenerator = () => crypto.randomUUID();

const DEFAULT_PDF_LLM_MODEL = "google/gemini-2.0-flash";

export const defaultAssetProcessingConfig: AssetProcessingConfig = {
  onUnsupportedAsset: "skip",
  onError: "skip",
  fetch: {
    enabled: true,
    allowedHosts: undefined,
    maxBytes: 15 * 1024 * 1024, // 15MB
    timeoutMs: 20_000,
    headers: undefined,
  },
  pdf: {
    llmExtraction: {
      enabled: false, // library default (cost-safe)
      model: DEFAULT_PDF_LLM_MODEL,
      prompt:
        "Extract all readable text from this PDF as faithfully as possible. Preserve structure with headings and lists when obvious. Output plain text or markdown only. Do not add commentary.",
      timeoutMs: 60_000,
      maxBytes: 15 * 1024 * 1024, // 15MB
      maxOutputChars: 200_000,
    },
  },
};

const mergeDeep = <T extends Record<string, any>>(
  base: T,
  overrides: DeepPartial<T> | undefined
): T => {
  if (!overrides) return base;
  const out: any = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const nextVal = overrides[key];
    if (nextVal === undefined) continue;
    const baseVal = base[key];
    if (
      baseVal &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal) &&
      nextVal &&
      typeof nextVal === "object" &&
      !Array.isArray(nextVal)
    ) {
      out[key] = mergeDeep(baseVal, nextVal as any);
    } else {
      out[key] = nextVal as any;
    }
  }
  return out as T;
};

export const resolveAssetProcessingConfig = (
  overrides?: DeepPartial<AssetProcessingConfig>
): AssetProcessingConfig => mergeDeep(defaultAssetProcessingConfig, overrides);

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
    assetProcessing: resolveAssetProcessingConfig(config.assetProcessing),
  };
};


