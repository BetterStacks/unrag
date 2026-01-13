import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import path from "node:path";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { initCommand } from "@cli/commands/init";

const workspaceTmpRoot = path.join(process.cwd(), "tmp", "test-runs");

async function writeJson(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function pathExists(p: string) {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

describe("unrag@latest init", () => {
  let runDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    runDir = path.join(workspaceTmpRoot, crypto.randomUUID());
    await rm(runDir, { recursive: true, force: true });
    await mkdir(runDir, { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(runDir, { recursive: true, force: true });
  });

  test("installs drizzle adapter and merges deps", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "proj",
      private: true,
      type: "module",
      dependencies: {},
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    expect(await pathExists(path.join(runDir, "unrag.json"))).toBe(true);
    expect(await pathExists(path.join(runDir, "unrag.config.ts"))).toBe(true);
    expect(await pathExists(path.join(runDir, "lib/unrag", "unrag.md"))).toBe(true);
    expect(await pathExists(path.join(runDir, "lib/unrag/core/delete.ts"))).toBe(true);
    expect(await pathExists(path.join(runDir, "lib/unrag/core/deep-merge.ts"))).toBe(true);

    // Vendored sources should not retain internal monorepo alias imports.
    const ingest = await readFile(path.join(runDir, "lib/unrag/core/ingest.ts"), "utf8");
    expect(ingest).not.toContain("@registry/");
    expect(ingest).toContain('from "@unrag/');

    expect(
      await pathExists(
        path.join(runDir, "lib/unrag/store/drizzle/schema.ts")
      )
    ).toBe(true);

    const pkg = await readJson<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>(path.join(runDir, "package.json"));

    expect(pkg.dependencies?.ai).toBeTruthy();
    expect(pkg.dependencies?.["drizzle-orm"]).toBeTruthy();
    expect(pkg.dependencies?.pg).toBeTruthy();
    expect(pkg.devDependencies?.["@types/pg"]).toBeTruthy();
  });

  test("installs prisma adapter and merges deps", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "proj",
      private: true,
      type: "module",
      dependencies: {},
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "prisma", "--dir", "lib/unrag", "--no-install"]);

    const pkg = await readJson<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>(path.join(runDir, "package.json"));

    expect(pkg.dependencies?.ai).toBeTruthy();
    expect(pkg.dependencies?.["@prisma/client"]).toBeTruthy();
    expect(pkg.devDependencies?.prisma).toBeTruthy();
  });

  test("detects Next and patches tsconfig paths", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "nextproj",
      private: true,
      type: "module",
      dependencies: { next: "15.0.0" },
    });
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: { target: "ES2022" },
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "raw-sql", "--dir", "lib/unrag", "--no-install"]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
    expect(tsconfig.compilerOptions.paths["@unrag/config"]).toEqual(["./unrag.config.ts"]);
  });

  test("detects Next and creates tsconfig when missing", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "nextproj",
      private: true,
      type: "module",
      dependencies: { next: "16.0.10" },
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
    expect(tsconfig.compilerOptions.paths["@unrag/config"]).toEqual(["./unrag.config.ts"]);
  });

  test("patches Next tsconfig when paths already exist", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "nextproj",
      private: true,
      type: "module",
      dependencies: { next: "16.0.10" },
    });
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2017",
        moduleResolution: "bundler",
        paths: {
          "@/*": ["./*"],
        },
      },
      include: ["**/*.ts"],
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./*"]);
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
    expect(tsconfig.compilerOptions.paths["@unrag/config"]).toEqual(["./unrag.config.ts"]);
  });

  test("supports custom alias base", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "nextproj",
      private: true,
      type: "module",
      dependencies: { next: "16.0.10" },
    });
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2017",
        moduleResolution: "bundler",
        paths: {
          "@/*": ["./*"],
        },
      },
      include: ["**/*.ts"],
    });

    process.chdir(runDir);
    await initCommand([
      "--yes",
      "--store",
      "drizzle",
      "--dir",
      "lib/unrag",
      "--alias",
      "@rag",
      "--no-install",
    ]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.paths["@rag/*"]).toEqual(["./lib/unrag/*"]);
    expect(tsconfig.compilerOptions.paths["@rag/config"]).toEqual(["./unrag.config.ts"]);

    const ingest = await readFile(path.join(runDir, "lib/unrag/core/ingest.ts"), "utf8");
    expect(ingest).not.toContain("@registry/");
    expect(ingest).toContain('from "@rag/');
  });

  test("can enable rich media + selected extractors non-interactively", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "proj",
      private: true,
      type: "module",
      dependencies: {},
    });

    process.chdir(runDir);
    await initCommand([
      "--yes",
      "--store",
      "drizzle",
      "--dir",
      "lib/unrag",
      "--rich-media",
      "--extractors",
      "pdf-text-layer,file-text",
      "--no-install",
    ]);

    const cfg = await readFile(path.join(runDir, "unrag.config.ts"), "utf8");
    // Rich media enables extractors/assetProcessing only. It should NOT flip embedding into multimodal mode.
    expect(cfg).not.toContain('type: "multimodal"');
    expect(cfg).toContain('createPdfTextLayerExtractor');
    expect(cfg).toContain('createFileTextExtractor');
    expect(cfg).toContain('extractors: [');
    expect(cfg).toContain("createPdfTextLayerExtractor()");
    expect(cfg).toContain("createFileTextExtractor()");

    // Enabled flags should be toggled on.
    expect(cfg).toContain("textLayer: {");
    expect(cfg).toContain("enabled: true,");
    expect(cfg).toContain("file: {");
    expect(cfg).toContain("text: {");

    // Extractor modules should be vendored.
    expect(
      await pathExists(
        path.join(runDir, "lib/unrag", "extractors", "pdf-text-layer", "index.ts")
      )
    ).toBe(true);
    expect(
      await pathExists(
        path.join(runDir, "lib/unrag", "extractors", "file-text", "index.ts")
      )
    ).toBe(true);

    const pdfTextLayer = await readFile(
      path.join(runDir, "lib/unrag", "extractors", "pdf-text-layer", "index.ts"),
      "utf8"
    );
    expect(pdfTextLayer).not.toContain("@registry/");
    expect(pdfTextLayer).toContain('from "@unrag/');

    const unragJson = await readJson<any>(path.join(runDir, "unrag.json"));
    expect(unragJson.extractors).toEqual(["file-text", "pdf-text-layer"]);

    const pkg = await readJson<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>(path.join(runDir, "package.json"));
    expect(pkg.dependencies?.ai).toBeTruthy();
    expect(pkg.dependencies?.["pdfjs-dist"]).toBeTruthy();
  });

  test("can select a provider non-interactively and installs its dep", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "proj",
      private: true,
      type: "module",
      dependencies: {},
    });

    process.chdir(runDir);
    await initCommand([
      "--yes",
      "--store",
      "drizzle",
      "--dir",
      "lib/unrag",
      "--provider",
      "openai",
      "--no-install",
    ]);

    const cfg = await readFile(path.join(runDir, "unrag.config.ts"), "utf8");
    expect(cfg).toContain('provider: "openai"');

    const pkg = await readJson<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>(path.join(runDir, "package.json"));
    expect(pkg.dependencies?.ai).toBeTruthy();
    expect(pkg.dependencies?.["@ai-sdk/openai"]).toBeTruthy();
  });

  test("installs batteries from preset (eval) as part of init", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "proj",
      private: true,
      type: "module",
      dependencies: {},
    });

    process.chdir(runDir);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          version: 1,
          createdAt: new Date().toISOString(),
          install: { installDir: "lib/unrag", storeAdapter: "drizzle", aliasBase: "@unrag" },
          modules: { extractors: [], connectors: [], batteries: ["eval"] },
          config: {
            defaults: { chunking: { chunkSize: 200, chunkOverlap: 40 }, retrieval: { topK: 8 } },
            embedding: { provider: "ai", config: { type: "text", model: "openai/text-embedding-3-small", timeoutMs: 15000 } },
            engine: { storage: { storeChunkContent: true, storeDocumentContent: true } },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as any;

    try {
      await initCommand([
        "--preset",
        "https://example.com/preset.json",
        "--no-install",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Battery module code should be vendored.
    expect(await pathExists(path.join(runDir, "lib/unrag", "eval", "index.ts"))).toBe(true);
    const runner = await readFile(path.join(runDir, "lib/unrag", "eval", "runner.ts"), "utf8");
    expect(runner).not.toContain("@registry/");
    expect(runner).toContain('from "@unrag/');

    // Eval scaffolding should be created.
    expect(await pathExists(path.join(runDir, ".unrag/eval/datasets/sample.json"))).toBe(true);
    expect(await pathExists(path.join(runDir, ".unrag/eval/config.json"))).toBe(true);
    expect(await pathExists(path.join(runDir, "scripts/unrag-eval.ts"))).toBe(true);

    const unragJson = await readJson<any>(path.join(runDir, "unrag.json"));
    expect(unragJson.batteries).toEqual(["eval"]);

    const pkg = await readJson<any>(path.join(runDir, "package.json"));
    expect(pkg.scripts?.["unrag:eval"]).toBeTruthy();
    expect(pkg.scripts?.["unrag:eval:ci"]).toBeTruthy();
  });
});

describe("unrag init - TypeScript import alias (non-Next.js)", () => {
  let runDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    runDir = path.join(workspaceTmpRoot, crypto.randomUUID());
    await rm(runDir, { recursive: true, force: true });
    await mkdir(runDir, { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(runDir, { recursive: true, force: true });
  });

  test("patches tsconfig for plain TypeScript project (no Next.js)", async () => {
    // Plain TypeScript project without Next.js
    await writeJson(path.join(runDir, "package.json"), {
      name: "ts-proj",
      private: true,
      type: "module",
      dependencies: {
        typescript: "^5.0.0",
      },
    });
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
      },
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
    expect(tsconfig.compilerOptions.paths["@unrag/config"]).toEqual(["./unrag.config.ts"]);
  });

  test("creates tsconfig when missing for plain TypeScript project", async () => {
    // TypeScript project without tsconfig.json
    await writeJson(path.join(runDir, "package.json"), {
      name: "ts-proj",
      private: true,
      type: "module",
      dependencies: {
        typescript: "^5.0.0",
      },
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    expect(await pathExists(path.join(runDir, "tsconfig.json"))).toBe(true);
    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
    expect(tsconfig.compilerOptions.paths["@unrag/config"]).toEqual(["./unrag.config.ts"]);
  });

  test("patches tsconfig preserving existing paths for plain TypeScript project", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "ts-proj",
      private: true,
      type: "module",
      dependencies: {
        typescript: "^5.0.0",
      },
    });
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"],
          "@utils/*": ["./src/utils/*"],
        },
      },
      include: ["src/**/*.ts"],
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    // Existing paths preserved
    expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./src/*"]);
    expect(tsconfig.compilerOptions.paths["@utils/*"]).toEqual(["./src/utils/*"]);
    // New unrag paths added
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
    expect(tsconfig.compilerOptions.paths["@unrag/config"]).toEqual(["./unrag.config.ts"]);
    // Other fields preserved
    expect(tsconfig.include).toEqual(["src/**/*.ts"]);
  });

  test("supports custom install directory in tsconfig paths", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "ts-proj",
      private: true,
      type: "module",
      dependencies: {},
    });
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: { target: "ES2022" },
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "src/lib/rag", "--no-install"]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./src/lib/rag/*"]);
  });

  test("supports custom alias base for plain TypeScript project", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "ts-proj",
      private: true,
      type: "module",
      dependencies: {},
    });
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: { target: "ES2022" },
    });

    process.chdir(runDir);
    await initCommand([
      "--yes",
      "--store",
      "drizzle",
      "--dir",
      "lib/unrag",
      "--alias",
      "@myrag",
      "--no-install",
    ]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.paths["@myrag/*"]).toEqual(["./lib/unrag/*"]);
    expect(tsconfig.compilerOptions.paths["@myrag/config"]).toEqual(["./unrag.config.ts"]);
    // Should not have @unrag paths
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toBeUndefined();
  });

  test("generated unrag.config.ts has valid imports from install directory", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "ts-proj",
      private: true,
      type: "module",
      dependencies: {},
    });
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: { target: "ES2022" },
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    const config = await readFile(path.join(runDir, "unrag.config.ts"), "utf8");
    // Config should import from the install directory
    expect(config).toContain("./lib/unrag/");
    expect(config).toContain("defineUnragConfig");
    expect(config).toContain("createDrizzleVectorStore");
  });

  test("works with Bun TypeScript project", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "bun-proj",
      private: true,
      type: "module",
      devDependencies: {
        "bun-types": "^1.0.0",
      },
    });
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        types: ["bun-types"],
      },
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
    // Existing types preserved
    expect(tsconfig.compilerOptions.types).toEqual(["bun-types"]);
  });

  test("works with Deno TypeScript project", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "deno-proj",
      private: true,
      type: "module",
      dependencies: {},
    });
    // Deno-style tsconfig
    await writeJson(path.join(runDir, "tsconfig.json"), {
      compilerOptions: {
        lib: ["deno.window"],
        strict: true,
      },
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
    // Existing lib preserved
    expect(tsconfig.compilerOptions.lib).toEqual(["deno.window"]);
  });

  test("works with minimal package.json (no dependencies)", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "minimal-proj",
      private: true,
    });

    process.chdir(runDir);
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag", "--no-install"]);

    // Should create tsconfig and patch it
    expect(await pathExists(path.join(runDir, "tsconfig.json"))).toBe(true);
    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
  });
});


