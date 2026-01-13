/**
 * Inference logic for doctor command.
 * Determines projectRoot, installDir, store adapter, and installed modules.
 */

import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { exists, tryFindProjectRoot } from "@cli/lib/fs";
import { readJsonFile } from "@cli/lib/json";
import type { InferredInstallState, UnragJsonConfig } from "@cli/lib/doctor/types";

const CONFIG_FILE = "unrag.json";
const CONFIG_TS_FILE = "unrag.config.ts";
const DEFAULT_INSTALL_DIRS = ["lib/unrag", "src/lib/unrag", "src/unrag"];

/**
 * Infer full install state from project filesystem.
 */
export async function inferInstallState(options: {
  projectRootOverride?: string;
  installDirOverride?: string;
}): Promise<InferredInstallState> {
  const warnings: string[] = [];

  // 1. Determine project root
  const projectRoot =
    options.projectRootOverride ??
    (await tryFindProjectRoot(process.cwd())) ??
    process.cwd();

  // 2. Try to read unrag.json
  const unragJsonPath = path.join(projectRoot, CONFIG_FILE);
  const unragJsonExists = await exists(unragJsonPath);
  let unragJson: UnragJsonConfig | null = null;
  let unragJsonParseable = false;

  if (unragJsonExists) {
    unragJson = await readJsonFile<UnragJsonConfig>(unragJsonPath);
    unragJsonParseable = unragJson !== null;
    if (!unragJsonParseable) {
      warnings.push(`${CONFIG_FILE} exists but could not be parsed.`);
    }
  }

  // 3. Determine installDir
  let installDir: string | null = null;

  if (options.installDirOverride) {
    installDir = options.installDirOverride;
  } else if (unragJson?.installDir) {
    installDir = unragJson.installDir;
  } else {
    // Infer from filesystem by checking default locations
    installDir = await inferInstallDirFromFilesystem(projectRoot);
    if (!installDir && !unragJsonExists) {
      warnings.push(
        "Could not find unrag.json or infer installDir from filesystem."
      );
    }
  }

  const installDirFull = installDir ? path.join(projectRoot, installDir) : null;
  const installDirExists = installDirFull ? await exists(installDirFull) : false;

  // 4. Check config file
  const configFileExists = await exists(path.join(projectRoot, CONFIG_TS_FILE));

  // 5. Determine store adapter
  let storeAdapter: "drizzle" | "prisma" | "raw-sql" | null = null;

  if (unragJson?.storeAdapter) {
    storeAdapter = unragJson.storeAdapter;
  } else if (installDirFull && installDirExists) {
    storeAdapter = await inferStoreAdapterFromFilesystem(installDirFull);
  }

  // 6. Determine embedding provider
  let embeddingProvider: string | null = null;

  if (unragJson?.embeddingProvider) {
    embeddingProvider = unragJson.embeddingProvider;
  } else if (installDirFull && installDirExists) {
    embeddingProvider = await inferEmbeddingProviderFromFilesystem(installDirFull);
  }

  // 7. Determine installed extractors
  let installedExtractors: string[] = [];

  if (unragJson?.extractors && Array.isArray(unragJson.extractors)) {
    installedExtractors = unragJson.extractors;
  }
  // Also check filesystem for extractors not in unrag.json
  if (installDirFull && installDirExists) {
    const fsExtractors = await inferExtractorsFromFilesystem(installDirFull);
    // Merge, preferring what's in unrag.json but adding any found on disk
    installedExtractors = Array.from(
      new Set([...installedExtractors, ...fsExtractors])
    ).sort();
  }

  // 8. Determine installed connectors
  let installedConnectors: string[] = [];

  if (unragJson?.connectors && Array.isArray(unragJson.connectors)) {
    installedConnectors = unragJson.connectors;
  }
  // Also check filesystem
  if (installDirFull && installDirExists) {
    const fsConnectors = await inferConnectorsFromFilesystem(installDirFull);
    installedConnectors = Array.from(
      new Set([...installedConnectors, ...fsConnectors])
    ).sort();
  }

  // 9. Try to infer DB env var from config
  let inferredDbEnvVar: string | null = null;
  if (configFileExists) {
    inferredDbEnvVar = await inferDbEnvVarFromConfig(projectRoot);
  }

  // 10. Determine inference confidence
  let inferenceConfidence: "high" | "medium" | "low" = "low";
  if (unragJsonExists && unragJsonParseable && installDirExists) {
    inferenceConfidence = "high";
  } else if (installDirExists && (storeAdapter || configFileExists)) {
    inferenceConfidence = "medium";
  }

  return {
    projectRoot,
    installDir,
    installDirExists,
    unragJsonExists,
    unragJsonParseable,
    unragJson,
    configFileExists,
    storeAdapter,
    embeddingProvider,
    installedExtractors,
    installedConnectors,
    inferredDbEnvVar,
    inferenceConfidence,
    warnings,
  };
}

/**
 * Scan default install dir candidates to find unrag.md or store/ folder.
 */
async function inferInstallDirFromFilesystem(
  projectRoot: string
): Promise<string | null> {
  for (const candidate of DEFAULT_INSTALL_DIRS) {
    const full = path.join(projectRoot, candidate);
    if (!(await exists(full))) continue;

    // Check for unrag.md or store/ or core/ folder
    const hasUnragMd = await exists(path.join(full, "unrag.md"));
    const hasStore = await exists(path.join(full, "store"));
    const hasCore = await exists(path.join(full, "core"));

    if (hasUnragMd || hasStore || hasCore) {
      return candidate;
    }
  }
  return null;
}

/**
 * Infer store adapter by checking which adapter folder exists.
 */
async function inferStoreAdapterFromFilesystem(
  installDir: string
): Promise<"drizzle" | "prisma" | "raw-sql" | null> {
  const storeDir = path.join(installDir, "store");
  if (!(await exists(storeDir))) return null;

  try {
    const entries = await readdir(storeDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    // Check for adapter folder names (may include provider suffix)
    for (const dir of dirs) {
      if (dir.includes("drizzle")) return "drizzle";
      if (dir.includes("prisma")) return "prisma";
      if (dir.includes("raw-sql")) return "raw-sql";
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Infer embedding provider by checking which provider file exists under embedding/.
 */
async function inferEmbeddingProviderFromFilesystem(
  installDir: string
): Promise<string | null> {
  const embeddingDir = path.join(installDir, "embedding");
  if (!(await exists(embeddingDir))) return null;

  const providers = [
    "ai",
    "openai",
    "google",
    "openrouter",
    "azure",
    "vertex",
    "bedrock",
    "cohere",
    "mistral",
    "together",
    "ollama",
    "voyage",
  ];

  try {
    const entries = await readdir(embeddingDir);
    for (const provider of providers) {
      if (entries.includes(`${provider}.ts`)) {
        return provider;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Infer installed extractors from filesystem.
 */
async function inferExtractorsFromFilesystem(
  installDir: string
): Promise<string[]> {
  const extractorsDir = path.join(installDir, "extractors");
  if (!(await exists(extractorsDir))) return [];

  try {
    const entries = await readdir(extractorsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => {
        // Unrag's vendored extractor templates include internal helpers under `_shared/`.
        // This is not a user-installable extractor module and should not be treated as one.
        if (name === "_shared") return false;
        // Also ignore other private/internal folders.
        if (name.startsWith("_")) return false;
        return true;
      });
  } catch {
    return [];
  }
}

/**
 * Infer installed connectors from filesystem.
 */
async function inferConnectorsFromFilesystem(
  installDir: string
): Promise<string[]> {
  const connectorsDir = path.join(installDir, "connectors");
  if (!(await exists(connectorsDir))) return [];

  try {
    const entries = await readdir(connectorsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Best-effort inference of DB env var from unrag.config.ts.
 * Scans for process.env.SOME_VAR patterns in connection strings.
 */
async function inferDbEnvVarFromConfig(
  projectRoot: string
): Promise<string | null> {
  const configPath = path.join(projectRoot, CONFIG_TS_FILE);
  if (!(await exists(configPath))) return null;

  try {
    const content = await readFile(configPath, "utf8");
    const candidates = extractDbEnvVarCandidates(content);

    if (candidates.length === 0) {
      // Also try to follow imports and scan those files
      const importedFiles = extractLocalImports(content);
      for (const importPath of importedFiles) {
        const resolved = await resolveImportPath(projectRoot, importPath);
        if (resolved) {
          const importContent = await readFile(resolved, "utf8").catch(
            () => null
          );
          if (importContent) {
            candidates.push(...extractDbEnvVarCandidates(importContent));
          }
        }
      }
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0]!;

    // Multiple candidates - prefer common names
    const preferred = candidates.find(
      (c) =>
        c === "DATABASE_URL" ||
        c.endsWith("_DATABASE_URL") ||
        c.endsWith("_DB_URL")
    );
    return preferred ?? candidates[0]!;
  } catch {
    return null;
  }
}

/**
 * Extract potential DB env var names from source code.
 * Looks for patterns like:
 * - process.env.DATABASE_URL
 * - connectionString: process.env.X
 * - new Pool({ connectionString: process.env.X })
 */
function extractDbEnvVarCandidates(source: string): string[] {
  const candidates: string[] = [];

  // Pattern 1: process.env.SOME_VAR near connectionString or Pool
  const connectionStringPattern =
    /connectionString\s*[:=]\s*process\.env\.([A-Z_][A-Z0-9_]*)/gi;
  let match;
  while ((match = connectionStringPattern.exec(source)) !== null) {
    if (match[1]) candidates.push(match[1]);
  }

  // Pattern 2: DATABASE_URL or similar in process.env
  const dbUrlPattern =
    /process\.env\.([A-Z_]*(?:DATABASE|DB)_?(?:URL|URI|CONNECTION)[A-Z_]*)/gi;
  while ((match = dbUrlPattern.exec(source)) !== null) {
    if (match[1] && !candidates.includes(match[1])) {
      candidates.push(match[1]);
    }
  }

  // Pattern 3: Generic process.env.SOME_URL after new Pool(
  const poolPattern = /new\s+Pool\s*\(\s*\{[^}]*process\.env\.([A-Z_][A-Z0-9_]*)/gi;
  while ((match = poolPattern.exec(source)) !== null) {
    if (match[1] && !candidates.includes(match[1])) {
      candidates.push(match[1]);
    }
  }

  return candidates;
}

/**
 * Extract local import paths from source (not from node_modules).
 */
function extractLocalImports(source: string): string[] {
  const imports: string[] = [];

  // Match: import { x } from "./path" or from "@/path"
  const importPattern = /from\s+["']([.@][^"']+)["']/g;
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    if (match[1]) imports.push(match[1]);
  }

  return imports;
}

/**
 * Try to resolve an import path to an absolute file path.
 */
async function resolveImportPath(
  projectRoot: string,
  importPath: string
): Promise<string | null> {
  // Handle relative imports
  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    const configDir = projectRoot;
    const resolved = path.resolve(configDir, importPath);
    // Try common extensions
    for (const ext of [".ts", ".tsx", ".js", ".jsx", ""]) {
      const candidate = resolved + ext;
      if (await exists(candidate)) return candidate;
    }
    // Try as directory with index
    for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
      const candidate = path.join(resolved, `index${ext}`);
      if (await exists(candidate)) return candidate;
    }
    return null;
  }

  // Handle alias imports like @/lib/db
  if (importPath.startsWith("@/") || importPath.startsWith("@")) {
    // Try to read tsconfig to resolve alias
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    if (await exists(tsconfigPath)) {
      try {
        const tsconfig = await readJsonFile<{
          compilerOptions?: { paths?: Record<string, string[]> };
        }>(tsconfigPath);
        const paths = tsconfig?.compilerOptions?.paths;
        if (paths) {
          for (const [alias, targets] of Object.entries(paths)) {
            const aliasBase = alias.replace("/*", "");
            if (importPath.startsWith(aliasBase)) {
              const rest = importPath.slice(aliasBase.length).replace(/^\//, "");
              for (const target of targets) {
                const targetBase = target.replace("/*", "").replace(/^\.\//, "");
                const resolved = path.join(projectRoot, targetBase, rest);
                for (const ext of [".ts", ".tsx", ".js", ".jsx", ""]) {
                  const candidate = resolved + ext;
                  if (await exists(candidate)) return candidate;
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

/**
 * Infer table names from store adapter files.
 */
export async function inferTableNames(
  installDir: string,
  storeAdapter: "drizzle" | "prisma" | "raw-sql" | null
): Promise<{ documents: string; chunks: string; embeddings: string }> {
  const defaults = {
    documents: "documents",
    chunks: "chunks",
    embeddings: "embeddings",
  };

  if (!storeAdapter || !installDir) return defaults;

  const storeDir = path.join(installDir, "store");
  if (!(await exists(storeDir))) return defaults;

  // Try to find and parse schema/store files
  try {
    const entries = await readdir(storeDir, { withFileTypes: true });
    const adapterDir = entries.find(
      (e) => e.isDirectory() && e.name.includes(storeAdapter)
    );
    if (!adapterDir) return defaults;

    const adapterPath = path.join(storeDir, adapterDir.name);

    // For drizzle, check schema.ts
    if (storeAdapter === "drizzle") {
      const schemaPath = path.join(adapterPath, "schema.ts");
      if (await exists(schemaPath)) {
        const content = await readFile(schemaPath, "utf8");
        const tableNames = extractDrizzleTableNames(content);
        return { ...defaults, ...tableNames };
      }
    }

    // For prisma/raw-sql, check store.ts for table names in SQL
    const storePath = path.join(adapterPath, "store.ts");
    if (await exists(storePath)) {
      const content = await readFile(storePath, "utf8");
      const tableNames = extractSqlTableNames(content);
      return { ...defaults, ...tableNames };
    }
  } catch {
    // ignore
  }

  return defaults;
}

/**
 * Extract table names from Drizzle schema.ts.
 */
function extractDrizzleTableNames(source: string): Partial<{
  documents: string;
  chunks: string;
  embeddings: string;
}> {
  const result: Partial<{ documents: string; chunks: string; embeddings: string }> = {};

  // Match: pgTable("table_name", ...)
  const tablePattern =
    /export\s+const\s+(documents|chunks|embeddings)\s*=\s*pgTable\s*\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = tablePattern.exec(source)) !== null) {
    const varName = match[1] as "documents" | "chunks" | "embeddings";
    const tableName = match[2];
    if (tableName) result[varName] = tableName;
  }

  return result;
}

/**
 * Extract table names from raw SQL in store.ts.
 */
function extractSqlTableNames(source: string): Partial<{
  documents: string;
  chunks: string;
  embeddings: string;
}> {
  const result: Partial<{ documents: string; chunks: string; embeddings: string }> = {};

  // Match: FROM documents, INTO documents, etc.
  const patterns = [
    /(?:from|into|update|delete\s+from)\s+([a-z_][a-z0-9_]*)\s/gi,
    /references\s+([a-z_][a-z0-9_]*)\s*\(/gi,
  ];

  const found = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (match[1]) found.add(match[1].toLowerCase());
    }
  }

  // Map found names to our expected tables
  for (const name of found) {
    if (name.includes("document") && !name.includes("chunk")) {
      result.documents = name;
    } else if (name.includes("chunk")) {
      result.chunks = name;
    } else if (name.includes("embedding")) {
      result.embeddings = name;
    }
  }

  return result;
}
