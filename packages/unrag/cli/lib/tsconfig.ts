import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { exists } from "./fs";
import { parse } from "jsonc-parser";

type TsConfig = Record<string, unknown> & {
  compilerOptions?: Record<string, unknown> & {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
};

const parseJsoncLoose = (raw: string): TsConfig => {
  const errors: Parameters<typeof parse>[1] = [];
  const result = parse(raw, errors, { allowTrailingComma: true }) as TsConfig;
  if (errors.length > 0 || !result || typeof result !== "object") {
    throw new Error("Failed to parse tsconfig JSONC");
  }
  return result;
};

export async function patchTsconfigPaths(params: {
  projectRoot: string;
  installDir: string; // posix project-relative
}): Promise<{ changed: boolean; file?: string }> {
  const configFile =
    (await exists(path.join(params.projectRoot, "tsconfig.json")))
      ? "tsconfig.json"
      : (await exists(path.join(params.projectRoot, "jsconfig.json")))
        ? "jsconfig.json"
        : null;

  const aliasKey = "@unrag/*";
  const target = [`./${params.installDir.replace(/\\/g, "/")}/*`];
  const configAliasKey = "@unrag/config";
  const configTarget = ["./unrag.config.ts"];

  // If there's no tsconfig/jsconfig yet (common in fresh Next apps), create one.
  if (!configFile) {
    const abs = path.join(params.projectRoot, "tsconfig.json");
    const next: TsConfig = {
      compilerOptions: {
        baseUrl: ".",
        paths: {
          [aliasKey]: target,
          [configAliasKey]: configTarget,
        },
      },
    };

    await writeFile(abs, JSON.stringify(next, null, 2) + "\n", "utf8");
    return { changed: true, file: "tsconfig.json" };
  }

  const abs = path.join(params.projectRoot, configFile);
  const raw = await readFile(abs, "utf8");
  let parsed: TsConfig;
  try {
    parsed = parseJsoncLoose(raw);
  } catch {
    // Fail-soft: don't block installation if the user's tsconfig is non-standard.
    return { changed: false, file: configFile };
  }

  const next: TsConfig = { ...parsed };
  next.compilerOptions =
    parsed.compilerOptions && typeof parsed.compilerOptions === "object"
      ? { ...parsed.compilerOptions }
      : {};

  const parsedPaths =
    next.compilerOptions.paths && typeof next.compilerOptions.paths === "object"
      ? next.compilerOptions.paths
      : {};
  next.compilerOptions.paths = { ...parsedPaths };

  const hasBaseUrl = typeof next.compilerOptions.baseUrl === "string" && next.compilerOptions.baseUrl.length > 0;
  const hasRagAlias = Array.isArray(next.compilerOptions.paths[aliasKey]);
  const hasRagConfigAlias = Array.isArray(next.compilerOptions.paths[configAliasKey]);

  const needsWrite = !hasBaseUrl || !hasRagAlias || !hasRagConfigAlias;
  if (!needsWrite) return { changed: false, file: configFile };

  if (!hasBaseUrl) {
    next.compilerOptions.baseUrl = ".";
  }
  if (!hasRagAlias) {
    next.compilerOptions.paths[aliasKey] = target;
  }
  if (!hasRagConfigAlias) {
    next.compilerOptions.paths[configAliasKey] = configTarget;
  }

  await writeFile(abs, JSON.stringify(next, null, 2) + "\n", "utf8");
  return { changed: true, file: configFile };
}


