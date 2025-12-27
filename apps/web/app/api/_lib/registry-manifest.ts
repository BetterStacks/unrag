import path from "node:path";
import { readFile } from "node:fs/promises";

export type RegistryManifest = {
  version: number;
  extractors: Array<{ id: string; status?: "available" | "coming-soon" }>;
  connectors: Array<{ id: string; status?: "available" | "coming-soon" }>;
};

export async function loadRegistryManifest(): Promise<RegistryManifest> {
  const candidates = [
    // When running from monorepo root
    path.join(process.cwd(), "packages/unrag/registry/manifest.json"),
    // When running from apps/web
    path.join(process.cwd(), "../../packages/unrag/registry/manifest.json"),
    // Fallback: one more level up
    path.join(process.cwd(), "../packages/unrag/registry/manifest.json"),
  ];

  let lastErr: unknown = null;
  for (const abs of candidates) {
    try {
      const raw = await readFile(abs, "utf8");
      const parsed = JSON.parse(raw) as RegistryManifest;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid manifest JSON");
      }
      if (!Array.isArray(parsed.extractors) || !Array.isArray(parsed.connectors)) {
        throw new Error("Invalid manifest shape");
      }
      return parsed;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr ?? new Error("manifest.json not found");
}


