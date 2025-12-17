import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import path from "node:path";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { initCommand } from "../cli/commands/init";

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

describe("context-engine init", () => {
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
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag"]);

    expect(await pathExists(path.join(runDir, "unrag.json"))).toBe(true);
    expect(await pathExists(path.join(runDir, "unrag.config.ts"))).toBe(true);
    expect(await pathExists(path.join(runDir, "lib/unrag", "unrag.md"))).toBe(true);

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
    await initCommand(["--yes", "--store", "raw-sql", "--dir", "lib/unrag"]);

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
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag"]);

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
    await initCommand(["--yes", "--store", "drizzle", "--dir", "lib/unrag"]);

    const tsconfig = await readJson<any>(path.join(runDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./*"]);
    expect(tsconfig.compilerOptions.paths["@unrag/*"]).toEqual(["./lib/unrag/*"]);
    expect(tsconfig.compilerOptions.paths["@unrag/config"]).toEqual(["./unrag.config.ts"]);
  });
});


