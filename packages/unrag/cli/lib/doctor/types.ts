/**
 * Doctor command types - shared result model and configuration.
 */

export type CheckStatus = "pass" | "warn" | "fail" | "skip";

export type CheckResult = {
  id: string;
  title: string;
  status: CheckStatus;
  summary: string;
  details?: string[];
  fixHints?: string[];
  docsLink?: string;
  meta?: Record<string, unknown>;
};

export type CheckGroup = {
  id: string;
  title: string;
  results: CheckResult[];
};

export type DoctorReport = {
  groups: CheckGroup[];
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
    skip: number;
  };
};

export type ParsedDoctorArgs = {
  db?: boolean;
  json?: boolean;
  strict?: boolean;
  projectRoot?: string;
  installDir?: string;
  schema?: string;
  scope?: string;
  databaseUrl?: string;
  databaseUrlEnv?: string;
  envFile?: string;
};

export type InferredInstallState = {
  projectRoot: string;
  installDir: string | null;
  installDirExists: boolean;
  unragJsonExists: boolean;
  unragJsonParseable: boolean;
  unragJson: UnragJsonConfig | null;
  configFileExists: boolean;
  storeAdapter: "drizzle" | "prisma" | "raw-sql" | null;
  embeddingProvider: string | null;
  installedExtractors: string[];
  installedConnectors: string[];
  inferredDbEnvVar: string | null;
  inferenceConfidence: "high" | "medium" | "low";
  warnings: string[];
};

export type UnragJsonConfig = {
  installDir?: string;
  storeAdapter?: "drizzle" | "prisma" | "raw-sql";
  aliasBase?: string;
  embeddingProvider?: string;
  version?: number;
  connectors?: string[];
  extractors?: string[];
};

/**
 * Map from embedding provider to required/optional env vars.
 */
export const EMBEDDING_PROVIDER_ENV_VARS: Record<
  string,
  { required: string[]; optional: string[] }
> = {
  ai: {
    required: ["AI_GATEWAY_API_KEY"],
    optional: ["AI_GATEWAY_MODEL"],
  },
  openai: {
    required: ["OPENAI_API_KEY"],
    optional: ["OPENAI_EMBEDDING_MODEL"],
  },
  google: {
    required: ["GOOGLE_GENERATIVE_AI_API_KEY"],
    optional: ["GOOGLE_GENERATIVE_AI_EMBEDDING_MODEL"],
  },
  openrouter: {
    required: ["OPENROUTER_API_KEY"],
    optional: ["OPENROUTER_EMBEDDING_MODEL"],
  },
  azure: {
    required: ["AZURE_OPENAI_API_KEY", "AZURE_RESOURCE_NAME"],
    optional: ["AZURE_EMBEDDING_MODEL"],
  },
  vertex: {
    required: [],
    optional: ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_VERTEX_EMBEDDING_MODEL"],
  },
  bedrock: {
    required: ["AWS_REGION"],
    optional: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "BEDROCK_EMBEDDING_MODEL"],
  },
  cohere: {
    required: ["COHERE_API_KEY"],
    optional: ["COHERE_EMBEDDING_MODEL"],
  },
  mistral: {
    required: ["MISTRAL_API_KEY"],
    optional: ["MISTRAL_EMBEDDING_MODEL"],
  },
  together: {
    required: ["TOGETHER_AI_API_KEY"],
    optional: ["TOGETHER_AI_EMBEDDING_MODEL"],
  },
  ollama: {
    required: [],
    optional: ["OLLAMA_EMBEDDING_MODEL"],
  },
  voyage: {
    required: ["VOYAGE_API_KEY"],
    optional: ["VOYAGE_MODEL"],
  },
};

/**
 * Expected store adapter dependencies.
 */
export const STORE_ADAPTER_DEPS: Record<
  "drizzle" | "prisma" | "raw-sql",
  { required: string[]; devRequired: string[] }
> = {
  drizzle: {
    required: ["drizzle-orm", "pg"],
    devRequired: ["@types/pg"],
  },
  prisma: {
    required: ["@prisma/client"],
    devRequired: ["prisma"],
  },
  "raw-sql": {
    required: ["pg"],
    devRequired: ["@types/pg"],
  },
};

/**
 * Map extractor id to the assetProcessing flag paths that must be enabled.
 */
export const EXTRACTOR_CONFIG_FLAGS: Record<string, string[]> = {
  "pdf-llm": ["assetProcessing.pdf.llmExtraction.enabled"],
  "pdf-text-layer": ["assetProcessing.pdf.textLayer.enabled"],
  "pdf-ocr": ["assetProcessing.pdf.ocr.enabled"],
  "image-ocr": ["assetProcessing.image.ocr.enabled"],
  "image-caption-llm": ["assetProcessing.image.captionLlm.enabled"],
  "audio-transcribe": ["assetProcessing.audio.transcription.enabled"],
  "video-transcribe": ["assetProcessing.video.transcription.enabled"],
  "video-frames": ["assetProcessing.video.frames.enabled"],
  "file-text": ["assetProcessing.file.text.enabled"],
  "file-docx": ["assetProcessing.file.docx.enabled"],
  "file-pptx": ["assetProcessing.file.pptx.enabled"],
  "file-xlsx": ["assetProcessing.file.xlsx.enabled"],
};

/**
 * Map extractor id to the expected factory function name.
 */
export const EXTRACTOR_FACTORIES: Record<string, string> = {
  "pdf-llm": "createPdfLlmExtractor",
  "pdf-text-layer": "createPdfTextLayerExtractor",
  "pdf-ocr": "createPdfOcrExtractor",
  "image-ocr": "createImageOcrExtractor",
  "image-caption-llm": "createImageCaptionLlmExtractor",
  "audio-transcribe": "createAudioTranscribeExtractor",
  "video-transcribe": "createVideoTranscribeExtractor",
  "video-frames": "createVideoFramesExtractor",
  "file-text": "createFileTextExtractor",
  "file-docx": "createFileDocxExtractor",
  "file-pptx": "createFilePptxExtractor",
  "file-xlsx": "createFileXlsxExtractor",
};
