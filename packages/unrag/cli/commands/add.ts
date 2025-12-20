import { outro } from "@clack/prompts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findUp, tryFindProjectRoot } from "../lib/fs";
import { readJsonFile, writeJsonFile } from "../lib/json";
import { copyConnectorFiles } from "../lib/registry";
import {
  depsForConnector,
  mergeDeps,
  readPackageJson,
  writePackageJson,
  type ConnectorName,
} from "../lib/packageJson";
import { docsUrl } from "../lib/constants";

type InitConfig = {
  installDir: string;
  storeAdapter: "drizzle" | "prisma" | "raw-sql";
  aliasBase?: string;
  version: number;
  connectors?: string[];
};

const CONFIG_FILE = "unrag.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ParsedAddArgs = {
  connector?: string;
  yes?: boolean;
};

const parseAddArgs = (args: string[]): ParsedAddArgs => {
  const out: ParsedAddArgs = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--yes" || a === "-y") {
      out.yes = true;
      continue;
    }
    if (!out.connector && a && !a.startsWith("-")) {
      out.connector = a;
      continue;
    }
  }

  return out;
};

export async function addCommand(args: string[]) {
  const root = await tryFindProjectRoot(process.cwd());
  if (!root) {
    throw new Error("Could not find a project root (no package.json found).");
  }

  const parsed = parseAddArgs(args);
  const connector = parsed.connector as ConnectorName | undefined;

  if (!connector) {
    outro("Usage: unrag add <connector>\n\nAvailable connectors: notion");
    return;
  }

  if (connector !== "notion") {
    outro(`Unknown connector: ${connector}\n\nAvailable connectors: notion`);
    return;
  }

  const configPath = path.join(root, CONFIG_FILE);
  const config = await readJsonFile<InitConfig>(configPath);
  if (!config?.installDir) {
    throw new Error(`Missing ${CONFIG_FILE}. Run \`unrag init\` first.`);
  }

  const cliPackageRoot = await findUp(__dirname, "package.json");
  if (!cliPackageRoot) {
    throw new Error("Could not locate CLI package root (package.json not found).");
  }
  const registryRoot = path.join(cliPackageRoot, "registry");

  const nonInteractive = parsed.yes || !process.stdin.isTTY;

  await copyConnectorFiles({
    projectRoot: root,
    registryRoot,
    installDir: config.installDir,
    connector,
    yes: nonInteractive,
  });

  const pkg = await readPackageJson(root);
  const { deps, devDeps } = depsForConnector(connector);
  const merged = mergeDeps(pkg, deps, devDeps);
  if (merged.changes.length > 0) {
    await writePackageJson(root, merged.pkg);
  }

  const connectors = Array.from(
    new Set([...(config.connectors ?? []), connector])
  ).sort();

  await writeJsonFile(configPath, { ...config, connectors });

  outro(
    [
      `Installed connector: ${connector}.`,
      "",
      `- Code: ${path.join(config.installDir, "connectors", connector)}`,
      `- Docs: ${docsUrl(`/docs/connectors/${connector}`)}`,
      "",
      merged.changes.length > 0
        ? `Added deps: ${merged.changes.map((c) => c.name).join(", ")}`
        : "Added deps: none",
      nonInteractive
        ? ""
        : "Tip: keep NOTION_TOKEN server-side only (env var).",
    ]
      .filter(Boolean)
      .join("\n")
  );
}


