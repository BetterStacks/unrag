import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { exists } from "./fs";

type PackageJson = {
  name?: string;
  private?: boolean;
  type?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

export async function detectPackageManager(projectRoot: string): Promise<PackageManager> {
  if (await exists(path.join(projectRoot, "bun.lock"))) return "bun";
  if (await exists(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(path.join(projectRoot, "yarn.lock"))) return "yarn";
  if (await exists(path.join(projectRoot, "package-lock.json"))) return "npm";
  return "npm";
}

export async function readPackageJson(projectRoot: string): Promise<PackageJson> {
  const raw = await readFile(path.join(projectRoot, "package.json"), "utf8");
  return JSON.parse(raw) as PackageJson;
}

export async function writePackageJson(projectRoot: string, pkg: PackageJson) {
  await writeFile(
    path.join(projectRoot, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
    "utf8"
  );
}

export type DepChange = { name: string; version: string; kind: "dep" | "devDep" };

export function mergeDeps(
  pkg: PackageJson,
  deps: Record<string, string>,
  devDeps: Record<string, string>
): { pkg: PackageJson; changes: DepChange[] } {
  const next: PackageJson = { ...pkg };
  next.dependencies = { ...(pkg.dependencies ?? {}) };
  next.devDependencies = { ...(pkg.devDependencies ?? {}) };

  const changes: DepChange[] = [];

  for (const [name, version] of Object.entries(deps)) {
    if (!next.dependencies[name] && !next.devDependencies[name]) {
      next.dependencies[name] = version;
      changes.push({ name, version, kind: "dep" });
    }
  }

  for (const [name, version] of Object.entries(devDeps)) {
    if (!next.dependencies[name] && !next.devDependencies[name]) {
      next.devDependencies[name] = version;
      changes.push({ name, version, kind: "devDep" });
    }
  }

  return { pkg: next, changes };
}

export function depsForAdapter(adapter: "drizzle" | "prisma" | "raw-sql") {
  const deps: Record<string, string> = {
    ai: "^5.0.113",
  };

  const devDeps: Record<string, string> = {};

  if (adapter === "drizzle") {
    deps["drizzle-orm"] = "^0.45.1";
    deps["pg"] = "^8.16.3";
    devDeps["@types/pg"] = "^8.16.0";
  }

  if (adapter === "raw-sql") {
    deps["pg"] = "^8.16.3";
    devDeps["@types/pg"] = "^8.16.0";
  }

  if (adapter === "prisma") {
    deps["@prisma/client"] = "^6.0.0";
    devDeps["prisma"] = "^6.0.0";
  }

  return { deps, devDeps };
}

export function installCmd(pm: PackageManager) {
  if (pm === "bun") return "bun install";
  if (pm === "pnpm") return "pnpm install";
  if (pm === "yarn") return "yarn";
  return "npm install";
}


