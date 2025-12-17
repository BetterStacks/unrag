import { cancel, isCancel, outro, select, text } from "@clack/prompts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyRegistryFiles, type RegistrySelection } from "../lib/registry";
import { readJsonFile, writeJsonFile } from "../lib/json";
import { findUp, normalizePosixPath, tryFindProjectRoot } from "../lib/fs";
import {
  depsForAdapter,
  detectPackageManager,
  installCmd,
  mergeDeps,
  readPackageJson,
  writePackageJson,
} from "../lib/packageJson";
import { patchTsconfigPaths } from "../lib/tsconfig";

type InitConfig = {
  installDir: string;
  storeAdapter: "drizzle" | "prisma" | "raw-sql";
  aliasBase?: string;
  version: number;
};

const CONFIG_FILE = "unrag.json";
const CONFIG_VERSION = 1;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ParsedInitArgs = {
  installDir?: string;
  storeAdapter?: InitConfig["storeAdapter"];
  aliasBase?: string;
  yes?: boolean;
};

const parseInitArgs = (args: string[]): ParsedInitArgs => {
  const out: ParsedInitArgs = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--yes" || a === "-y") {
      out.yes = true;
      continue;
    }
    if (a === "--dir" || a === "--install-dir") {
      const v = args[i + 1];
      if (v) {
        out.installDir = v;
        i++;
      }
      continue;
    }
    if (a === "--store") {
      const v = args[i + 1];
      if (v === "drizzle" || v === "prisma" || v === "raw-sql") {
        out.storeAdapter = v;
        i++;
      }
      continue;
    }
    if (a === "--alias") {
      const v = args[i + 1];
      if (v) {
        out.aliasBase = v;
        i++;
      }
      continue;
    }
  }

  return out;
};

export async function initCommand(args: string[]) {
  const root = await tryFindProjectRoot(process.cwd());
  if (!root) {
    throw new Error("Could not find a project root (no package.json found).");
  }

  const cliPackageRoot = await findUp(__dirname, "package.json");
  if (!cliPackageRoot) {
    throw new Error("Could not locate CLI package root (package.json not found).");
  }
  const registryRoot = path.join(cliPackageRoot, "registry");

  const existing = await readJsonFile<InitConfig>(path.join(root, CONFIG_FILE));

  const parsed = parseInitArgs(args);

  const defaults = {
    installDir: existing?.installDir ?? "lib/unrag",
    storeAdapter: existing?.storeAdapter ?? "drizzle",
    aliasBase: existing?.aliasBase ?? "@unrag",
  } as const;

  const nonInteractive = parsed.yes || !process.stdin.isTTY;

  const installDirAnswer = parsed.installDir
    ? parsed.installDir
    : nonInteractive
      ? defaults.installDir
      : await text({
          message: "Install directory",
          initialValue: defaults.installDir,
          validate: (v) => {
            if (!v.trim()) return "Install directory is required";
            if (v.startsWith("/")) return "Use a project-relative path";
            return;
          },
        });
  if (isCancel(installDirAnswer)) {
    cancel("Cancelled.");
    return;
  }
  const installDir = normalizePosixPath(String(installDirAnswer));

  const storeAdapterAnswer = parsed.storeAdapter
    ? parsed.storeAdapter
    : nonInteractive
      ? defaults.storeAdapter
      : await select({
          message: "Store adapter",
          initialValue: defaults.storeAdapter,
          options: [
            { value: "drizzle", label: "Drizzle (Postgres + pgvector)" },
            { value: "prisma", label: "Prisma (Postgres + pgvector)" },
            { value: "raw-sql", label: "Raw SQL (Postgres + pgvector)" },
          ],
        });
  if (isCancel(storeAdapterAnswer)) {
    cancel("Cancelled.");
    return;
  }

  const aliasAnswer = parsed.aliasBase
    ? parsed.aliasBase
    : nonInteractive
      ? defaults.aliasBase
      : await text({
          message: "Import alias base",
          initialValue: defaults.aliasBase,
          validate: (v) => {
            const s = v.trim();
            if (!s) return "Alias is required";
            if (s.includes(" ")) return "Alias must not contain spaces";
            if (!s.startsWith("@")) return 'Alias should start with "@" (e.g. "@unrag")';
            if (s.endsWith("/")) return "Alias must not end with /";
            return;
          },
        });
  if (isCancel(aliasAnswer)) {
    cancel("Cancelled.");
    return;
  }
  const aliasBase = String(aliasAnswer).trim();

  const selection: RegistrySelection = {
    installDir,
    storeAdapter: storeAdapterAnswer as RegistrySelection["storeAdapter"],
    projectRoot: root,
    registryRoot,
    aliasBase,
  };

  await copyRegistryFiles(selection);

  const pkg = await readPackageJson(root);
  const { deps, devDeps } = depsForAdapter(storeAdapterAnswer);
  const merged = mergeDeps(pkg, deps, devDeps);
  if (merged.changes.length > 0) {
    await writePackageJson(root, merged.pkg);
  }

  const config: InitConfig = {
    installDir,
    storeAdapter: storeAdapterAnswer,
    aliasBase,
    version: CONFIG_VERSION,
  };
  await writeJsonFile(path.join(root, CONFIG_FILE), config);

  const pm = await detectPackageManager(root);
  const installLine =
    merged.changes.length > 0
      ? `Next: run \`${installCmd(pm)}\``
      : "Dependencies already satisfied.";

  const isNext =
    Boolean((merged.pkg.dependencies ?? {})["next"]) ||
    Boolean((merged.pkg.devDependencies ?? {})["next"]);

  const tsconfigResult = isNext
    ? await patchTsconfigPaths({ projectRoot: root, installDir, aliasBase })
    : { changed: false as const };

  outro(
    [
      "Installed Unrag.",
      "",
      `- Code: ${path.join(installDir)}`,
      `- Docs: ${path.join(installDir, "unrag.md")}`,
      `- Config: unrag.config.ts`,
      `- Imports: ${aliasBase}/* and ${aliasBase}/config`,
      isNext
        ? tsconfigResult.changed
          ? `- Next.js: updated ${tsconfigResult.file} (added aliases)`
          : `- Next.js: no tsconfig changes needed`
        : `- Next.js: not detected`,
      "",
      merged.changes.length > 0
        ? `Added deps: ${merged.changes.map((c) => c.name).join(", ")}`
        : "Added deps: none",
      installLine,
      "",
      `Saved ${CONFIG_FILE}.`,
    ].join("\n")
  );
}


