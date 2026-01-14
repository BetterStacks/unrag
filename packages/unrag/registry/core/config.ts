import type {
  Chunker,
  ContextEngineConfig,
  DeepPartial,
  ResolvedContextEngineConfig,
  AssetProcessingConfig,
  ContentStorageConfig,
  EmbeddingProcessingConfig,
} from "@registry/core/types";
import { defaultChunker, resolveChunkingOptions } from "@registry/core/chunking";
import { mergeDeep } from "@registry/core/deep-merge";

export const defineConfig = (config: ContextEngineConfig): ContextEngineConfig =>
  config;

const defaultIdGenerator = () => crypto.randomUUID();

const DEFAULT_PDF_LLM_MODEL = "google/gemini-2.0-flash";
const DEFAULT_IMAGE_OCR_MODEL = "google/gemini-2.0-flash";
const DEFAULT_IMAGE_CAPTION_MODEL = "google/gemini-2.0-flash";
const DEFAULT_AUDIO_TRANSCRIBE_MODEL = "openai/whisper-1";
const DEFAULT_VIDEO_TRANSCRIBE_MODEL = "openai/whisper-1";

export const defaultAssetProcessingConfig: AssetProcessingConfig = {
  onUnsupportedAsset: "skip",
  onError: "skip",
  concurrency: 4,
  hooks: {
    onEvent: undefined,
  },
  fetch: {
    enabled: true,
    allowedHosts: undefined,
    maxBytes: 15 * 1024 * 1024, // 15MB
    timeoutMs: 20_000,
    headers: undefined,
  },
  pdf: {
    textLayer: {
      enabled: false,
      maxBytes: 15 * 1024 * 1024, // 15MB
      maxOutputChars: 200_000,
      minChars: 200,
      maxPages: undefined,
    },
    llmExtraction: {
      enabled: false, // library default (cost-safe)
      model: DEFAULT_PDF_LLM_MODEL,
      prompt:
        "Extract all readable text from this PDF as faithfully as possible. Preserve structure with headings and lists when obvious. Output plain text or markdown only. Do not add commentary.",
      timeoutMs: 60_000,
      maxBytes: 15 * 1024 * 1024, // 15MB
      maxOutputChars: 200_000,
    },
    ocr: {
      enabled: false,
      maxBytes: 15 * 1024 * 1024, // 15MB
      maxOutputChars: 200_000,
      minChars: 200,
      maxPages: undefined,
      pdftoppmPath: undefined,
      tesseractPath: undefined,
      dpi: 200,
      lang: "eng",
    },
  },
  image: {
    ocr: {
      enabled: false,
      model: DEFAULT_IMAGE_OCR_MODEL,
      prompt:
        "Extract all readable text from this image as faithfully as possible. Output plain text only. Do not add commentary.",
      timeoutMs: 60_000,
      maxBytes: 10 * 1024 * 1024, // 10MB
      maxOutputChars: 50_000,
    },
    captionLlm: {
      enabled: false,
      model: DEFAULT_IMAGE_CAPTION_MODEL,
      prompt:
        "Write a concise, information-dense caption for this image. Include names, numbers, and labels if visible. Output plain text only.",
      timeoutMs: 60_000,
      maxBytes: 10 * 1024 * 1024, // 10MB
      maxOutputChars: 10_000,
    },
  },
  audio: {
    transcription: {
      enabled: false,
      model: DEFAULT_AUDIO_TRANSCRIBE_MODEL,
      timeoutMs: 120_000,
      maxBytes: 25 * 1024 * 1024, // 25MB
    },
  },
  video: {
    transcription: {
      enabled: false,
      model: DEFAULT_VIDEO_TRANSCRIBE_MODEL,
      timeoutMs: 120_000,
      maxBytes: 50 * 1024 * 1024, // 50MB
    },
    frames: {
      enabled: false,
      sampleFps: 0.2,
      maxFrames: 50,
      ffmpegPath: undefined,
      maxBytes: 50 * 1024 * 1024, // 50MB
      model: "google/gemini-2.0-flash",
      prompt:
        "Extract all readable text from this video frame as faithfully as possible. Output plain text only. Do not add commentary.",
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
};

export const defaultContentStorageConfig: ContentStorageConfig = {
  storeChunkContent: true,
  storeDocumentContent: true,
};

export const defaultEmbeddingProcessingConfig: EmbeddingProcessingConfig = {
  concurrency: 4,
  batchSize: 32,
};

export const resolveAssetProcessingConfig = (
  overrides?: DeepPartial<AssetProcessingConfig>
): AssetProcessingConfig => mergeDeep(defaultAssetProcessingConfig, overrides);

export const resolveContentStorageConfig = (
  overrides?: DeepPartial<ContentStorageConfig>
): ContentStorageConfig => mergeDeep(defaultContentStorageConfig, overrides);

export const resolveEmbeddingProcessingConfig = (
  overrides?: DeepPartial<EmbeddingProcessingConfig>
): EmbeddingProcessingConfig => mergeDeep(defaultEmbeddingProcessingConfig, overrides);

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
    extractors: config.extractors ?? [],
    reranker: config.reranker,
    storage: resolveContentStorageConfig(config.storage),
    assetProcessing: resolveAssetProcessingConfig(config.assetProcessing),
    embeddingProcessing: resolveEmbeddingProcessingConfig(config.embeddingProcessing),
  };
};


