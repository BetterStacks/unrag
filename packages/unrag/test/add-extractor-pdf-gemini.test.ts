import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import path from "node:path";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { addCommand } from "../cli/commands/add";

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

describe("unrag add extractor pdf-llm", () => {
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

  test("installs extractor files and records into unrag.json", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "proj",
      private: true,
      type: "module",
      dependencies: {},
    });

    await writeJson(path.join(runDir, "unrag.json"), {
      installDir: "lib/unrag",
      storeAdapter: "raw-sql",
      aliasBase: "@unrag",
      version: 1,
      connectors: [],
      extractors: [],
    });

    process.chdir(runDir);
    await addCommand(["extractor", "pdf-llm", "--yes"]);

    expect(
      await pathExists(
        path.join(runDir, "lib/unrag/extractors/pdf-llm/index.ts")
      )
    ).toBe(true);

    const cfg = await readJson<{ extractors?: string[] }>(
      path.join(runDir, "unrag.json")
    );
    expect(cfg.extractors).toEqual(["pdf-llm"]);
  });
});


