import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { confirm, isCancel, cancel } from "@clack/prompts";
import { ensureDir, exists, listFilesRecursive } from "./fs";

export type RegistrySelection = {
  projectRoot: string;
  registryRoot: string;
  installDir: string; // project-relative posix
  storeAdapter: "drizzle" | "prisma" | "raw-sql";
  aliasBase: string; // e.g. "@unrag"
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

const renderUnragConfig = (content: string, selection: RegistrySelection) => {
  const installImportBase = `./${selection.installDir.replace(/\\/g, "/")}`;

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

  const importsBlock = [...baseImports, ...storeImports].join("\n");

  const createEngineBlock = [
    `export function createUnragEngine() {`,
    ...storeCreateLines,
    ``,
    `  return unrag.createEngine({ store });`,
    `}`,
    ``,
    `export async function retrieve(query: string) {`,
    `  const engine = createUnragEngine();`,
    `  return engine.retrieve({ query, topK: unrag.defaults.retrieval.topK });`,
    `}`,
  ].join("\n");

  return content
    .replace("// __UNRAG_IMPORTS__", importsBlock)
    .replace("// __UNRAG_CREATE_ENGINE__", createEngineBlock);
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

  if (!(await exists(extractorRegistryAbs))) {
    throw new Error(
      `Unknown extractor registry: ${path.relative(selection.registryRoot, extractorRegistryAbs)}`
    );
  }

  const files = await listFilesRecursive(extractorRegistryAbs);

  const destRootAbs = path.join(
    installBaseAbs,
    "extractors",
    selection.extractor
  );

  const nonInteractive = Boolean(selection.yes) || !process.stdin.isTTY;

  for (const src of files) {
    if (!(await exists(src))) {
      throw new Error(`Registry file missing: ${src}`);
    }

    const rel = path.relative(extractorRegistryAbs, src);
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


