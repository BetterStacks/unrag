import { cancel, confirm, isCancel, outro, select, text } from "@clack/prompts";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, exists, findUp, tryFindProjectRoot } from "@cli/lib/fs";
import { readJsonFile, writeJsonFile } from "@cli/lib/json";
import { readRegistryManifest } from "@cli/lib/manifest";
import { copyBatteryFiles, copyConnectorFiles, copyExtractorFiles } from "@cli/lib/registry";
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
} from "@cli/lib/packageJson";
import { docsUrl } from "@cli/lib/constants";

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

type PackageJsonWithScripts = Awaited<ReturnType<typeof readPackageJson>> & {
  scripts?: Record<string, string>;
};

const writeTextFile = async (absPath: string, content: string) => {
  await ensureDir(path.dirname(absPath));
  await writeFile(absPath, content, "utf8");
};

const shouldWriteFile = async (
  absPath: string,
  projectRoot: string,
  nonInteractive: boolean
): Promise<boolean> => {
  if (!(await exists(absPath))) return true;
  if (nonInteractive) return false;
  const answer = await confirm({
    message: `Overwrite ${path.relative(projectRoot, absPath)}?`,
    initialValue: false,
  });
  if (isCancel(answer)) {
    cancel("Cancelled.");
    return false;
  }
  return Boolean(answer);
};

const addPackageJsonScripts = async (args: {
  projectRoot: string;
  pkg: PackageJsonWithScripts;
  scripts: Record<string, string>;
  nonInteractive: boolean;
}): Promise<{ added: string[]; kept: string[] }> => {
  const existing = args.pkg.scripts ?? {};
  const desired = args.scripts;
  const conflicting = Object.keys(desired).filter((k) => k in existing);

  const toAdd: Record<string, string> = { ...desired };

  if (conflicting.length > 0 && args.nonInteractive) {
    // In non-interactive mode, keep existing scripts (non-destructive).
    for (const k of conflicting) delete toAdd[k];
  }

  if (conflicting.length > 0 && !args.nonInteractive) {
    for (const scriptName of conflicting) {
      const action = await select({
        message: `Script "${scriptName}" already exists. What would you like to do?`,
        options: [
          { value: "keep", label: "Keep existing", hint: existing[scriptName] },
          { value: "overwrite", label: "Overwrite", hint: desired[scriptName] },
          { value: "rename", label: "Add with different name", hint: `${scriptName}:new` },
        ],
        initialValue: "keep",
      });
      if (isCancel(action)) {
        cancel("Cancelled.");
        return { added: [], kept: Object.keys(desired) };
      }

      if (action === "keep") {
        delete toAdd[scriptName];
        continue;
      }

      if (action === "rename") {
        const newName = await text({
          message: `New script name for ${scriptName}`,
          initialValue: `${scriptName}:new`,
          validate: (v) => {
            const s = String(v).trim();
            if (!s) return "Script name is required";
            if (s in existing || s in toAdd) return "Script name already exists";
            return;
          },
        });
        if (isCancel(newName)) {
          cancel("Cancelled.");
          return { added: [], kept: Object.keys(desired) };
        }
        const nextName = String(newName).trim();
        const value = toAdd[scriptName]!;
        delete toAdd[scriptName];
        toAdd[nextName] = value;
      }
      // For "overwrite", keep it in toAdd with the original name.
    }
  }

  const added = Object.keys(toAdd);
  if (added.length > 0) {
    args.pkg.scripts = { ...existing, ...toAdd };
    await writePackageJson(args.projectRoot, args.pkg);
  }

  const kept = conflicting.filter((k) => !(k in toAdd));
  return { added, kept };
};

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

  const pkg = (await readPackageJson(root)) as PackageJsonWithScripts;

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

    // Battery-specific scaffolding
    if (battery === "eval") {
      const datasetAbs = path.join(root, ".unrag/eval/datasets/sample.json");
      const configAbs = path.join(root, ".unrag/eval/config.json");
      const scriptAbs = path.join(root, "scripts/unrag-eval.ts");

      const sampleDataset = {
        version: "1",
        id: "sample",
        description: "Tiny dataset to validate retrieval changes.",
        defaults: {
          topK: 10,
          scopePrefix: "eval:sample:",
          mode: "retrieve",
          thresholds: { min: { recallAtK: 0.75 } },
        },
        documents: [
          {
            sourceId: "eval:sample:doc:refund-policy",
            content: "Refunds are available within 30 days of purchase, provided you have a receipt.",
          },
          {
            sourceId: "eval:sample:doc:contact-support",
            content: "Contact support by emailing support@example.com. Response times are typically under 24 hours.",
          },
        ],
        queries: [
          {
            id: "q_refund_window",
            query: "How long do I have to request a refund?",
            relevant: { sourceIds: ["eval:sample:doc:refund-policy"] },
          },
          {
            id: "q_contact_support",
            query: "How do I contact support?",
            relevant: { sourceIds: ["eval:sample:doc:contact-support"] },
          },
        ],
      };

      const evalConfig = {
        thresholds: { min: { recallAtK: 0.75 } },
        cleanup: "none",
        ingest: true,
      };

      const installImportBase = `../${config.installDir.replace(/\\/g, "/")}`;
      const script = `/**
 * Unrag eval runner entrypoint (generated).
 *
 * You own this file — customize it freely.
 */

import path from "node:path";
import { access, readFile } from "node:fs/promises";

import { createUnragEngine } from "../unrag.config";
import {
  runEval,
  readEvalReportFromFile,
  writeEvalReport,
  writeEvalSummaryMd,
  diffEvalReports,
  writeEvalDiffJson,
  writeEvalDiffMd,
  type EvalMode,
  type EvalThresholds,
  type EvalCleanupPolicy,
} from "${installImportBase}/eval";

type CliArgs = {
  dataset?: string;
  baseline?: string;
  outputDir?: string;
  mode?: EvalMode;
  topK?: number;
  rerankTopK?: number;
  scopePrefix?: string;
  ingest?: boolean;
  cleanup?: EvalCleanupPolicy;
  thresholds?: Partial<EvalThresholds>;
  ci?: boolean;
  allowAssets?: boolean;
  allowNonEvalPrefix?: boolean;
  yes?: boolean;
  includeNdcg?: boolean;
};

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadEnvFilesBestEffort(projectRoot: string) {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const candidates = [
    ".env",
    ".env.local",
    \`.env.\${nodeEnv}\`,
    \`.env.\${nodeEnv}.local\`,
  ];
  for (const rel of candidates) {
    const abs = path.join(projectRoot, rel);
    if (!(await fileExists(abs))) continue;
    const raw = await readFile(abs, "utf8").catch(() => "");
    for (const line of raw.split(/\\r?\\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq < 0) continue;
      const key = s.slice(0, eq).trim();
      const value = s.slice(eq + 1).trim().replace(/^"|"$/g, "");
      if (!key) continue;
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function parseThresholdExpr(expr: string): Partial<EvalThresholds> {
  const s = String(expr ?? "").trim();
  const eq = s.indexOf("=");
  if (eq < 0) throw new Error(\`Invalid --threshold: "\${s}" (expected key=value)\`);
  const key = s.slice(0, eq).trim();
  const value = Number(s.slice(eq + 1).trim());
  if (!Number.isFinite(value)) throw new Error(\`Invalid --threshold value: "\${s}"\`);

  const out: Partial<EvalThresholds> = {};
  if (key === "min.hitAtK") out.min = { hitAtK: value };
  else if (key === "min.recallAtK") out.min = { recallAtK: value };
  else if (key === "min.mrrAtK") out.min = { mrrAtK: value };
  else if (key === "max.p95TotalMs") out.max = { p95TotalMs: value };
  else throw new Error(\`Unknown threshold key: "\${key}"\`);
  return out;
}

function mergeThresholds(a: Partial<EvalThresholds>, b: Partial<EvalThresholds>): Partial<EvalThresholds> {
  return {
    min: { ...(a.min ?? {}), ...(b.min ?? {}) },
    max: { ...(a.max ?? {}), ...(b.max ?? {}) },
  };
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  const thresholds: Partial<EvalThresholds>[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dataset") out.dataset = argv[++i];
    else if (a === "--baseline") out.baseline = argv[++i];
    else if (a === "--outputDir" || a === "--output-dir") out.outputDir = argv[++i];
    else if (a === "--mode") out.mode = argv[++i] as EvalMode;
    else if (a === "--topK" || a === "--top-k") out.topK = Number(argv[++i]);
    else if (a === "--rerankTopK" || a === "--rerank-top-k") out.rerankTopK = Number(argv[++i]);
    else if (a === "--scopePrefix" || a === "--scope-prefix") out.scopePrefix = argv[++i];
    else if (a === "--no-ingest") out.ingest = false;
    else if (a === "--cleanup") out.cleanup = argv[++i] as EvalCleanupPolicy;
    else if (a === "--threshold") thresholds.push(parseThresholdExpr(argv[++i] ?? ""));
    else if (a === "--ci") out.ci = true;
    else if (a === "--allow-assets") out.allowAssets = true;
    else if (a === "--allow-non-eval-prefix" || a === "--allow-custom-prefix") out.allowNonEvalPrefix = true;
    else if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--include-ndcg") out.includeNdcg = true;
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  for (const t of thresholds) out.thresholds = mergeThresholds(out.thresholds ?? {}, t);
  return out;
}

function printHelp() {
  console.log(
    [
      "unrag-eval — retrieval eval harness",
      "",
      "Usage:",
      "  bun run scripts/unrag-eval.ts -- --dataset .unrag/eval/datasets/sample.json",
      "",
      "Options:",
      "  --dataset <path>                 Dataset JSON path (required)",
      "  --baseline <report.json>         Baseline report for diffing",
      "  --output-dir <dir>               Output dir (default: .unrag/eval/runs/<ts>-<datasetId>)",
      "  --mode retrieve|retrieve+rerank   Override mode",
      "  --top-k <n>                      Override topK",
      "  --rerank-top-k <n>               In rerank mode, retrieve N candidates before reranking (default: topK*3)",
      "  --scope-prefix <prefix>          Override scopePrefix",
      "  --no-ingest                       Skip dataset document ingest",
      "  --cleanup none|on-success|always  Cleanup policy when ingesting",
      "  --threshold <k=v>                 Repeatable thresholds (e.g. min.recallAtK=0.75)",
      "  --ci                              CI mode (non-interactive)",
      "  --yes, -y                         Allow dangerous operations when explicitly enabled",
      "  --allow-assets                    Allow documents[].assets ingestion (advanced)",
      "  --allow-custom-prefix             Allow scopePrefix outside eval:* (dangerous)",
      "  --include-ndcg                    Compute nDCG@k (optional)",
    ].join("\\n")
  );
}

async function readConfigFile(projectRoot: string): Promise<any | null> {
  const abs = path.join(projectRoot, ".unrag/eval/config.json");
  if (!(await fileExists(abs))) return null;
  const raw = await readFile(abs, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(\`Failed to parse .unrag/eval/config.json: \${msg}\`);
  }
}

function sanitizeMode(v: any): EvalMode | undefined {
  if (v === "retrieve" || v === "retrieve+rerank") return v;
  return undefined;
}

function sanitizeCleanup(v: any): EvalCleanupPolicy | undefined {
  if (v === "none" || v === "on-success" || v === "always") return v;
  return undefined;
}

async function main() {
  const projectRoot = path.join(process.cwd());
  await loadEnvFilesBestEffort(projectRoot);

  const cli = parseArgs(process.argv.slice(2));
  const cfg = await readConfigFile(projectRoot);

  const datasetPath = cli.dataset ?? cfg?.dataset ?? ".unrag/eval/datasets/sample.json";
  if (!datasetPath) throw new Error("--dataset is required");

  const engine = createUnragEngine();

  const thresholds: Partial<EvalThresholds> = mergeThresholds(cfg?.thresholds ?? {}, cli.thresholds ?? {});

  const result = await runEval({
    engine,
    datasetPath,
    mode: cli.mode ?? sanitizeMode(cfg?.mode),
    topK: cli.topK ?? (typeof cfg?.topK === "number" ? cfg.topK : undefined),
    rerankTopK: cli.rerankTopK ?? (typeof cfg?.rerankTopK === "number" ? cfg.rerankTopK : undefined),
    scopePrefix: cli.scopePrefix ?? (typeof cfg?.scopePrefix === "string" ? cfg.scopePrefix : undefined),
    ingest: cli.ingest ?? (typeof cfg?.ingest === "boolean" ? cfg.ingest : undefined),
    cleanup: cli.cleanup ?? sanitizeCleanup(cfg?.cleanup) ?? "none",
    includeNdcg: cli.includeNdcg ?? Boolean(cfg?.includeNdcg),
    allowAssets: cli.allowAssets ?? Boolean(cfg?.allowAssets),
    allowNonEvalPrefix: cli.allowNonEvalPrefix ?? Boolean(cfg?.allowNonEvalPrefix),
    confirmedDangerousDelete: Boolean(cli.yes),
    thresholds,
  });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir =
    cli.outputDir ??
    cfg?.outputDir ??
    path.join(".unrag/eval/runs", \`\${ts}-\${result.report.dataset.id}\`);

  const reportPath = await writeEvalReport(outputDir, result.report);
  const summaryPath = await writeEvalSummaryMd(outputDir, result.report);

  let diffPaths: { json: string; md: string } | null = null;
  const baselinePath = cli.baseline ?? cfg?.baseline;
  if (baselinePath) {
    const baseline = await readEvalReportFromFile(baselinePath);
    const diff = diffEvalReports({ baseline, candidate: result.report, baselinePath, candidatePath: reportPath });
    const diffJson = await writeEvalDiffJson(outputDir, diff);
    const diffMd = await writeEvalDiffMd(outputDir, diff);
    diffPaths = { json: diffJson, md: diffMd };
  }

  console.log(
    [
      \`[unrag:eval] Wrote report: \${reportPath}\`,
      \`[unrag:eval] Wrote summary: \${summaryPath}\`,
      diffPaths ? \`[unrag:eval] Wrote diff: \${diffPaths.json} (+ \${diffPaths.md})\` : "",
      result.thresholdFailures.length > 0
        ? \`[unrag:eval] Threshold failures:\\n- \${result.thresholdFailures.join("\\n- ")}\`
        : \`[unrag:eval] Thresholds: pass\`,
    ]
      .filter(Boolean)
      .join("\\n")
  );

  process.exitCode = result.exitCode;
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(\`[unrag:eval] Error: \${msg}\`);
  process.exitCode = 2;
});
`;

      if (await shouldWriteFile(datasetAbs, root, nonInteractive)) {
        await writeTextFile(datasetAbs, JSON.stringify(sampleDataset, null, 2) + "\n");
      }
      if (await shouldWriteFile(configAbs, root, nonInteractive)) {
        await writeTextFile(configAbs, JSON.stringify(evalConfig, null, 2) + "\n");
      }
      if (await shouldWriteFile(scriptAbs, root, nonInteractive)) {
        await writeTextFile(scriptAbs, script);
      }

      const scriptsToAdd: Record<string, string> = {
        "unrag:eval": `bun run scripts/unrag-eval.ts -- --dataset .unrag/eval/datasets/sample.json`,
        "unrag:eval:ci": `bun run scripts/unrag-eval.ts -- --dataset .unrag/eval/datasets/sample.json --ci`,
      };

      const scriptsResult = await addPackageJsonScripts({
        projectRoot: root,
        pkg,
        scripts: scriptsToAdd,
        nonInteractive,
      });

      outro(
        [
          `Installed battery: ${battery}.`,
          "",
          `- Code: ${path.join(config.installDir, "eval")}`,
          "",
          `- Dataset: ${path.relative(root, datasetAbs)}`,
          `- Script: ${path.relative(root, scriptAbs)}`,
          "",
          scriptsResult.added.length > 0
            ? `Added scripts: ${scriptsResult.added.join(", ")}`
            : "Added scripts: none",
          scriptsResult.kept.length > 0 ? `Kept existing scripts: ${scriptsResult.kept.join(", ")}` : "",
          "",
          "Next:",
          "  bun run unrag:eval",
          "  bun run unrag:eval:ci",
        ]
          .filter(Boolean)
          .join("\n")
      );

      return;
    }

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


