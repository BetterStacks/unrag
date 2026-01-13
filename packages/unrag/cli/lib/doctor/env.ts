/**
 * Minimal dotenv loader for `unrag doctor`.
 *
 * We intentionally avoid pulling in `dotenv` to keep the CLI lightweight.
 * This loader is best-effort and only supports common KEY=VALUE syntax.
 */

import path from "node:path";
import { readFile } from "node:fs/promises";
import { exists } from "../fs";

export type EnvLoadResult = {
  loadedFiles: string[];
  loadedKeys: string[];
  skippedKeys: string[];
  warnings: string[];
};

/**
 * Load env files using default discovery (legacy function).
 */
export async function loadEnvFiles(options: {
  projectRoot: string;
  extraEnvFile?: string;
}): Promise<EnvLoadResult> {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim();

  const candidates = [
    ".env",
    ".env.local",
    ...(nodeEnv ? [`.env.${nodeEnv}`, `.env.${nodeEnv}.local`] : []),
  ];

  if (options.extraEnvFile) {
    candidates.unshift(options.extraEnvFile);
  }

  return loadEnvFilesFromList({
    projectRoot: options.projectRoot,
    files: candidates,
  });
}

/**
 * Load env files from a specific list of file paths.
 * Supports both relative (to projectRoot) and absolute paths.
 */
export async function loadEnvFilesFromList(options: {
  projectRoot: string;
  files: string[];
}): Promise<EnvLoadResult> {
  const loadedFiles: string[] = [];
  const loadedKeys: string[] = [];
  const skippedKeys: string[] = [];
  const warnings: string[] = [];

  for (const rel of options.files) {
    // Skip empty strings (can happen with ${NODE_ENV} interpolation when NODE_ENV is empty)
    if (!rel.trim()) continue;

    const abs = path.isAbsolute(rel) ? rel : path.join(options.projectRoot, rel);
    if (!(await exists(abs))) continue;

    try {
      const raw = await readFile(abs, "utf8");
      const parsed = parseDotenv(raw);

      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] !== undefined) {
          skippedKeys.push(k);
          continue;
        }
        process.env[k] = v;
        loadedKeys.push(k);
      }

      loadedFiles.push(rel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to read ${rel}: ${msg}`);
    }
  }

  return {
    loadedFiles,
    loadedKeys,
    skippedKeys,
    warnings,
  };
}

function parseDotenv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Support `export KEY=...`
    const l = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;

    const eq = l.indexOf("=");
    if (eq <= 0) continue;

    const key = l.slice(0, eq).trim();
    if (!key) continue;

    let value = l.slice(eq + 1).trim();

    // Strip inline comment for unquoted values: KEY=value # comment
    if (!value.startsWith("\"") && !value.startsWith("'")) {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trim();
    }

    // Unquote
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Unescape common sequences in double-quoted values
    if (trimmed.includes("\"")) {
      value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
    }

    out[key] = value;
  }

  return out;
}

