import { readFile } from "node:fs/promises";

export type EvalMode = "retrieve" | "retrieve+rerank";

export type EvalDatasetV1 = {
  version: "1";
  id: string;
  description?: string;
  defaults: {
    topK?: number;
    /** Required in this implementation for isolation + deterministic cleanup. */
    scopePrefix: string;
    mode?: EvalMode;
    /**
     * Optional default thresholds (lowest precedence).
     * CLI/config should override this.
     */
    thresholds?: Partial<EvalThresholds>;
  };
  documents?: EvalDatasetDocument[];
  queries: EvalDatasetQuery[];
};

export type EvalDatasetDocument = {
  sourceId: string;
  content?: string;
  loaderRef?: string;
  metadata?: Record<string, unknown>;
  /**
   * Optional rich media inputs (advanced). By default, the runner requires an explicit opt-in.
   * Shape is compatible with Unrag's `AssetInput[]` JSON form.
   */
  assets?: unknown;
};

export type EvalDatasetQuery = {
  id: string;
  query: string;
  topK?: number;
  scopePrefix?: string;
  relevant: {
    sourceIds: string[];
  };
  notes?: string;
};

export type EvalThresholds = {
  min: Partial<{
    hitAtK: number;
    recallAtK: number;
    mrrAtK: number;
  }>;
  max: Partial<{
    p95TotalMs: number;
  }>;
};

function err(path: string, msg: string): Error {
  return new Error(`[unrag:eval] Invalid dataset at ${path}: ${msg}`);
}

function isObject(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function asNonEmptyString(x: unknown, path: string): string {
  if (typeof x !== "string" || x.trim().length === 0) {
    throw err(path, "must be a non-empty string");
  }
  return x;
}

function asOptionalNumber(x: unknown, path: string): number | undefined {
  if (x === undefined) return undefined;
  if (typeof x !== "number" || !Number.isFinite(x)) {
    throw err(path, "must be a finite number");
  }
  return x;
}

function asStringArray(x: unknown, path: string): string[] {
  if (!Array.isArray(x)) throw err(path, "must be an array");
  const out: string[] = [];
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (typeof v !== "string" || v.trim().length === 0) {
      throw err(`${path}[${i}]`, "must be a non-empty string");
    }
    out.push(v);
  }
  return out;
}

function parseThresholds(x: unknown, path: string): Partial<EvalThresholds> | undefined {
  if (x === undefined) return undefined;
  if (!isObject(x)) throw err(path, "must be an object");
  const min = isObject(x.min) ? x.min : undefined;
  const max = isObject(x.max) ? x.max : undefined;

  const out: Partial<EvalThresholds> = {};
  if (min) {
    out.min = {};
    if (min.hitAtK !== undefined) out.min.hitAtK = asOptionalNumber(min.hitAtK, `${path}.min.hitAtK`);
    if (min.recallAtK !== undefined) out.min.recallAtK = asOptionalNumber(min.recallAtK, `${path}.min.recallAtK`);
    if (min.mrrAtK !== undefined) out.min.mrrAtK = asOptionalNumber(min.mrrAtK, `${path}.min.mrrAtK`);
  }
  if (max) {
    out.max = {};
    if (max.p95TotalMs !== undefined) out.max.p95TotalMs = asOptionalNumber(max.p95TotalMs, `${path}.max.p95TotalMs`);
  }
  return out;
}

export function parseEvalDataset(json: unknown): EvalDatasetV1 {
  if (!isObject(json)) throw err("$", "must be an object");

  const version = json.version;
  if (version !== "1") throw err("$.version", 'must be "1"');

  const id = asNonEmptyString(json.id, "$.id");
  const description =
    json.description === undefined ? undefined : asNonEmptyString(json.description, "$.description");

  if (!isObject(json.defaults)) throw err("$.defaults", "must be an object");
  const defaults = json.defaults;
  const scopePrefix = asNonEmptyString(defaults.scopePrefix, "$.defaults.scopePrefix");
  const topK = asOptionalNumber(defaults.topK, "$.defaults.topK");
  const mode =
    defaults.mode === undefined
      ? undefined
      : ((): EvalMode => {
          const v = asNonEmptyString(defaults.mode, "$.defaults.mode");
          if (v !== "retrieve" && v !== "retrieve+rerank") {
            throw err("$.defaults.mode", 'must be "retrieve" or "retrieve+rerank"');
          }
          return v;
        })();

  const thresholds = parseThresholds(defaults.thresholds, "$.defaults.thresholds");

  const documents = (() => {
    if (json.documents === undefined) return undefined;
    if (!Array.isArray(json.documents)) throw err("$.documents", "must be an array");
    const out: EvalDatasetDocument[] = [];
    for (let i = 0; i < json.documents.length; i++) {
      const d = json.documents[i];
      if (!isObject(d)) throw err(`$.documents[${i}]`, "must be an object");
      const sourceId = asNonEmptyString(d.sourceId, `$.documents[${i}].sourceId`);
      const content = d.content === undefined ? undefined : asNonEmptyString(d.content, `$.documents[${i}].content`);
      const loaderRef = d.loaderRef === undefined ? undefined : asNonEmptyString(d.loaderRef, `$.documents[${i}].loaderRef`);
      if (!content && !loaderRef) {
        throw err(`$.documents[${i}]`, 'must include "content" or "loaderRef"');
      }
      const metadata = d.metadata === undefined ? undefined : (isObject(d.metadata) ? (d.metadata as Record<string, unknown>) : (() => { throw err(`$.documents[${i}].metadata`, "must be an object"); })());
      const assets = d.assets;
      out.push({ sourceId, content, loaderRef, metadata, assets });
    }
    return out;
  })();

  if (!Array.isArray(json.queries) || json.queries.length === 0) {
    throw err("$.queries", "must be a non-empty array");
  }
  const queries: EvalDatasetQuery[] = [];
  for (let i = 0; i < json.queries.length; i++) {
    const q = json.queries[i];
    if (!isObject(q)) throw err(`$.queries[${i}]`, "must be an object");
    const qid = asNonEmptyString(q.id, `$.queries[${i}].id`);
    const query = asNonEmptyString(q.query, `$.queries[${i}].query`);
    const qTopK = asOptionalNumber(q.topK, `$.queries[${i}].topK`);
    const qScopePrefix = q.scopePrefix === undefined ? undefined : asNonEmptyString(q.scopePrefix, `$.queries[${i}].scopePrefix`);
    if (!isObject(q.relevant)) throw err(`$.queries[${i}].relevant`, "must be an object");
    const relevantSourceIds = asStringArray(q.relevant.sourceIds, `$.queries[${i}].relevant.sourceIds`);
    const notes = q.notes === undefined ? undefined : asNonEmptyString(q.notes, `$.queries[${i}].notes`);
    queries.push({
      id: qid,
      query,
      topK: qTopK,
      scopePrefix: qScopePrefix,
      relevant: { sourceIds: relevantSourceIds },
      notes,
    });
  }

  return {
    version: "1",
    id,
    ...(description ? { description } : {}),
    defaults: { scopePrefix, ...(topK !== undefined ? { topK } : {}), ...(mode ? { mode } : {}), ...(thresholds ? { thresholds } : {}) },
    ...(documents ? { documents } : {}),
    queries,
  };
}

export async function readEvalDatasetFromFile(datasetPath: string): Promise<EvalDatasetV1> {
  const raw = await readFile(datasetPath, "utf8");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`[unrag:eval] Failed to parse dataset JSON (${datasetPath}): ${msg}`);
  }
  return parseEvalDataset(json);
}

