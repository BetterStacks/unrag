export const EVAL_SAMPLE_DATASET_V1 = {
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
} as const;

export const EVAL_CONFIG_DEFAULT = {
  thresholds: { min: { recallAtK: 0.75 } },
  cleanup: "none",
  ingest: true,
} as const;

export const EVAL_PACKAGE_JSON_SCRIPTS: Record<string, string> = {
  "unrag:eval": `bun run scripts/unrag-eval.ts -- --dataset .unrag/eval/datasets/sample.json`,
  "unrag:eval:ci": `bun run scripts/unrag-eval.ts -- --dataset .unrag/eval/datasets/sample.json --ci`,
} as const;

export function renderEvalRunnerScript(opts: { installDir: string }): string {
  const installImportBase = `../${opts.installDir.replace(/\\/g, "/")}`;

  return `/**
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
    try {
      const raw = await readFile(abs, "utf8");
      for (const line of raw.split(/\\r?\\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
        if (!key) continue;
        if (process.env[key] == null) process.env[key] = value;
      }
    } catch {
      // ignore
    }
  }
}

function parseThresholdExpr(expr: string): Partial<EvalThresholds> {
  // Accept both:
  // - "min.recallAtK=0.75"
  // - "recallAtK=0.75" (shorthand for min)
  const [lhsRaw, rhsRaw] = String(expr ?? "").split("=");
  const lhs = (lhsRaw ?? "").trim();
  const rhs = Number(String(rhsRaw ?? "").trim());
  if (!lhs || Number.isNaN(rhs)) return {};

  const parts = lhs.split(".").map((p) => p.trim()).filter(Boolean);
  const level = parts.length === 2 ? parts[0] : "min";
  const metric = parts.length === 2 ? parts[1] : parts[0];
  if (level !== "min") return {};

  const allowed = new Set(["hitAtK", "precisionAtK", "recallAtK", "mrrAtK", "ndcgAtK"]);
  if (!allowed.has(metric)) return {};
  return { min: { [metric]: rhs } } as any;
}

function mergeThresholds(
  a: Partial<EvalThresholds> | undefined,
  b: Partial<EvalThresholds> | undefined
): Partial<EvalThresholds> | undefined {
  if (!a && !b) return undefined;
  const out: any = { ...(a ?? {}) };
  if (b?.min) out.min = { ...(out.min ?? {}), ...(b.min as any) };
  return out;
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

  const mode = sanitizeMode(cli.mode ?? cfg?.mode) ?? undefined;
  const cleanup = sanitizeCleanup(cli.cleanup ?? cfg?.cleanup) ?? undefined;

  const result = await runEval({
    engine,
    datasetPath,
    mode,
    topK: typeof cli.topK === "number" ? cli.topK : undefined,
    rerankTopK: typeof cli.rerankTopK === "number" ? cli.rerankTopK : undefined,
    scopePrefix: typeof cli.scopePrefix === "string" ? cli.scopePrefix : undefined,
    ingest: typeof cli.ingest === "boolean" ? cli.ingest : (typeof cfg?.ingest === "boolean" ? cfg.ingest : undefined),
    cleanup,
    thresholds: mergeThresholds(cfg?.thresholds, cli.thresholds),
    ci: Boolean(cli.ci),
    allowAssets: Boolean(cli.allowAssets),
    allowNonEvalPrefix: Boolean(cli.allowNonEvalPrefix),
    yes: Boolean(cli.yes),
    includeNdcg: Boolean(cli.includeNdcg),
  });

  const outputDir = cli.outputDir ?? cfg?.outputDir ?? result.outputDir;

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
}

