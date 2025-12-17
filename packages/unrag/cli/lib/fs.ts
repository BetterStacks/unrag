import { access, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

export async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

export function normalizePosixPath(p: string) {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

export async function tryFindProjectRoot(startDir: string) {
  return findUp(startDir, "package.json");
}

/**
 * Search upwards for a file and return the directory containing it.
 */
export async function findUp(startDir: string, filename: string) {
  let current = path.resolve(startDir);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = path.join(current, filename);
    if (await exists(candidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      out.push(full);
    } else {
      // ignore symlinks and others
      const s = await stat(full).catch(() => null);
      if (s?.isFile()) out.push(full);
    }
  }
  return out;
}


