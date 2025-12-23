import { outro } from "@clack/prompts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findUp, tryFindProjectRoot } from "../lib/fs";
import { readJsonFile, writeJsonFile } from "../lib/json";
import { copyConnectorFiles, copyExtractorFiles } from "../lib/registry";
import {
  depsForConnector,
  depsForExtractor,
  mergeDeps,
  readPackageJson,
  writePackageJson,
  type ConnectorName,
  type ExtractorName,
} from "../lib/packageJson";
import { docsUrl } from "../lib/constants";

type InitConfig = {
  installDir: string;
  storeAdapter: "drizzle" | "prisma" | "raw-sql";
  aliasBase?: string;
  version: number;
  connectors?: string[];
  extractors?: string[];
};

const CONFIG_FILE = "unrag.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ParsedAddArgs = {
  kind?: "connector" | "extractor";
  name?: string;
  yes?: boolean;
};

const AVAILABLE_EXTRACTORS: ExtractorName[] = [
  "pdf-llm",
  "pdf-text-layer",
  "pdf-ocr",
  "image-ocr",
  "image-caption-llm",
  "audio-transcribe",
  "video-transcribe",
  "video-frames",
  "file-text",
  "file-docx",
  "file-pptx",
  "file-xlsx",
];

const parseAddArgs = (args: string[]): ParsedAddArgs => {
  const out: ParsedAddArgs = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--yes" || a === "-y") {
      out.yes = true;
      continue;
    }

    if (!out.kind && a && !a.startsWith("-")) {
      if (a === "extractor") {
        out.kind = "extractor";
        continue;
      }
      out.kind = "connector";
      out.name = a;
      continue;
    }

    if (out.kind === "extractor" && !out.name && a && !a.startsWith("-")) {
      out.name = a;
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
  const kind = parsed.kind ?? "connector";
  const name = parsed.name;

  if (!name) {
    outro(
      [
        "Usage:",
        "  unrag add <connector>",
        "  unrag add extractor <name>",
        "",
        "Available connectors: notion",
        `Available extractors: ${AVAILABLE_EXTRACTORS.join(", ")}`,
      ].join("\n")
    );
    return;
  }

  const configPath = path.join(root, CONFIG_FILE);
  const config = await readJsonFile<InitConfig>(configPath);
  if (!config?.installDir) {
    throw new Error(`Missing ${CONFIG_FILE}. Run \`unrag@latest init\` first.`);
  }

  const cliPackageRoot = await findUp(__dirname, "package.json");
  if (!cliPackageRoot) {
    throw new Error("Could not locate CLI package root (package.json not found).");
  }
  const registryRoot = path.join(cliPackageRoot, "registry");

  const nonInteractive = parsed.yes || !process.stdin.isTTY;

  const pkg = await readPackageJson(root);

  if (kind === "connector") {
    const connector = name as ConnectorName | undefined;
    if (connector !== "notion") {
      outro(`Unknown connector: ${name}\n\nAvailable connectors: notion`);
      return;
    }

    await copyConnectorFiles({
      projectRoot: root,
      registryRoot,
      installDir: config.installDir,
      connector,
      yes: nonInteractive,
    });

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

    return;
  }

  // Extractors
  const extractor = name as ExtractorName | undefined;
  if (!extractor || !AVAILABLE_EXTRACTORS.includes(extractor)) {
    outro(
      `Unknown extractor: ${name}\n\nAvailable extractors: ${AVAILABLE_EXTRACTORS.join(", ")}`
    );
    return;
  }

  await copyExtractorFiles({
    projectRoot: root,
    registryRoot,
    installDir: config.installDir,
    extractor,
    yes: nonInteractive,
  });

  const { deps, devDeps } = depsForExtractor(extractor);
  const merged = mergeDeps(pkg, deps, devDeps);
  if (merged.changes.length > 0) {
    await writePackageJson(root, merged.pkg);
  }

  const extractors = Array.from(
    new Set([...(config.extractors ?? []), extractor])
  ).sort();

  await writeJsonFile(configPath, { ...config, extractors });

  outro(
    [
      `Installed extractor: ${extractor}.`,
      "",
      `- Code: ${path.join(config.installDir, "extractors", extractor)}`,
      "",
      merged.changes.length > 0
        ? `Added deps: ${merged.changes.map((c) => c.name).join(", ")}`
        : "Added deps: none",
      "",
      `Next: import the extractor and pass it to createContextEngine({ extractors: [...] }).`,
    ]
      .filter(Boolean)
      .join("\n")
  );
}


