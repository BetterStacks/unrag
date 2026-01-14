import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import path from "node:path";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { doctorSetupCommand } from "@cli/commands/doctor-setup";
import {
  readDoctorConfig,
  mergeDoctorArgsWithConfig,
  getEnvFilesToLoad,
  type DoctorConfig,
} from "@cli/lib/doctor/doctorConfig";

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

describe("doctor config utilities", () => {
  test("readDoctorConfig returns null for missing file", async () => {
    const result = await readDoctorConfig("/nonexistent/path/doctor.json");
    expect(result).toBeNull();
  });

  test("mergeDoctorArgsWithConfig: CLI args take precedence", () => {
    const config: DoctorConfig = {
      version: 1,
      installDir: "lib/unrag",
      env: {
        databaseUrlEnv: "CUSTOM_DB_URL",
      },
      db: {
        schema: "custom_schema",
      },
      defaults: {
        scope: "test-scope",
        strict: true,
      },
    };

    // CLI args override config
    const merged = mergeDoctorArgsWithConfig(
      {
        installDir: "src/unrag",
        schema: "other_schema",
        strict: false,
      },
      config,
      "/project"
    );

    expect(merged.installDir).toBe("src/unrag");
    expect(merged.schema).toBe("other_schema");
    expect(merged.strict).toBe(false);
  });

  test("mergeDoctorArgsWithConfig: config values used when CLI args missing", () => {
    const config: DoctorConfig = {
      version: 1,
      installDir: "lib/unrag",
      env: {
        databaseUrlEnv: "CUSTOM_DB_URL",
      },
      db: {
        schema: "custom_schema",
      },
      defaults: {
        scope: "test-scope",
        strict: true,
      },
    };

    const merged = mergeDoctorArgsWithConfig({}, config, "/project");

    expect(merged.installDir).toBe("lib/unrag");
    expect(merged.databaseUrlEnv).toBe("CUSTOM_DB_URL");
    expect(merged.scope).toBe("test-scope");
    expect(merged.strict).toBe(true);
  });

  test("getEnvFilesToLoad: returns default files when no config", () => {
    const files = getEnvFilesToLoad(null);
    expect(files).toContain(".env");
    expect(files).toContain(".env.local");
  });

  test("getEnvFilesToLoad: uses config loadFiles when provided", () => {
    const config: DoctorConfig = {
      env: {
        loadFiles: [".env.custom", ".env.production"],
      },
    };

    const files = getEnvFilesToLoad(config);
    expect(files).toEqual([".env.custom", ".env.production"]);
  });

  test("getEnvFilesToLoad: prepends extraEnvFile", () => {
    const files = getEnvFilesToLoad(null, ".env.test");
    expect(files[0]).toBe(".env.test");
  });

  test("getEnvFilesToLoad: interpolates NODE_ENV", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const config: DoctorConfig = {
        env: {
          loadFiles: [".env", ".env.${NODE_ENV}"],
        },
      };

      const files = getEnvFilesToLoad(config);
      expect(files).toContain(".env.production");
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

describe("unrag doctor setup", () => {
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

  test("creates config file and adds scripts to package.json", async () => {
    // Setup minimal project
    await writeJson(path.join(runDir, "package.json"), {
      name: "test-project",
      private: true,
      scripts: {},
    });

    await writeJson(path.join(runDir, "unrag.json"), {
      installDir: "lib/unrag",
      storeAdapter: "drizzle",
      version: 1,
    });

    await mkdir(path.join(runDir, "lib/unrag/core"), { recursive: true });

    process.chdir(runDir);
    await doctorSetupCommand(["--yes"]);

    // Check config file was created
    expect(await pathExists(path.join(runDir, ".unrag/doctor.json"))).toBe(true);

    const config = await readJson<DoctorConfig>(
      path.join(runDir, ".unrag/doctor.json")
    );
    expect(config.version).toBe(1);
    expect(config.installDir).toBe("lib/unrag");

    // Check scripts were added
    const pkg = await readJson<{ scripts?: Record<string, string> }>(
      path.join(runDir, "package.json")
    );

    expect(pkg.scripts?.["unrag:doctor"]).toBe(
      "unrag doctor --config .unrag/doctor.json"
    );
    expect(pkg.scripts?.["unrag:doctor:db"]).toBe(
      "unrag doctor --config .unrag/doctor.json --db"
    );
    expect(pkg.scripts?.["unrag:doctor:ci"]).toContain("--json");
    expect(pkg.scripts?.["unrag:doctor:ci"]).toContain("--db");
    expect(pkg.scripts?.["unrag:doctor:ci"]).toContain("--strict");
  });

  test("uses custom config path when provided", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "test-project",
      private: true,
      scripts: {},
    });

    await writeJson(path.join(runDir, "unrag.json"), {
      installDir: "lib/unrag",
      storeAdapter: "drizzle",
      version: 1,
    });

    await mkdir(path.join(runDir, "lib/unrag/core"), { recursive: true });

    process.chdir(runDir);
    await doctorSetupCommand(["--yes", "--config", "custom-doctor.json"]);

    expect(await pathExists(path.join(runDir, "custom-doctor.json"))).toBe(true);

    const pkg = await readJson<{ scripts?: Record<string, string> }>(
      path.join(runDir, "package.json")
    );

    expect(pkg.scripts?.["unrag:doctor"]).toBe(
      "unrag doctor --config custom-doctor.json"
    );
  });

  test("preserves existing scripts in non-interactive mode", async () => {
    await writeJson(path.join(runDir, "package.json"), {
      name: "test-project",
      private: true,
      scripts: {
        "unrag:doctor": "echo existing",
        "other-script": "echo other",
      },
    });

    await writeJson(path.join(runDir, "unrag.json"), {
      installDir: "lib/unrag",
      storeAdapter: "drizzle",
      version: 1,
    });

    await mkdir(path.join(runDir, "lib/unrag/core"), { recursive: true });

    process.chdir(runDir);
    await doctorSetupCommand(["--yes"]);

    const pkg = await readJson<{ scripts?: Record<string, string> }>(
      path.join(runDir, "package.json")
    );

    // Existing script should be preserved in non-interactive mode
    expect(pkg.scripts?.["unrag:doctor"]).toBe("echo existing");
    expect(pkg.scripts?.["other-script"]).toBe("echo other");

    // New scripts should be added
    expect(pkg.scripts?.["unrag:doctor:db"]).toContain("--db");
    expect(pkg.scripts?.["unrag:doctor:ci"]).toContain("--json");
  });

  test("config file roundtrip", async () => {
    const configPath = path.join(runDir, "doctor.json");

    const originalConfig: DoctorConfig = {
      version: 1,
      installDir: "lib/unrag",
      env: {
        loadFiles: [".env", ".env.local"],
        databaseUrlEnv: "DATABASE_URL",
      },
      db: {
        schema: "public",
        tables: {
          documents: "documents",
          chunks: "chunks",
          embeddings: "embeddings",
        },
      },
      defaults: {
        scope: null,
        strict: false,
      },
    };

    await writeJson(configPath, originalConfig);

    const loaded = await readDoctorConfig(configPath);
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.installDir).toBe("lib/unrag");
    expect(loaded?.env?.databaseUrlEnv).toBe("DATABASE_URL");
    expect(loaded?.db?.schema).toBe("public");
    expect(loaded?.db?.tables?.documents).toBe("documents");
    expect(loaded?.defaults?.strict).toBe(false);
  });

  test("handles missing package.json gracefully", async () => {
    // No package.json in runDir
    await writeJson(path.join(runDir, "unrag.json"), {
      installDir: "lib/unrag",
      storeAdapter: "drizzle",
      version: 1,
    });

    await mkdir(path.join(runDir, "lib/unrag/core"), { recursive: true });

    process.chdir(runDir);

    // Should not throw, but config file should still be created
    // Use --project-root since there's no package.json to detect root
    await doctorSetupCommand(["--yes", "--project-root", runDir]);

    // Config file should be created even without package.json
    expect(await pathExists(path.join(runDir, ".unrag/doctor.json"))).toBe(true);
  });
});

describe("doctor --config flag", () => {
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

  test("config values are used when CLI flags not provided", async () => {
    const config: DoctorConfig = {
      version: 1,
      installDir: "custom/path",
      env: {
        databaseUrlEnv: "MY_DATABASE_URL",
      },
      db: {
        schema: "my_schema",
      },
      defaults: {
        scope: "my-scope",
        strict: true,
      },
    };

    const merged = mergeDoctorArgsWithConfig(
      { db: true }, // Only db flag from CLI
      config,
      runDir
    );

    expect(merged.db).toBe(true);
    expect(merged.installDir).toBe("custom/path");
    expect(merged.databaseUrlEnv).toBe("MY_DATABASE_URL");
    expect(merged.scope).toBe("my-scope");
    expect(merged.strict).toBe(true);
  });

  test("CLI flags override config values", async () => {
    const config: DoctorConfig = {
      version: 1,
      installDir: "lib/unrag",
      db: {
        schema: "public",
      },
      defaults: {
        strict: false,
      },
    };

    const merged = mergeDoctorArgsWithConfig(
      {
        installDir: "src/unrag",
        schema: "other",
        strict: true,
      },
      config,
      runDir
    );

    expect(merged.installDir).toBe("src/unrag");
    expect(merged.schema).toBe("other");
    expect(merged.strict).toBe(true);
  });
});
