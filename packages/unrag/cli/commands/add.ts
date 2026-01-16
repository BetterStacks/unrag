import { cancel, confirm, isCancel, outro, select, text } from "@clack/prompts";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, exists, findUp, tryFindProjectRoot } from "../lib/fs";
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

type PackageJsonWithScripts = Awaited<ReturnType<typeof readPackageJson>> & {
  scripts?: Record<string, string>;
};

const writeTextFile = async (absPath: string, content: string) => {
  await ensureDir(path.dirname(absPath));
  await writeFile(absPath, content, "utf8");
};

const renderObjectLiteral = (value: Record<string, any>, indent: number): string => {
  const pad = " ".repeat(indent);
  const inner = Object.entries(value)
    .map(([key, val]) => {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        return `${pad}${key}: ${renderObjectLiteral(val, indent + 2)},`;
      }
      return `${pad}${key}: ${JSON.stringify(val)},`;
    })
    .join("\n");

  return `{\n${inner}\n${" ".repeat(Math.max(0, indent - 2))}}`;
};

// Map extractor id to factory function name (matches registry.ts)
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

// Map extractor id to flag keys (matches registry.ts)
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

/**
 * Patch unrag.config.ts to add extractor import, registration, and enable flags.
 * Returns true if the file was modified, false if already patched or if patching failed.
 */
async function patchUnragConfig(args: {
  projectRoot: string;
  installDir: string;
  extractor: ExtractorName;
  extractors: ExtractorName[];
}): Promise<boolean> {
  const configPath = path.join(args.projectRoot, "unrag.config.ts");
  
  if (!(await exists(configPath))) {
    // Config file doesn't exist - user might need to run init first
    return false;
  }

  try {
    const content = await readFile(configPath, "utf8");
    const factoryName = EXTRACTOR_FACTORY[args.extractor];
    const allFlagKeys = args.extractors.flatMap(
      (ex) => EXTRACTOR_FLAG_KEYS[ex] ?? []
    );
    const installImportBase = `./${args.installDir.replace(/\\/g, "/")}`;
    const importLine = `import { ${factoryName} } from "${installImportBase}/extractors/${args.extractor}";`;
    const extractorCall = `${factoryName}()`;

    let modified = false;
    let newContent = content;

    // 1. Add import if not present
    if (
      importLine &&
      !content.includes(importLine) &&
      !content.includes(`from "${installImportBase}/extractors/${args.extractor}"`)
    ) {
      // Find the imports section (after __UNRAG_IMPORTS__ marker or after existing imports)
      const importMarker = "// __UNRAG_IMPORTS__";
      if (content.includes(importMarker)) {
        // Insert after the marker
        newContent = newContent.replace(
          importMarker,
          `${importMarker}\n${importLine}`
        );
      } else {
        // Try to find where imports end (before "export const unrag")
        const exportMatch = newContent.match(/^(import .+?\n)+/m);
        if (exportMatch) {
          newContent = newContent.replace(
            exportMatch[0],
            exportMatch[0] + importLine + "\n"
          );
        } else {
          // Fallback: add at the top after @ts-nocheck
          newContent = newContent.replace(
            /\/\/ @ts-nocheck\n/,
            `// @ts-nocheck\n\n${importLine}\n`
          );
        }
      }
      modified = true;
    }

    // 2. Add extractor to extractors array if not present
    const extractorArrayMarker = "// __UNRAG_EXTRACTORS__";
    if (newContent.includes(extractorArrayMarker)) {
      // Replace the marker with the extractor call
      if (extractorCall) {
        newContent = newContent.replace(
          extractorArrayMarker,
          `      ${extractorCall},`
        );
      }
      modified = true;
    } else if (extractorCall && !newContent.includes(extractorCall)) {
      // Try to find the extractors array and add to it
      const extractorsArrayRegex = /extractors:\s*\[([^\]]*)\]/s;
      const match = newContent.match(extractorsArrayRegex);
      if (match) {
        const existing = match[1].trim();
        const newArrayContent = existing
          ? `${existing}\n      ${extractorCall},`
          : `      ${extractorCall},`;
        newContent = newContent.replace(
          extractorsArrayRegex,
          `extractors: [\n${newArrayContent}\n    ]`
        );
        modified = true;
      }
    }

    // 3. Add/merge minimal assetProcessing override
    if (allFlagKeys.length > 0) {
      const minimalOverrides: Record<string, any> = {};

      for (const flagKey of allFlagKeys) {
        // Map short flag keys to nested paths
        if (flagKey === "pdf_textLayer") {
          minimalOverrides.pdf = minimalOverrides.pdf || {};
          minimalOverrides.pdf.textLayer = { enabled: true };
        } else if (flagKey === "pdf_llmExtraction") {
          minimalOverrides.pdf = minimalOverrides.pdf || {};
          minimalOverrides.pdf.llmExtraction = { enabled: true };
        } else if (flagKey === "pdf_ocr") {
          minimalOverrides.pdf = minimalOverrides.pdf || {};
          minimalOverrides.pdf.ocr = { enabled: true };
        } else if (flagKey === "image_ocr") {
          minimalOverrides.image = minimalOverrides.image || {};
          minimalOverrides.image.ocr = { enabled: true };
        } else if (flagKey === "image_captionLlm") {
          minimalOverrides.image = minimalOverrides.image || {};
          minimalOverrides.image.captionLlm = { enabled: true };
        } else if (flagKey === "audio_transcription") {
          minimalOverrides.audio = minimalOverrides.audio || {};
          minimalOverrides.audio.transcription = { enabled: true };
        } else if (flagKey === "video_transcription") {
          minimalOverrides.video = minimalOverrides.video || {};
          minimalOverrides.video.transcription = { enabled: true };
        } else if (flagKey === "video_frames") {
          minimalOverrides.video = minimalOverrides.video || {};
          minimalOverrides.video.frames = { enabled: true };
        } else if (flagKey === "file_text") {
          minimalOverrides.file = minimalOverrides.file || {};
          minimalOverrides.file.text = { enabled: true };
        } else if (flagKey === "file_docx") {
          minimalOverrides.file = minimalOverrides.file || {};
          minimalOverrides.file.docx = { enabled: true };
        } else if (flagKey === "file_pptx") {
          minimalOverrides.file = minimalOverrides.file || {};
          minimalOverrides.file.pptx = { enabled: true };
        } else if (flagKey === "file_xlsx") {
          minimalOverrides.file = minimalOverrides.file || {};
          minimalOverrides.file.xlsx = { enabled: true };
        }
      }

      if (Object.keys(minimalOverrides).length > 0) {
        const body = renderObjectLiteral(minimalOverrides, 4);
        const bodyLines = body.split("\n");
        bodyLines.splice(
          bodyLines.length - 1,
          0,
          "    // __UNRAG_ASSET_PROCESSING_OVERRIDES__"
        );
        const bodyWithMarker = bodyLines.join("\n");
        const assetProcessingBlock = `  assetProcessing: ${bodyWithMarker},\n`;

        const assetProcessingMarker = "// __UNRAG_ASSET_PROCESSING_OVERRIDES__";
        const autoBlockRegex =
          /assetProcessing:\s*\{[\s\S]*?\/\/ __UNRAG_ASSET_PROCESSING_OVERRIDES__\s*\n\s*\},/;

        if (autoBlockRegex.test(newContent)) {
          // Replace the auto-managed block with the refreshed minimal overrides
          newContent = newContent.replace(
            autoBlockRegex,
            assetProcessingBlock.trimEnd()
          );
          modified = true;
        } else if (newContent.includes(assetProcessingMarker)) {
          // Marker exists (fresh minimal install) - replace it
          newContent = newContent.replace(
            assetProcessingMarker,
            assetProcessingBlock.trimEnd()
          );
          modified = true;
        } else {
          // Neither marker nor auto-managed block exists - insert if no assetProcessing
          const existingAssetProcessingMatch = newContent.match(
            /assetProcessing:\s*\{[\s\S]*?\n\s*\}/s
          );
          if (!existingAssetProcessingMatch) {
            // Insert after extractors array
            const extractorsArrayEnd = newContent.lastIndexOf("    ],");
            if (extractorsArrayEnd > 0) {
              newContent =
                newContent.slice(0, extractorsArrayEnd + 5) +
                "\n" +
                assetProcessingBlock.trimEnd() +
                newContent.slice(extractorsArrayEnd + 5);
              modified = true;
            } else {
              // Fallback: find engine closing brace
              const engineClosingBrace = newContent.lastIndexOf("  },");
              if (engineClosingBrace > 0) {
                newContent =
                  newContent.slice(0, engineClosingBrace) +
                  assetProcessingBlock +
                  newContent.slice(engineClosingBrace);
                modified = true;
              }
            }
          }
        }
      }
    }

    if (modified) {
      await writeFile(configPath, newContent, "utf8");
      return true;
    }

    return false;
  } catch (err) {
    // Fail soft - don't block extractor installation if config patching fails
    console.warn(
      `[unrag:add] Could not patch unrag.config.ts: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

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
      aliasBase: config.aliasBase ?? "@unrag",
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

      const aliasBase = String(config.aliasBase ?? "").trim() || "@unrag";
      const script = `/**
 * Unrag eval runner entrypoint (generated).
 *
 * You own this file — customize it freely.
 */

import path from "node:path";
import { access, readFile } from "node:fs/promises";

import { createUnragEngine } from "${aliasBase}/config";
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
} from "${aliasBase}/eval";

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

    // Debug battery scaffolding
    if (battery === "debug") {
      const configAbs = path.join(root, ".unrag/debug/config.json");

      const debugConfig = {
        port: 3847,
        host: "localhost",
      };

      if (await shouldWriteFile(configAbs, root, nonInteractive)) {
        await writeTextFile(configAbs, JSON.stringify(debugConfig, null, 2) + "\n");
      }

      const scriptsToAdd: Record<string, string> = {
        "unrag:debug": "bunx unrag debug",
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
          `- Code: ${path.join(config.installDir, "debug")}`,
          `- Config: .unrag/debug/config.json`,
          "",
          merged.changes.length > 0
            ? `Added deps: ${merged.changes.map((c) => c.name).join(", ")}`
            : "Added deps: none",
          merged.changes.length > 0 && !noInstall
            ? "Dependencies installed."
            : merged.changes.length > 0 && noInstall
              ? "Dependencies not installed (skipped)."
              : "",
          scriptsResult.added.length > 0
            ? `Added scripts: ${scriptsResult.added.join(", ")}`
            : "Added scripts: none",
          scriptsResult.kept.length > 0 ? `Kept existing scripts: ${scriptsResult.kept.join(", ")}` : "",
          "",
          "Usage:",
          "  1. Set UNRAG_DEBUG=true in your app's environment",
          "  2. Run your app (debug server auto-starts on port 3847)",
          "  3. In another terminal: bun run unrag:debug",
          "",
          "The debug panel will connect to your app and show live events for:",
          "  - Ingest operations (chunking, embedding, storage)",
          "  - Retrieve operations (embedding, database queries)",
          "  - Rerank operations (scoring, reordering)",
          "  - Delete operations",
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
      aliasBase: config.aliasBase ?? "@unrag",
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
    aliasBase: config.aliasBase ?? "@unrag",
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

  // Patch unrag.config.ts to wire the extractor
  const configPatched = await patchUnragConfig({
    projectRoot: root,
    installDir: config.installDir,
    extractor,
    extractors,
  });

  outro(
    [
      `Installed extractor: ${extractor}.`,
      "",
      `- Code: ${path.join(config.installDir, "extractors", extractor)}`,
      configPatched
        ? `- Config: updated unrag.config.ts (imported, registered, and enabled)`
        : `- Config: unrag.config.ts not found or could not be patched automatically`,
      "",
      merged.changes.length > 0
        ? `Added deps: ${merged.changes.map((c) => c.name).join(", ")}`
        : "Added deps: none",
      merged.changes.length > 0 && !noInstall
        ? "Dependencies installed."
        : merged.changes.length > 0 && noInstall
          ? "Dependencies not installed (skipped)."
          : "",
      !configPatched
        ? "\nNext: import the extractor and add it to engine.extractors in unrag.config.ts"
        : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
}


