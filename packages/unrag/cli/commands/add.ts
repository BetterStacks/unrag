import { outro } from "@clack/prompts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findUp, tryFindProjectRoot } from "../lib/fs";
import { readJsonFile, writeJsonFile } from "../lib/json";
import { readRegistryManifest } from "../lib/manifest";
import { copyBatteryFiles, copyConnectorFiles, copyExtractorFiles } from "../lib/registry";
import {
  depsForBattery,
  depsForConnector,
  depsForExtractor,
  installDependencies,
  mergeDeps,
  readPackageJson,
  writePackageJson,
  type BatteryName,
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
  batteries?: string[];
};

const CONFIG_FILE = "unrag.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ParsedAddArgs = {
  kind?: "connector" | "extractor" | "battery";
  name?: string;
  yes?: boolean;
  noInstall?: boolean;
};

const parseAddArgs = (args: string[]): ParsedAddArgs => {
  const out: ParsedAddArgs = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--yes" || a === "-y") {
      out.yes = true;
      continue;
    }
    if (a === "--no-install") {
      out.noInstall = true;
      continue;
    }

    if (!out.kind && a && !a.startsWith("-")) {
      if (a === "extractor") {
        out.kind = "extractor";
        continue;
      }
      if (a === "battery") {
        out.kind = "battery";
        continue;
      }
      out.kind = "connector";
      out.name = a;
      continue;
    }

    if ((out.kind === "extractor" || out.kind === "battery") && !out.name && a && !a.startsWith("-")) {
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
  const noInstall =
    Boolean(parsed.noInstall) || process.env.UNRAG_SKIP_INSTALL === "1";

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
  const manifest = await readRegistryManifest(registryRoot);
  const availableExtractors = new Set(
    manifest.extractors.map((e) => e.id as ExtractorName)
  );
  const availableConnectors = new Set(
    manifest.connectors
      .filter((c) => c.status === "available")
      .map((c) => c.id as ConnectorName)
  );
  const availableBatteries = new Set(
    (manifest.batteries ?? [])
      .filter((b) => b.status === "available")
      .map((b) => b.id as BatteryName)
  );

  if (!name) {
    outro(
      [
        "Usage:",
        "  unrag add <connector>",
        "  unrag add extractor <name>",
        "  unrag add battery <name>",
        "",
        `Available connectors: ${Array.from(availableConnectors).join(", ")}`,
        `Available extractors: ${Array.from(availableExtractors).join(", ")}`,
        `Available batteries: ${Array.from(availableBatteries).join(", ")}`,
      ].join("\n")
    );
    return;
  }

  const nonInteractive = parsed.yes || !process.stdin.isTTY;

  const pkg = await readPackageJson(root);

  // Batteries
  if (kind === "battery") {
    const battery = name as BatteryName | undefined;
    if (!battery || !availableBatteries.has(battery)) {
      outro(
        `Unknown battery: ${name}\n\nAvailable batteries: ${Array.from(availableBatteries).join(", ")}`
      );
      return;
    }

    await copyBatteryFiles({
      projectRoot: root,
      registryRoot,
      installDir: config.installDir,
      battery,
      yes: nonInteractive,
    });

    const { deps, devDeps } = depsForBattery(battery);
    const merged = mergeDeps(pkg, deps, devDeps);
    if (merged.changes.length > 0) {
      await writePackageJson(root, merged.pkg);
      if (!noInstall) {
        await installDependencies(root);
      }
    }

    const batteries = Array.from(
      new Set([...(config.batteries ?? []), battery])
    ).sort();

    await writeJsonFile(configPath, { ...config, batteries });

    // Generate wiring snippet based on the battery
    const wiringSnippet = battery === "reranker"
      ? [
          "",
          "Next steps:",
          "1. Import the reranker in unrag.config.ts:",
          `   import { createCohereReranker } from "./${config.installDir}/rerank";`,
          "",
          "2. Add reranker to your engine config:",
          "   const reranker = createCohereReranker();",
          "   return unrag.createEngine({ store, reranker });",
          "",
          "3. Use reranking in your retrieval flow:",
          "   const retrieved = await engine.retrieve({ query, topK: 30 });",
          "   const reranked = await engine.rerank({ query, candidates: retrieved.chunks, topK: 8 });",
          "",
          "Env: COHERE_API_KEY (required for Cohere rerank-v3.5)",
        ]
      : [];

    outro(
      [
        `Installed battery: ${battery}.`,
        "",
        `- Code: ${path.join(config.installDir, battery === "reranker" ? "rerank" : battery)}`,
        "",
        merged.changes.length > 0
          ? `Added deps: ${merged.changes.map((c) => c.name).join(", ")}`
          : "Added deps: none",
        merged.changes.length > 0 && !noInstall
          ? "Dependencies installed."
          : merged.changes.length > 0 && noInstall
            ? "Dependencies not installed (skipped)."
            : "",
        ...wiringSnippet,
      ]
        .filter(Boolean)
        .join("\n")
    );

    return;
  }

  if (kind === "connector") {
    const connector = name as ConnectorName | undefined;
    if (!connector || !availableConnectors.has(connector)) {
      outro(
        `Unknown connector: ${name}\n\nAvailable connectors: ${Array.from(availableConnectors).join(", ")}`
      );
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
      if (!noInstall) {
        await installDependencies(root);
      }
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
        merged.changes.length > 0 && !noInstall
          ? "Dependencies installed."
          : merged.changes.length > 0 && noInstall
            ? "Dependencies not installed (skipped)."
            : "",
        nonInteractive
          ? ""
          : connector === "notion"
            ? "Tip: keep NOTION_TOKEN server-side only (env var)."
            : connector === "google-drive"
              ? "Tip: keep Google OAuth refresh tokens and service account keys server-side only."
              : "",
      ]
        .filter(Boolean)
        .join("\n")
    );

    return;
  }

  // Extractors
  const extractor = name as ExtractorName | undefined;
  if (!extractor || !availableExtractors.has(extractor)) {
    outro(
      `Unknown extractor: ${name}\n\nAvailable extractors: ${Array.from(availableExtractors).join(", ")}`
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
    if (!noInstall) {
      await installDependencies(root);
    }
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
      merged.changes.length > 0 && !noInstall
        ? "Dependencies installed."
        : merged.changes.length > 0 && noInstall
          ? "Dependencies not installed (skipped)."
          : "",
      "",
      `Next: import the extractor and pass it to createContextEngine({ extractors: [...] }).`,
    ]
      .filter(Boolean)
      .join("\n")
  );
}


