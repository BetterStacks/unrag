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

const renderUnragConfig = (content: string, selection: RegistrySelection) => {
  const installImportBase = `./${selection.installDir.replace(/\\/g, "/")}`;
  const richMedia = selection.richMedia ?? { enabled: false, extractors: [] as ExtractorName[] };
  const selectedExtractors = Array.from(new Set(richMedia.extractors ?? [])).sort();

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

  // Cleanly rewrite embedding mode + model (without leaving marker comments).
  out = out
    .replace(
      'type: "text", // __UNRAG_EMBEDDING_TYPE__',
      richMedia.enabled ? 'type: "multimodal",' : 'type: "text",'
    )
    .replace(
      'model: "openai/text-embedding-3-small", // __UNRAG_EMBEDDING_MODEL__',
      richMedia.enabled ? 'model: "cohere/embed-v4.0",' : 'model: "openai/text-embedding-3-small",'
    );

  // Enable/disable assetProcessing flags, stripping marker comments in either case.
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

  const withNotes = content.replace("<!-- __UNRAG_ADAPTER_NOTES__ -->", notes.join("\n"));
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
      src: path.join(selection.registryRoot, "embedding/ai.ts"),
      dest: path.join(installBaseAbs, "embedding/ai.ts"),
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

  // overwrite handling
  for (const mapping of fileMappings) {
    if (!(await exists(mapping.src))) {
      throw new Error(`Registry file missing: ${mapping.src}`);
    }

    if (await exists(mapping.dest)) {
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

  for (const src of files) {
    if (!(await exists(src))) {
      throw new Error(`Registry file missing: ${src}`);
    }

    const rel = path.relative(connectorRegistryAbs, src);
    const dest = path.join(destRootAbs, rel);

    if (await exists(dest)) {
      if (nonInteractive) {
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

  const shouldWrite = async (src: string, dest: string): Promise<boolean> => {
    if (!(await exists(dest))) return true;

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


