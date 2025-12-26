import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { confirm, isCancel, cancel } from "@clack/prompts";
import { ensureDir, exists, listFilesRecursive } from "./fs";
import type { ExtractorName } from "./packageJson";

export type RegistrySelection = {
  projectRoot: string;
  registryRoot: string;
  installDir: string; // project-relative posix
  storeAdapter: "drizzle" | "prisma" | "raw-sql";
  aliasBase: string; // e.g. "@unrag"
  embeddingProvider?: import("./packageJson").EmbeddingProviderName;
  yes?: boolean; // non-interactive
  overwrite?: "skip" | "force"; // behavior when dest exists
  presetConfig?: {
    defaults?: {
      chunking?: { chunkSize?: number; chunkOverlap?: number };
      retrieval?: { topK?: number };
    };
    embedding?: {
      provider?: string;
      config?: { type?: "text" | "multimodal"; model?: string; timeoutMs?: number };
    };
    engine?: {
      storage?: { storeChunkContent?: boolean; storeDocumentContent?: boolean };
      assetProcessing?: unknown;
    };
  };
  richMedia?: {
    enabled: boolean;
    extractors: ExtractorName[];
  };
};

type FileMapping = {
  src: string; // absolute
  dest: string; // absolute
  transform?: (content: string) => string;
};

const readText = (filePath: string) => readFile(filePath, "utf8");

const writeText = async (filePath: string, content: string) => {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content, "utf8");
};

const EXTRACTOR_FACTORY: Record<ExtractorName, string> = {
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

const EXTRACTOR_FLAG_KEYS: Record<ExtractorName, string[]> = {
  "pdf-text-layer": ["pdf_textLayer"],
  "pdf-llm": ["pdf_llmExtraction"],
  "pdf-ocr": ["pdf_ocr"],
  "image-ocr": ["image_ocr"],
  "image-caption-llm": ["image_captionLlm"],
  "audio-transcribe": ["audio_transcription"],
  "video-transcribe": ["video_transcription"],
  "video-frames": ["video_frames"],
  "file-text": ["file_text"],
  "file-docx": ["file_docx"],
  "file-pptx": ["file_pptx"],
  "file-xlsx": ["file_xlsx"],
};

const ALL_FLAG_KEYS = Array.from(
  new Set(Object.values(EXTRACTOR_FLAG_KEYS).flat())
).sort();

const indentBlock = (text: string, spaces: number) => {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n");
};

const replaceBetweenMarkers = (
  content: string,
  startMarker: string,
  endMarker: string,
  replacement: string
) => {
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return content;

  // Expand to whole lines so we don't leave indentation behind.
  const startLineStart = content.lastIndexOf("\n", startIdx);
  const start = startLineStart < 0 ? 0 : startLineStart + 1;

  const endLineEnd = content.indexOf("\n", endIdx);
  const end = endLineEnd < 0 ? content.length : endLineEnd + 1;

  return content.slice(0, start) + replacement + content.slice(end);
};

const renderUnragConfig = (content: string, selection: RegistrySelection) => {
  const installImportBase = `./${selection.installDir.replace(/\\/g, "/")}`;
  const richMedia = selection.richMedia ?? { enabled: false, extractors: [] as ExtractorName[] };
  const selectedExtractors = Array.from(new Set(richMedia.extractors ?? [])).sort();
  const preset = selection.presetConfig;
  const embeddingProvider =
    selection.embeddingProvider ??
    (typeof preset?.embedding?.provider === "string"
      ? (preset.embedding.provider as import("./packageJson").EmbeddingProviderName)
      : undefined) ??
    "ai";

  const baseImports = [
    `import { defineUnragConfig } from "${installImportBase}/core";`,
  ];

  const storeImports: string[] = [];
  const storeCreateLines: string[] = [];

  if (selection.storeAdapter === "drizzle") {
    storeImports.push(
      `import { createDrizzleVectorStore } from "${installImportBase}/store/drizzle";`,
      `import { drizzle } from "drizzle-orm/node-postgres";`,
      `import { Pool } from "pg";`
    );
    storeCreateLines.push(
      `  const databaseUrl = process.env.DATABASE_URL;`,
      `  if (!databaseUrl) throw new Error("DATABASE_URL is required");`,
      ``,
      `  const pool = (globalThis as any).__unragPool ?? new Pool({ connectionString: databaseUrl });`,
      `  (globalThis as any).__unragPool = pool;`,
      ``,
      `  const db = (globalThis as any).__unragDrizzleDb ?? drizzle(pool);`,
      `  (globalThis as any).__unragDrizzleDb = db;`,
      ``,
      `  const store = createDrizzleVectorStore(db);`
    );
  } else if (selection.storeAdapter === "raw-sql") {
    storeImports.push(
      `import { createRawSqlVectorStore } from "${installImportBase}/store/raw-sql";`,
      `import { Pool } from "pg";`
    );
    storeCreateLines.push(
      `  const databaseUrl = process.env.DATABASE_URL;`,
      `  if (!databaseUrl) throw new Error("DATABASE_URL is required");`,
      ``,
      `  const pool = (globalThis as any).__unragPool ?? new Pool({ connectionString: databaseUrl });`,
      `  (globalThis as any).__unragPool = pool;`,
      ``,
      `  const store = createRawSqlVectorStore(pool);`
    );
  } else {
    storeImports.push(
      `import { createPrismaVectorStore } from "${installImportBase}/store/prisma";`,
      `import { PrismaClient } from "@prisma/client";`
    );
    storeCreateLines.push(
      `  const prisma = (globalThis as any).__unragPrisma ?? new PrismaClient();`,
      `  (globalThis as any).__unragPrisma = prisma;`,
      `  const store = createPrismaVectorStore(prisma);`
    );
  }

  const extractorImports: string[] = [];
  if (richMedia.enabled && selectedExtractors.length > 0) {
    for (const ex of selectedExtractors) {
      const factory = EXTRACTOR_FACTORY[ex];
      extractorImports.push(
        `import { ${factory} } from "${installImportBase}/extractors/${ex}";`
      );
    }
  }

  const importsBlock = [...baseImports, ...storeImports, ...extractorImports].join(
    "\n"
  );

  const createEngineBlock = [
    `export function createUnragEngine() {`,
    ...storeCreateLines,
    ``,
    `  return unrag.createEngine({ store });`,
    `}`,
  ].join("\n");

  let out = content
    .replace("// __UNRAG_IMPORTS__", importsBlock)
    .replace("// __UNRAG_CREATE_ENGINE__", createEngineBlock);

  // Apply preset defaults (chunking + retrieval) if provided.
  const presetChunkSize = preset?.defaults?.chunking?.chunkSize;
  const presetChunkOverlap = preset?.defaults?.chunking?.chunkOverlap;
  const presetTopK = preset?.defaults?.retrieval?.topK;

  if (typeof presetChunkSize === "number") {
    out = out.replace(
      "chunkSize: 200, // __UNRAG_DEFAULT_chunkSize__",
      `chunkSize: ${presetChunkSize},`
    );
  } else {
    out = out.replace(
      "chunkSize: 200, // __UNRAG_DEFAULT_chunkSize__",
      "chunkSize: 200,"
    );
  }
  if (typeof presetChunkOverlap === "number") {
    out = out.replace(
      "chunkOverlap: 40, // __UNRAG_DEFAULT_chunkOverlap__",
      `chunkOverlap: ${presetChunkOverlap},`
    );
  } else {
    out = out.replace(
      "chunkOverlap: 40, // __UNRAG_DEFAULT_chunkOverlap__",
      "chunkOverlap: 40,"
    );
  }
  if (typeof presetTopK === "number") {
    out = out.replace("topK: 8, // __UNRAG_DEFAULT_topK__", `topK: ${presetTopK},`);
  } else {
    out = out.replace("topK: 8, // __UNRAG_DEFAULT_topK__", "topK: 8,");
  }

  // Embedding config:
  // - Provider always comes from `selection.embeddingProvider` (or preset override, if provided).
  // - Preset can override model/timeout/type, but rich media should NOT implicitly flip embeddings to multimodal.
  const presetEmbeddingType = preset?.embedding?.config?.type;
  const presetEmbeddingModel = preset?.embedding?.config?.model;
  const presetEmbeddingTimeoutMs = preset?.embedding?.config?.timeoutMs;

  const providerLine = `    provider: "${embeddingProvider}",`;
  out = out.replace(/^\s*provider:\s*".*?",\s*$/m, providerLine);

  const defaultModelByProvider: Record<string, string> = {
    ai: "openai/text-embedding-3-small",
    openai: "text-embedding-3-small",
    google: "gemini-embedding-001",
    openrouter: "text-embedding-3-small",
    azure: "text-embedding-3-small",
    vertex: "text-embedding-004",
    bedrock: "amazon.titan-embed-text-v2:0",
    cohere: "embed-english-v3.0",
    mistral: "mistral-embed",
    together: "togethercomputer/m2-bert-80M-2k-retrieval",
    ollama: "nomic-embed-text",
    voyage: "voyage-3.5-lite",
    custom: "openai/text-embedding-3-small",
  };

  const resolvedEmbeddingModel = (() => {
    if (typeof presetEmbeddingModel === "string" && presetEmbeddingModel.trim().length > 0) {
      return presetEmbeddingModel.trim();
    }
    if (embeddingProvider === "ai" && presetEmbeddingType === "multimodal") {
      // Wizard default for multimodal via AI Gateway.
      return "cohere/embed-v4.0";
    }
    return defaultModelByProvider[embeddingProvider] ?? "openai/text-embedding-3-small";
  })();

  const normalizeModelForProvider = (model: string) => {
    if (embeddingProvider === "ai") return model;
    const prefix = `${embeddingProvider}/`;
    return model.startsWith(prefix) ? model.slice(prefix.length) : model;
  };

  const nextModel = normalizeModelForProvider(resolvedEmbeddingModel);
  out = out.replace(
    'model: "openai/text-embedding-3-small", // __UNRAG_EMBEDDING_MODEL__',
    `model: ${JSON.stringify(nextModel)},`
  );

  // Only opt-in to multimodal when explicitly requested by preset.
  if (presetEmbeddingType === "multimodal") {
    if (!out.includes('type: "multimodal"') && !out.includes('type: "text"')) {
      out = out.replace(
        `config: {\n      model:`,
        `config: {\n      type: "multimodal",\n      model:`
      );
    } else {
      out = out.replace(/^\s*type:\s*".*?",\s*$/m, `      type: "multimodal",`);
    }
  }

  if (typeof presetEmbeddingTimeoutMs === "number") {
    out = out.replace(
      "timeoutMs: 15_000, // __UNRAG_EMBEDDING_TIMEOUT__",
      `timeoutMs: ${presetEmbeddingTimeoutMs},`
    );
  } else {
    out = out.replace(
      "timeoutMs: 15_000, // __UNRAG_EMBEDDING_TIMEOUT__",
      "timeoutMs: 15_000,"
    );
  }

  // Storage config (optional).
  const presetStoreChunkContent = preset?.engine?.storage?.storeChunkContent;
  const presetStoreDocumentContent = preset?.engine?.storage?.storeDocumentContent;
  if (typeof presetStoreChunkContent === "boolean") {
    out = out.replace(
      "storeChunkContent: true, // __UNRAG_STORAGE_storeChunkContent__",
      `storeChunkContent: ${presetStoreChunkContent},`
    );
  } else {
    out = out.replace(
      "storeChunkContent: true, // __UNRAG_STORAGE_storeChunkContent__",
      "storeChunkContent: true,"
    );
  }
  if (typeof presetStoreDocumentContent === "boolean") {
    out = out.replace(
      "storeDocumentContent: true, // __UNRAG_STORAGE_storeDocumentContent__",
      `storeDocumentContent: ${presetStoreDocumentContent},`
    );
  } else {
    out = out.replace(
      "storeDocumentContent: true, // __UNRAG_STORAGE_storeDocumentContent__",
      "storeDocumentContent: true,"
    );
  }

  // Asset processing: if preset provides a full object, replace the whole block.
  const assetProcessingOverride = preset?.engine?.assetProcessing;
  if (assetProcessingOverride && typeof assetProcessingOverride === "object") {
    const json = JSON.stringify(assetProcessingOverride, null, 2);
    const block = `  assetProcessing: ${indentBlock(json, 2).trimStart()},\n`;
    out = replaceBetweenMarkers(
      out,
      "__UNRAG_ASSET_PROCESSING_BLOCK_START__",
      "__UNRAG_ASSET_PROCESSING_BLOCK_END__",
      block
    );
  } else {
    // Strip the marker lines if we keep the template block.
    out = out
      .replace("// __UNRAG_ASSET_PROCESSING_BLOCK_START__", "")
      .replace("// __UNRAG_ASSET_PROCESSING_BLOCK_END__", "");
  }

  // Enable/disable assetProcessing flags (only when not overriding the whole block).
  if (!(assetProcessingOverride && typeof assetProcessingOverride === "object")) {
    const enabledFlagKeys = new Set<string>();
    if (richMedia.enabled) {
      for (const ex of selectedExtractors) {
        for (const k of EXTRACTOR_FLAG_KEYS[ex] ?? []) {
          enabledFlagKeys.add(k);
        }
      }
    }

    for (const k of ALL_FLAG_KEYS) {
      out = out.replace(
        `enabled: false, // __UNRAG_FLAG_${k}__`,
        `enabled: ${enabledFlagKeys.has(k) ? "true" : "false"},`
      );
    }
  }

  // Inject extractor list (or remove placeholder) without leaving marker comments.
  const extractorLines =
    richMedia.enabled && selectedExtractors.length > 0
      ? selectedExtractors.map((ex) => `      ${EXTRACTOR_FACTORY[ex]}(),`).join("\n")
      : "";
  out = out.replace("      // __UNRAG_EXTRACTORS__", extractorLines);

  return out;
};

const renderDocs = (content: string, selection: RegistrySelection) => {
  const notes: string[] = [];
  const embeddingProvider = selection.embeddingProvider ?? "ai";

  if (selection.storeAdapter === "drizzle") {
    notes.push(
      "## Store adapter: Drizzle",
      "",
      "You can import the generated Drizzle schema module into your app’s main Drizzle schema to avoid duplicating table definitions.",
      "",
      "Example pattern:",
      "```ts",
      `import * as rag from "./${selection.installDir}/store/drizzle/schema";`,
      "",
      "export const schema = {",
      "  ...rag.schema,",
      "  // ...your app tables",
      "};",
      "```",
      "",
      "Then run Drizzle migrations from your app as usual."
    );
  } else if (selection.storeAdapter === "prisma") {
    notes.push(
      "## Store adapter: Prisma",
      "",
      "This adapter uses `prisma.$executeRaw` / `prisma.$queryRaw` so you can keep your Prisma models minimal or skip them entirely.",
      "",
      "If you want Prisma models, pgvector is typically represented as `Unsupported(\"vector\")`.",
      "You can still run migrations however you prefer (SQL migrations are the simplest for pgvector)."
    );
  } else {
    notes.push(
      "## Store adapter: Raw SQL",
      "",
      "This adapter uses a `pg` Pool and parameterized SQL queries against the tables described above.",
      "It’s the most portable option when you don’t want ORM coupling."
    );
  }

  const envLines: string[] = [
    "## Environment variables",
    "",
    "Add these to your environment:",
    "- `DATABASE_URL` (Postgres connection string)",
  ];

  if (embeddingProvider === "ai") {
    envLines.push(
      "- `AI_GATEWAY_API_KEY` (required by the AI SDK when using Vercel AI Gateway)",
      "- Optional: `AI_GATEWAY_MODEL` (defaults to `openai/text-embedding-3-small`)"
    );
  } else if (embeddingProvider === "openai") {
    envLines.push(
      "- `OPENAI_API_KEY`",
      "- Optional: `OPENAI_EMBEDDING_MODEL` (defaults to `text-embedding-3-small`)"
    );
  } else if (embeddingProvider === "google") {
    envLines.push(
      "- `GOOGLE_GENERATIVE_AI_API_KEY`",
      "- Optional: `GOOGLE_GENERATIVE_AI_EMBEDDING_MODEL` (defaults to `gemini-embedding-001`)"
    );
  } else if (embeddingProvider === "openrouter") {
    envLines.push(
      "- `OPENROUTER_API_KEY`",
      "- Optional: `OPENROUTER_EMBEDDING_MODEL` (defaults to `text-embedding-3-small`)"
    );
  } else if (embeddingProvider === "cohere") {
    envLines.push(
      "- `COHERE_API_KEY`",
      "- Optional: `COHERE_EMBEDDING_MODEL` (defaults to `embed-english-v3.0`)"
    );
  } else if (embeddingProvider === "mistral") {
    envLines.push(
      "- `MISTRAL_API_KEY`",
      "- Optional: `MISTRAL_EMBEDDING_MODEL` (defaults to `mistral-embed`)"
    );
  } else if (embeddingProvider === "together") {
    envLines.push(
      "- `TOGETHER_AI_API_KEY`",
      "- Optional: `TOGETHER_AI_EMBEDDING_MODEL` (defaults to `togethercomputer/m2-bert-80M-2k-retrieval`)"
    );
  } else if (embeddingProvider === "voyage") {
    envLines.push(
      "- `VOYAGE_API_KEY`",
      "- Optional: `VOYAGE_MODEL` (defaults to `voyage-3.5-lite`)"
    );
  } else if (embeddingProvider === "ollama") {
    envLines.push("- Optional: `OLLAMA_EMBEDDING_MODEL` (defaults to `nomic-embed-text`)");
  } else if (embeddingProvider === "azure") {
    envLines.push(
      "- `AZURE_OPENAI_API_KEY`",
      "- `AZURE_RESOURCE_NAME`",
      "- Optional: `AZURE_EMBEDDING_MODEL` (defaults to `text-embedding-3-small`)"
    );
  } else if (embeddingProvider === "vertex") {
    envLines.push(
      "- `GOOGLE_APPLICATION_CREDENTIALS` (when running outside GCP)",
      "- Optional: `GOOGLE_VERTEX_EMBEDDING_MODEL` (defaults to `text-embedding-004`)"
    );
  } else if (embeddingProvider === "bedrock") {
    envLines.push(
      "- `AWS_REGION`",
      "- AWS credentials (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) when running outside AWS",
      "- Optional: `BEDROCK_EMBEDDING_MODEL` (defaults to `amazon.titan-embed-text-v2:0`)"
    );
  }

  // Replace the template env vars section with the provider-specific one.
  const withEnv = content.replace(
    /## Environment variables[\s\S]*?## Database requirements/,
    `${envLines.join("\n")}\n\n## Database requirements`
  );

  const withNotes = withEnv.replace("<!-- __UNRAG_ADAPTER_NOTES__ -->", notes.join("\n"));
  return withNotes
    .replaceAll("@unrag/config", `${selection.aliasBase}/config`)
    .replaceAll("`@unrag/*`", `\`${selection.aliasBase}/*\``);
};

export async function copyRegistryFiles(selection: RegistrySelection) {
  const toAbs = (projectRelative: string) =>
    path.join(selection.projectRoot, projectRelative);

  const installBaseAbs = toAbs(selection.installDir);

  const fileMappings: FileMapping[] = [
    // root config + docs
    {
      src: path.join(selection.registryRoot, "config/unrag.config.ts"),
      dest: toAbs("unrag.config.ts"),
      transform: (c) => renderUnragConfig(c, selection),
    },
    {
      src: path.join(selection.registryRoot, "docs/unrag.md"),
      dest: path.join(installBaseAbs, "unrag.md"),
      transform: (c) => renderDocs(c, selection),
    },

    // core
    {
      src: path.join(selection.registryRoot, "core/index.ts"),
      dest: path.join(installBaseAbs, "core/index.ts"),
    },
    {
      src: path.join(selection.registryRoot, "core/assets.ts"),
      dest: path.join(installBaseAbs, "core/assets.ts"),
    },
    {
      src: path.join(selection.registryRoot, "core/types.ts"),
      dest: path.join(installBaseAbs, "core/types.ts"),
    },
    {
      src: path.join(selection.registryRoot, "core/chunking.ts"),
      dest: path.join(installBaseAbs, "core/chunking.ts"),
    },
    {
      src: path.join(selection.registryRoot, "core/config.ts"),
      dest: path.join(installBaseAbs, "core/config.ts"),
    },
    {
      src: path.join(selection.registryRoot, "core/context-engine.ts"),
      dest: path.join(installBaseAbs, "core/context-engine.ts"),
    },
    {
      src: path.join(selection.registryRoot, "core/delete.ts"),
      dest: path.join(installBaseAbs, "core/delete.ts"),
    },
    {
      src: path.join(selection.registryRoot, "core/ingest.ts"),
      dest: path.join(installBaseAbs, "core/ingest.ts"),
    },
    {
      src: path.join(selection.registryRoot, "core/retrieve.ts"),
      dest: path.join(installBaseAbs, "core/retrieve.ts"),
    },

    // embedding
    {
      src: path.join(selection.registryRoot, "embedding/_shared.ts"),
      dest: path.join(installBaseAbs, "embedding/_shared.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/ai.ts"),
      dest: path.join(installBaseAbs, "embedding/ai.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/openai.ts"),
      dest: path.join(installBaseAbs, "embedding/openai.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/google.ts"),
      dest: path.join(installBaseAbs, "embedding/google.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/openrouter.ts"),
      dest: path.join(installBaseAbs, "embedding/openrouter.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/azure.ts"),
      dest: path.join(installBaseAbs, "embedding/azure.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/vertex.ts"),
      dest: path.join(installBaseAbs, "embedding/vertex.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/bedrock.ts"),
      dest: path.join(installBaseAbs, "embedding/bedrock.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/cohere.ts"),
      dest: path.join(installBaseAbs, "embedding/cohere.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/mistral.ts"),
      dest: path.join(installBaseAbs, "embedding/mistral.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/together.ts"),
      dest: path.join(installBaseAbs, "embedding/together.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/ollama.ts"),
      dest: path.join(installBaseAbs, "embedding/ollama.ts"),
    },
    {
      src: path.join(selection.registryRoot, "embedding/voyage.ts"),
      dest: path.join(installBaseAbs, "embedding/voyage.ts"),
    },
  ];

  // store
  if (selection.storeAdapter === "drizzle") {
    fileMappings.push(
      {
        src: path.join(
          selection.registryRoot,
          "store/drizzle-postgres-pgvector/index.ts"
        ),
        dest: path.join(installBaseAbs, "store/drizzle/index.ts"),
      },
      {
        src: path.join(
          selection.registryRoot,
          "store/drizzle-postgres-pgvector/schema.ts"
        ),
        dest: path.join(installBaseAbs, "store/drizzle/schema.ts"),
      },
      {
        src: path.join(
          selection.registryRoot,
          "store/drizzle-postgres-pgvector/store.ts"
        ),
        dest: path.join(installBaseAbs, "store/drizzle/store.ts"),
      }
    );
  } else if (selection.storeAdapter === "raw-sql") {
    fileMappings.push(
      {
        src: path.join(
          selection.registryRoot,
          "store/raw-sql-postgres-pgvector/index.ts"
        ),
        dest: path.join(installBaseAbs, "store/raw-sql/index.ts"),
      },
      {
        src: path.join(
          selection.registryRoot,
          "store/raw-sql-postgres-pgvector/store.ts"
        ),
        dest: path.join(installBaseAbs, "store/raw-sql/store.ts"),
      }
    );
  } else {
    fileMappings.push(
      {
        src: path.join(
          selection.registryRoot,
          "store/prisma-postgres-pgvector/index.ts"
        ),
        dest: path.join(installBaseAbs, "store/prisma/index.ts"),
      },
      {
        src: path.join(
          selection.registryRoot,
          "store/prisma-postgres-pgvector/store.ts"
        ),
        dest: path.join(installBaseAbs, "store/prisma/store.ts"),
      }
    );
  }

  const nonInteractive = Boolean(selection.yes) || !process.stdin.isTTY;
  const overwritePolicy = selection.overwrite ?? "skip";

  // overwrite handling
  for (const mapping of fileMappings) {
    if (!(await exists(mapping.src))) {
      throw new Error(`Registry file missing: ${mapping.src}`);
    }

    if (await exists(mapping.dest)) {
      if (overwritePolicy === "force") {
        // always overwrite
      } else if (nonInteractive) {
        // never overwrite in non-interactive mode
        continue;
      } else {
        const answer = await confirm({
          message: `Overwrite ${path.relative(selection.projectRoot, mapping.dest)}?`,
          initialValue: false,
        });
        if (isCancel(answer)) {
          cancel("Cancelled.");
          return;
        }
        if (!answer) {
          continue;
        }
      }
    }

    const raw = await readText(mapping.src);
    const content = mapping.transform ? mapping.transform(raw) : raw;
    await writeText(mapping.dest, content);
  }
}

export type ConnectorSelection = {
  projectRoot: string;
  registryRoot: string;
  installDir: string; // project-relative posix
  connector: string; // e.g. "notion"
  yes?: boolean; // non-interactive skip-overwrite
  overwrite?: "skip" | "force";
};

export async function copyConnectorFiles(selection: ConnectorSelection) {
  const toAbs = (projectRelative: string) =>
    path.join(selection.projectRoot, projectRelative);

  const installBaseAbs = toAbs(selection.installDir);
  const connectorRegistryAbs = path.join(
    selection.registryRoot,
    "connectors",
    selection.connector
  );

  if (!(await exists(connectorRegistryAbs))) {
    throw new Error(
      `Unknown connector registry: ${path.relative(selection.registryRoot, connectorRegistryAbs)}`
    );
  }

  const files = await listFilesRecursive(connectorRegistryAbs);

  const destRootAbs = path.join(
    installBaseAbs,
    "connectors",
    selection.connector
  );

  const nonInteractive = Boolean(selection.yes) || !process.stdin.isTTY;
  const overwritePolicy = selection.overwrite ?? "skip";

  for (const src of files) {
    if (!(await exists(src))) {
      throw new Error(`Registry file missing: ${src}`);
    }

    const rel = path.relative(connectorRegistryAbs, src);
    const dest = path.join(destRootAbs, rel);

    if (await exists(dest)) {
      if (overwritePolicy === "force") {
        // always overwrite
      } else if (nonInteractive) {
        continue;
      }

      const answer = await confirm({
        message: `Overwrite ${path.relative(selection.projectRoot, dest)}?`,
        initialValue: false,
      });
      if (isCancel(answer)) {
        cancel("Cancelled.");
        return;
      }
      if (!answer) {
        continue;
      }
    }

    const raw = await readText(src);
    await writeText(dest, raw);
  }
}

export type ExtractorSelection = {
  projectRoot: string;
  registryRoot: string;
  installDir: string; // project-relative posix
  extractor: string; // e.g. "pdf-llm"
  yes?: boolean; // non-interactive skip-overwrite
  overwrite?: "skip" | "force";
};

export async function copyExtractorFiles(selection: ExtractorSelection) {
  const toAbs = (projectRelative: string) =>
    path.join(selection.projectRoot, projectRelative);

  const installBaseAbs = toAbs(selection.installDir);
  const extractorRegistryAbs = path.join(
    selection.registryRoot,
    "extractors",
    selection.extractor
  );
  const sharedRegistryAbs = path.join(selection.registryRoot, "extractors", "_shared");

  if (!(await exists(extractorRegistryAbs))) {
    throw new Error(
      `Unknown extractor registry: ${path.relative(selection.registryRoot, extractorRegistryAbs)}`
    );
  }

  const extractorFiles = await listFilesRecursive(extractorRegistryAbs);
  const sharedFiles = (await exists(sharedRegistryAbs))
    ? await listFilesRecursive(sharedRegistryAbs)
    : [];

  const destRootAbs = path.join(
    installBaseAbs,
    "extractors",
    selection.extractor
  );
  const sharedDestRootAbs = path.join(installBaseAbs, "extractors", "_shared");

  const nonInteractive = Boolean(selection.yes) || !process.stdin.isTTY;
  const overwritePolicy = selection.overwrite ?? "skip";

  const shouldWrite = async (src: string, dest: string): Promise<boolean> => {
    if (!(await exists(dest))) return true;

    if (overwritePolicy === "force") return true;

    // In non-interactive mode we never overwrite existing files.
    if (nonInteractive) return false;

    // If the contents are identical, don't prompt.
    try {
      const [srcRaw, destRaw] = await Promise.all([readText(src), readText(dest)]);
      if (srcRaw === destRaw) return false;
    } catch {
      // If reads fail for any reason, fall back to prompting.
    }

    const answer = await confirm({
      message: `Overwrite ${path.relative(selection.projectRoot, dest)}?`,
      initialValue: false,
    });
    if (isCancel(answer)) {
      cancel("Cancelled.");
      return false;
    }
    return Boolean(answer);
  };

  // Copy extractor files.
  for (const src of extractorFiles) {
    if (!(await exists(src))) {
      throw new Error(`Registry file missing: ${src}`);
    }

    const rel = path.relative(extractorRegistryAbs, src);
    const dest = path.join(destRootAbs, rel);
    if (!(await shouldWrite(src, dest))) continue;

    const raw = await readText(src);
    await writeText(dest, raw);
  }

  // Copy shared extractor utilities (if present).
  for (const src of sharedFiles) {
    if (!(await exists(src))) {
      throw new Error(`Registry file missing: ${src}`);
    }

    const rel = path.relative(sharedRegistryAbs, src);
    const dest = path.join(sharedDestRootAbs, rel);
    if (!(await shouldWrite(src, dest))) continue;

    const raw = await readText(src);
    await writeText(dest, raw);
  }
}


