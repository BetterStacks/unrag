## Unrag Eval Harness — Detailed Spec (Sprint 1)

### Summary
The **Eval Harness** is an **optional, vendored module + lightweight CLI workflow** that helps users **measure retrieval quality and regressions** for Unrag-based RAG systems.

It focuses on **retrieval evaluation** (and optionally **retrieval + reranking**) rather than end-to-end “answer quality” grading.

### Why this exists (value)
- **Prevent regressions** when changing embedding models, chunking, store config, or prompts upstream.
- **Make tuning measurable**: chunk size/overlap, topK, scope strategy, metadata patterns.
- **Support CI gates** (e.g. “recall@10 must be ≥ 0.75”).
- **Keep Unrag’s philosophy**: users own the code; harness is **auditable** and **customizable**.

---

## Goals / Non-goals

### Goals
- **Standard dataset format** for retrieval evaluation.
- **Deterministic evaluation runner** that produces machine-readable JSON + human-readable summaries.
- Metrics for:
  - **Document-level relevance** (primary)
  - **Chunk-level relevance** (optional)
  - **Latency** (secondary)
- Workflows for:
  - local runs
  - CI runs with thresholds
  - comparing two runs (baseline vs candidate)
- First-class support for evaluating:
  - **Vector retrieval only**
  - **Vector retrieval + rerank** (Sprint 1 companion)

### Non-goals (explicitly out of scope for Sprint 1)
- LLM-as-judge answer grading, citations scoring, hallucination grading.
- Multi-step agent evaluation, tool-use evaluation.
- Hybrid search evaluation (planned Sprint 2).
- Metadata filter evaluation (planned Sprint 2, though datasets should be future-proof).
- Hosting a dashboard or uploading results to a SaaS (export files only).

---

## High-level architecture

### Core concept
The harness runs a series of **queries** against an Unrag engine and scores the returned results against **ground-truth relevance labels**.

### Execution stages
1. **Dataset load**: parse dataset file(s).
2. **Index setup** (optional): ingest documents from dataset into the configured store using an isolated scope/prefix.
3. **Query loop**:
   - call `engine.retrieve({ query, topK, scope })`
   - optionally apply reranker on retrieved candidates
4. **Scoring**:
   - compute metrics per query
   - aggregate metrics across the dataset
5. **Reporting**:
   - write JSON report (canonical output)
   - optionally write markdown summary + diff vs baseline
6. **Exit code**:
   - success/fail based on thresholds (CI-friendly)

---

## Integration with Unrag (what gets vendored)

### Expected vendored files (proposed)
These are *targets*; exact paths can be finalized during implementation:
- `lib/unrag/eval/runner.ts`: dataset runner and orchestration
- `lib/unrag/eval/dataset.ts`: dataset parsing + validation
- `lib/unrag/eval/metrics.ts`: metric implementations
- `lib/unrag/eval/report.ts`: report types + writers
- `scripts/unrag-eval.ts`: project entrypoint script that loads `createUnragEngine()` and executes the runner
- `.unrag/eval/`: default location for datasets and run artifacts

### How the harness gets installed (options)
Pick one (implementation choice). The spec supports either:
- **Option A (preferred)**: `unrag add eval` (new “battery” kind alongside connectors/extractors)
- **Option B**: `unrag eval setup` (new command that writes scripts + vendored eval module)

---

## UX / Commands (spec)

### Setup
- `bunx unrag@latest eval setup`
  - Generates `scripts/unrag-eval.ts`
  - Creates `.unrag/eval/` with example dataset(s)
  - Adds `package.json` scripts:
    - `unrag:eval`
    - `unrag:eval:ci`

### Run locally
- `bun run unrag:eval -- --dataset .unrag/eval/datasets/sample.json`

### CI run (strict)
- `bun run unrag:eval:ci -- --dataset .unrag/eval/datasets/sample.json`
  - writes `.unrag/eval/runs/<timestamp>/*.json`
  - returns non-zero exit code if thresholds fail

### Compare two runs
- `bun run unrag:eval -- --dataset ... --baseline .unrag/eval/runs/<old>/report.json`
  - produces `diff.json` + `diff.md`

---

## Dataset format (v1)

### Design principles
- **Human-editable** and **diff-friendly**
- Avoid brittle “exact chunk id” ground truth (chunk IDs are generated at ingest)
- Prefer **document-level labels** using Unrag’s stable identifier: `sourceId`
- Allow future expansion for metadata filters and hybrid search

### File format
- JSON (required for v1)
- YAML optional later (non-goal for v1)

### Dataset schema (conceptual)
Top-level fields:
- `version`: `"1"`
- `id`: dataset identifier
- `description`: optional
- `defaults`:
  - `topK`: default retrieval topK used when query doesn’t specify it
  - `scopePrefix`: default `sourceId` prefix applied to retrieval (and ingestion scope)
  - `mode`: `"retrieve"` or `"retrieve+rerank"` (default `"retrieve"`)
- `documents` (optional): documents to ingest for the dataset
- `queries`: list of evaluation queries

#### `documents[]`
Each document is the unit of ground truth relevance.
- `sourceId` (required): stable logical id
- `content` (required unless `loaderRef` provided): text content to ingest
- `metadata` (optional): stored metadata (JSON)
- `assets` (optional): Unrag assets (URLs/bytes not recommended in eval; see safety)
- `loaderRef` (optional): string key allowing the project script to load content (e.g. from filesystem)

#### `queries[]`
- `id` (required): stable query id
- `query` (required): query text
- `topK` (optional): overrides dataset default
- `scopePrefix` (optional): overrides dataset default
- `relevant` (required): ground truth definition
  - `sourceIds`: list of relevant `sourceId`s (document-level)
  - `anyOfSourceIdPrefixes` (optional): list of acceptable prefixes (future-proofing)
  - `metadataConstraints` (optional, future): intended for Sprint 2 (metadata filters)
- `notes` (optional): human notes

### Example dataset (illustrative)
This is a *spec example*; the actual file generated by setup can differ:

```json
{
  "version": "1",
  "id": "help-center-mini",
  "description": "Tiny dataset to validate retrieval changes.",
  "defaults": {
    "topK": 10,
    "scopePrefix": "eval:help-center:",
    "mode": "retrieve"
  },
  "documents": [
    {
      "sourceId": "eval:help-center:doc:refund-policy",
      "content": "Refunds are available within 30 days..."
    }
  ],
  "queries": [
    {
      "id": "q_refund_window",
      "query": "How long do I have to request a refund?",
      "relevant": { "sourceIds": ["eval:help-center:doc:refund-policy"] }
    }
  ]
}
```

---

## Ground truth & scoring model

### Primary relevance unit: document-level
Unrag retrieves **chunks**, but chunking strategies change frequently.
Therefore, the harness will score relevance primarily at the **document level**:
- A retrieved chunk counts as relevant if `chunk.sourceId` is in `relevant.sourceIds`
- Multiple relevant documents are supported

### Secondary relevance unit: chunk-level (optional v1)
If users want more granular checks, allow **chunk matchers**:
- `containsText`: any retrieved chunk content contains a substring/regex (fragile; optional)
- `metadataKeyEquals`: metadata keys match expected values (more stable)

Note: chunk-level must be opt-in and clearly documented as more brittle.

---

## Metrics (v1)

### Per-query metrics (document-level)
Given retrieved ranked list \(R\) of size \(k\) and set of relevant documents \(G\):
- **hit@k**: 1 if any relevant document appears in top-k; else 0
- **recall@k**: \(|R \cap G| / |G|\) using unique `sourceId`s in top-k
- **precision@k**: \(|R \cap G| / k\)
- **MRR@k**: reciprocal rank of first relevant item within k; else 0
- **nDCG@k** (optional): binary relevance; discounted gain by rank

### Aggregated metrics
Across queries:
- Mean and median for each metric
- Optional breakdowns:
  - by query tag/group (if dataset includes tags later)
  - by scopePrefix (if multiple)

### Operational metrics (secondary)
Capture per-query timings:
- embedding time
- store retrieval time
- rerank time (if enabled)
- total

Report p50/p95 across dataset.

---

## Rerank evaluation (Sprint 1 integration)

### Modes
- **retrieve**: score the store’s returned ranking as-is
- **retrieve+rerank**: retrieve topK candidates, apply reranker, then score reranked order

### What to report
For each query, include:
- metrics before rerank
- metrics after rerank
- delta

This makes reranker impact measurable and regression-safe.

---

## Indexing / ingestion behavior in eval

### Default approach (recommended)
The harness can ingest dataset documents into the user’s existing Postgres store, but it must be **isolated**:
- enforce a required `scopePrefix` like `eval:<datasetId>:<runId>:` or similar
- or ingest documents with sourceIds already namespaced in dataset

### Cleanup policy
Configurable:
- `cleanup: "none" | "on-success" | "always"`

### Safety and reproducibility constraints
- Avoid URL-based assets by default (network variance).
- If assets are used, require explicit opt-in flag and document SSRF/allowlist concerns.

---

## Reports and artifacts

### Canonical output: JSON report
Write a single JSON report file per run:
- path: `.unrag/eval/runs/<timestamp>-<datasetId>/report.json`
- includes:
  - dataset info (id, version)
  - runner config (topK, mode, scopePrefix, engine/provider names)
  - per-query results (metrics + retrieved ids + timings)
  - aggregates (means, medians, p50/p95 timings)
  - thresholds applied + pass/fail outcome

### Optional human output
- `.unrag/eval/runs/.../summary.md`:
  - headline metrics
  - worst queries
  - regressions vs baseline (if provided)

### Diff report (baseline comparison)
Given baseline report \(B\) and candidate report \(C\):
- produce `diff.json` with metric deltas and worst regressions
- produce `diff.md` summary for PR review

---

## CI thresholds (gating)

### Threshold config (v1)
Allow thresholds to be specified:
- via CLI flags OR
- in a `.unrag/eval/config.json` file OR
- in dataset `defaults.thresholds` (lowest priority)

Supported thresholds:
- `min.hitAtK` (e.g. ≥ 0.90)
- `min.recallAtK`
- `min.mrrAtK`
- `max.p95TotalMs` (optional)

CI behavior:
- exit code **0** if all thresholds pass
- exit code **1** if thresholds fail
- exit code **2** if runner errored (invalid dataset, config, runtime failure)

---

## Configuration surface (runner)

### Runner inputs (conceptual)
- `datasetPath`
- `mode`: retrieve | retrieve+rerank
- `topK`
- `scopePrefix`
- `ingest`:
  - enabled
  - cleanup policy
- `baselineReportPath` (optional)
- `thresholds` (optional)
- `outputDir`

### Engine wiring
The harness **must not own** DB connection logic.
It should call the project’s `createUnragEngine()` from `unrag.config.ts` and run through it.

---

## Compatibility & future-proofing (Sprint 2)
This spec is intentionally shaped to support:
- **metadata filters**: dataset can include `metadataConstraints` per query; runner can pass these into retrieval once Unrag supports it.
- **hybrid search**: runner can add a “retrieval strategy” field and compare vector-only vs hybrid.

---

## Open questions (to resolve during implementation)
- **Installation shape**: `unrag add eval` vs `unrag eval setup`.
- **Where to store thresholds**: dataset vs separate config file.
- **Default scope strategy**: whether runner should auto-prefix sourceIds per run or require dataset to include namespaced `sourceId`s.
- **nDCG** inclusion: include in v1 or defer.
- **Loader hooks**: how to support large corpora without embedding raw document text in dataset JSON.

