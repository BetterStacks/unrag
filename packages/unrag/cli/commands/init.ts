import {
  cancel,
  confirm,
  groupMultiselect,
  isCancel,
  outro,
  select,
  text,
} from "@clack/prompts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyExtractorFiles,
  copyRegistryFiles,
  type RegistrySelection,
} from "../lib/registry";
import { readJsonFile, writeJsonFile } from "../lib/json";
import { findUp, normalizePosixPath, tryFindProjectRoot } from "../lib/fs";
import {
  depsForAdapter,
  depsForExtractor,
  detectPackageManager,
  installCmd,
  mergeDeps,
  readPackageJson,
  type ExtractorName,
  writePackageJson,
} from "../lib/packageJson";
import { patchTsconfigPaths } from "../lib/tsconfig";

type InitConfig = {
  installDir: string;
  storeAdapter: "drizzle" | "prisma" | "raw-sql";
  aliasBase?: string;
  version: number;
  connectors?: string[];
  extractors?: string[];
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
  richMedia?: boolean;
  extractors?: string[];
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
    if (a === "--rich-media") {
      out.richMedia = true;
      continue;
    }
    if (a === "--no-rich-media") {
      out.richMedia = false;
      continue;
    }
    if (a === "--extractors") {
      const v = args[i + 1];
      if (v) {
        out.extractors = v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        i++;
      }
      continue;
    }
  }

  return out;
};

const DEFAULT_RICH_MEDIA_EXTRACTORS: ExtractorName[] = ["pdf-text-layer", "file-text"];

const EXTRACTOR_OPTIONS: Array<{
  group: string;
  value: ExtractorName;
  label: string;
  hint?: string;
}> = [
  // PDF
  {
    group: "PDF",
    value: "pdf-text-layer",
    label: `pdf-text-layer (Fast/cheap extraction via PDF text layer)`,
    hint: "recommended",
  },
  {
    group: "PDF",
    value: "pdf-llm",
    label: `pdf-llm (LLM-based PDF extraction; higher cost)`,
  },
  {
    group: "PDF",
    value: "pdf-ocr",
    label: `pdf-ocr (OCR scanned PDFs; requires native binaries)`,
    hint: "worker-only",
  },

  // Image
  {
    group: "Image",
    value: "image-ocr",
    label: `image-ocr (Extract text from images via vision LLM)`,
  },
  {
    group: "Image",
    value: "image-caption-llm",
    label: `image-caption-llm (Generate captions for images via vision LLM)`,
  },

  // Audio
  {
    group: "Audio",
    value: "audio-transcribe",
    label: `audio-transcribe (Speech-to-text transcription)`,
  },

  // Video
  {
    group: "Video",
    value: "video-transcribe",
    label: `video-transcribe (Transcribe video audio track)`,
  },
  {
    group: "Video",
    value: "video-frames",
    label: `video-frames (Sample frames + analyze via vision LLM; requires ffmpeg)`,
    hint: "worker-only",
  },

  // Files
  {
    group: "Files",
    value: "file-text",
    label: `file-text (Extract text/markdown/json/html from common text files)`,
    hint: "recommended",
  },
  {
    group: "Files",
    value: "file-docx",
    label: `file-docx (Extract text from .docx files)`,
  },
  {
    group: "Files",
    value: "file-pptx",
    label: `file-pptx (Extract text from .pptx slides)`,
  },
  {
    group: "Files",
    value: "file-xlsx",
    label: `file-xlsx (Extract tables from .xlsx spreadsheets)`,
  },
];

const AVAILABLE_EXTRACTORS = new Set<ExtractorName>(
  EXTRACTOR_OPTIONS.map((o) => o.value)
);

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

  if (parsed.richMedia === false && (parsed.extractors ?? []).length > 0) {
    throw new Error('Cannot use "--no-rich-media" together with "--extractors".');
  }

  const extractorsFromArgs = (parsed.extractors ?? [])
    .filter((x): x is ExtractorName => AVAILABLE_EXTRACTORS.has(x as ExtractorName))
    .sort();

  const richMediaAnswer =
    extractorsFromArgs.length > 0
      ? true
      : typeof parsed.richMedia === "boolean"
        ? parsed.richMedia
        : nonInteractive
          ? false
          : await confirm({
              message:
                'Enable rich media ingestion (PDF/images/audio/video/files)? This also enables multimodal image embeddings (you can change this later).',
              initialValue: false,
            });
  if (isCancel(richMediaAnswer)) {
    cancel("Cancelled.");
    return;
  }
  const richMediaEnabled = Boolean(richMediaAnswer);

  const selectedExtractorsAnswer =
    richMediaEnabled || extractorsFromArgs.length > 0
      ? nonInteractive
        ? (extractorsFromArgs.length > 0
            ? extractorsFromArgs
            : DEFAULT_RICH_MEDIA_EXTRACTORS) // default preset
        : await groupMultiselect<ExtractorName>({
            message: "Select extractors to enable (space to toggle, enter to confirm)",
            options: EXTRACTOR_OPTIONS.reduce<Record<string, any[]>>((acc, opt) => {
              acc[opt.group] ??= [];
              acc[opt.group]!.push({
                value: opt.value,
                label: opt.label,
                ...(opt.hint ? { hint: opt.hint } : {}),
              });
              return acc;
            }, {}),
            initialValues:
              extractorsFromArgs.length > 0
                ? extractorsFromArgs
                : DEFAULT_RICH_MEDIA_EXTRACTORS,
            required: false,
          })
      : [];

  if (isCancel(selectedExtractorsAnswer)) {
    cancel("Cancelled.");
    return;
  }

  const selectedExtractors = Array.from(
    new Set(
      (Array.isArray(selectedExtractorsAnswer)
        ? selectedExtractorsAnswer
        : []) as ExtractorName[]
    )
  ).sort();

  const selection: RegistrySelection = {
    installDir,
    storeAdapter: storeAdapterAnswer as RegistrySelection["storeAdapter"],
    projectRoot: root,
    registryRoot,
    aliasBase,
    richMedia: richMediaEnabled
      ? {
          enabled: true,
          extractors: selectedExtractors,
        }
      : { enabled: false, extractors: [] },
  };

  await copyRegistryFiles(selection);

  // Install selected extractor modules (vendor code) before updating deps.
  if (richMediaEnabled && selectedExtractors.length > 0) {
    for (const extractor of selectedExtractors) {
      await copyExtractorFiles({
        projectRoot: root,
        registryRoot,
        installDir,
        extractor,
        yes: nonInteractive,
      });
    }
  }

  const pkg = await readPackageJson(root);
  const { deps, devDeps } = depsForAdapter(storeAdapterAnswer);
  const extractorDeps: Record<string, string> = {};
  const extractorDevDeps: Record<string, string> = {};
  for (const ex of selectedExtractors) {
    const r = depsForExtractor(ex);
    Object.assign(extractorDeps, r.deps);
    Object.assign(extractorDevDeps, r.devDeps);
  }
  const merged = mergeDeps(
    pkg,
    { ...deps, ...extractorDeps },
    { ...devDeps, ...extractorDevDeps }
  );
  if (merged.changes.length > 0) {
    await writePackageJson(root, merged.pkg);
  }

  const config: InitConfig = {
    installDir,
    storeAdapter: storeAdapterAnswer,
    aliasBase,
    version: CONFIG_VERSION,
    connectors: existing?.connectors ?? [],
    extractors: Array.from(
      new Set([
        ...(existing?.extractors ?? []),
        ...(richMediaEnabled ? selectedExtractors : []),
      ])
    ).sort(),
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
      "",
      `- Rich media: ${richMediaEnabled ? "enabled" : "disabled"}`,
      richMediaEnabled
        ? `- Embeddings: multimodal enabled (images can be embedded directly)`
        : `- Embeddings: text-only (no direct image embedding)`,
      richMediaEnabled
        ? `- Extractors: ${selectedExtractors.length > 0 ? selectedExtractors.join(", ") : "none"}`
        : "",
      richMediaEnabled
        ? `  Tip: you can tweak extractors + assetProcessing flags in unrag.config.ts later.`
        : `  Tip: re-run \`unrag init --rich-media\` (or edit unrag.config.ts) to enable rich media later.`,
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


