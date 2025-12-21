# Extractor Modules — Requirements Spec

Status: Draft (for later implementation)

This document specifies the **optional extractor module system** for Unrag. Extractor modules add “fully flexed” built-in capabilities (OCR, transcription, document analysis, LLM-based extraction/summarization, etc.) while keeping the core engine lightweight.

## Goals

- Provide a **modular extension mechanism** for turning rich media (PDF/audio/images/files) into text chunks (and optionally image embeddings) that flow through the existing ingest pipeline.
- Enable **turnkey, batteries-included extractors** as opt-in modules, installed with `unrag add extractor <name>`.
- Keep the retrieval story coherent by preserving a **single embedding space**:
  - Text queries embed as text.
  - Extracted content embeds as text.
  - Images may embed directly only when a unified multimodal embedding provider is configured.
- Maintain Unrag’s design intent: **small, auditable primitives** vendored into the user’s repo.

## Non-goals (initial)

- Not solving “multi-vector / multi-space retrieval” (e.g., separate audio vectors).
- Not standardizing vendor-specific file upload formats across providers in v1; extractor modules may be vendor-specific.
- Not providing a UI or admin dashboard for extraction jobs.

## Terminology

- **Asset**: A non-text attachment or embedded object (image, PDF, audio, video, generic file) associated with an ingested document.
- **Extractor**: A function that turns an asset into one or more **text outputs** (raw text, OCR text, transcript, structured extraction, summaries).
- **AssetProcessing**: Orchestration layer that decides which extractors run for which assets, applies limits, and yields chunks to be embedded and stored.

## Design principles

- **Safe by default**: strict size/time limits, URL allowlists, and clear failure modes.
- **Configurable**: engine-level defaults + per-ingest overrides.
- **Observable**: structured events/metrics so users can reason about costs and failures.
- **Composable**: extractors can be chained (e.g., PDF text layer → OCR fallback → LLM summary).
- **Auditable**: modules are small, vendor code is contained, and prompts are visible to users.

## User stories

1. As a user, I ingest a Notion page with text + images + PDFs + audio and I want the engine to “just work” after installing and enabling the needed extractors.
2. As a user, I want to treat some images as “fluff” (skip/caption-only) and others as “informational” (OCR/caption + direct image embedding when possible).
3. As a user, I want PDF extraction to be cost-efficient: try text layer first, then use a heavy document analysis model only if needed.
4. As a user, I want to bound spend and risk: enforce max bytes/pages/minutes and set a strict on-error policy.

## Functional requirements

### R1. Installation via CLI (vendored modules)

- Provide a CLI command:
  - `unrag add extractor <name> [--yes]`
- The command must:
  - Copy extractor module source files from the Unrag registry into the user’s install directory (e.g. `lib/unrag/extractors/<name>/**`).
  - Add required dependencies to the user’s `package.json` (deps/devDeps).
  - Record installed extractors in `unrag.json` (e.g. `extractors: ["pdf-gemini", "audio-transcribe", ...]`).
- The command must be **idempotent** and support non-interactive usage (`--yes`).

### R2. Standard extractor interface

Extractor modules must implement one of the following (exact signatures TBD during implementation):

- **Per-asset extractor**: input is a single asset + context; output is extracted text segments.
- **Batch extractor** (optional): process multiple assets concurrently for efficiency.

Minimum required inputs:

- Asset identity: `sourceId`, `documentId`, `assetId`
- Asset access: either `url` or `bytes` (or both) + `mimeType` when known
- Context: document metadata, connector metadata, and per-ingest overrides
- Limits: max bytes/pages/duration, timeouts, and cost ceilings

Minimum required outputs:

- `texts[]`: an ordered list of extracted text items (each with `label`, `content`, optional `confidence`, optional `pageRange/timeRange`)
- `metadata`: extractor-produced metadata suitable for storing on chunks (e.g. detected language, page count)
- `diagnostics`: optional debug information and billing estimates (tokens, seconds, model id)

### R3. Extractor orchestration (asset processing pipeline)

Core asset processing must support:

- Routing by:
  - `asset.kind` (image/pdf/audio/video/file)
  - `mimeType` prefixes and exact matches
  - connector hints (e.g. Notion block type)
- Chains and fallbacks:
  - Example for PDFs: `pdfTextLayer` → if empty/lowQuality then `pdfDocumentAnalysis`
  - Example for audio: `transcript` → optional `summary`
- Policies:
  - `onError`: `skip-asset` | `fail-ingest`
  - `onTimeout`: `skip-asset` | `fail-ingest`
  - `onLimitExceeded`: `skip-asset` | `fail-ingest`
- Dedupe:
  - Avoid reprocessing the same asset in one ingest (by hash / stable id).
  - Optional cache hooks (pluggable) for re-ingest runs.

### R4. Image “fluff vs informational” support

The system must support user-configurable routing for images:

- Classification hook:
  - Inputs: image asset + optional caption + connector metadata
  - Output labels: at minimum `fluff` vs `informational` (extensible)
- Per-class behavior:
  - `skip`
  - `caption-only` (embed caption text only)
  - `ocr-only` (extract text, embed as text)
  - `direct-embed` (embed image pixels in unified space)
  - `direct+caption` (both)

### R5. Extractor module: PDF document analysis (Gemini via AI SDK)

Provide an installable module (example name: `pdf-gemini`) that:

- Accepts PDF bytes (preferred) or URL (optional; if URL is used, must obey fetch safety).
- Uses Gemini document processing (via Vercel AI SDK) to extract:
  - Full text (best-effort) and optionally structured output (headings/tables as markdown).
- Returns extracted text segments suitable for chunking and embedding as text.
- Supports strict limits:
  - max bytes, max pages
  - max tokens/output chars
  - timeouts and retries
  - optional “summary mode” to reduce cost

### R6. Extractor module: OCR (images and scanned PDFs)

Provide an installable module (example name: `ocr-vision`) that:

- Performs OCR using a vision-capable model (remote-first, via AI SDK) or a configured provider.
- Works for:
  - images
  - PDF pages rendered to images (rendering strategy must be explicit; may require extra deps)
- Outputs:
  - extracted text + confidence (if available)
  - optional bounding boxes (as metadata) — v1 optional

### R7. Extractor module: audio transcription

Provide an installable module (example name: `audio-transcribe`) that:

- Produces a transcript with timestamps (optional), language detection, and a plain text variant.
- Supports chunking by time windows (e.g. every N seconds) or semantic segmentation (optional).
- Supports strict limits:
  - max duration, max bytes
  - allowed codecs/mime types

### R8. LLM-based extraction/summarization module

Provide an installable module (example name: `llm-extract`) that:

- Accepts arbitrary file bytes (with strict size/type limits) and a user-configured prompt.
- Produces:
  - extracted text
  - optional summary chunks
  - optional structured JSON (schema-based) — optional
- Must have safe defaults:
  - refuse unknown binary formats unless explicitly allowed
  - hard caps on bytes and output size

### R9. Network fetcher and safety model

If any module fetches URLs (Notion signed URLs, etc.), the system must provide:

- Allowlist by host/domain and protocol (`https:` only by default)
- Max bytes and content-type validation
- Redirect policy (limit count, forbid cross-host redirects by default)
- Timeouts and retries
- Opt-out switch: `fetch.enabled = false` (then URL-only assets are skipped/fail based on policy)

### R10. Observability and developer ergonomics

The system must expose structured events (or callbacks) for:

- asset:start / asset:success / asset:error
- extractor:start / extractor:success / extractor:error
- timing (ms), bytes processed, pages, duration seconds
- estimated cost counters (tokens, model calls) when available

Additionally:

- Provide a “dry-run mode” option to list which assets would be processed and by which extractors without calling external services.

## Configuration requirements

### Engine config vs per-ingest overrides

- Users must be able to set global defaults in `unrag.config.ts` (engine creation).
- Users must be able to override at call sites (e.g., `syncNotionPages({ ingest: { assetProcessing: ... } })`).

Precedence:

1. Per-ingest overrides
2. Engine defaults
3. Module defaults

### Minimal config shape (illustrative)

```ts
assetProcessing: {
  onError: "skip-asset" | "fail-ingest";
  concurrency: number;
  fetch?: {
    enabled: boolean;
    allowedHosts?: string[];
    maxBytes?: number;
    timeoutMs?: number;
  };
  image?: {
    classify?: (asset, ctx) => Promise<"fluff" | "informational">;
    routes: {
      fluff: { mode: "skip" | "caption-only" | "ocr-only" };
      informational: { mode: "direct-embed" | "direct+caption" | "ocr-only" };
    };
  };
  pdf?: {
    extractors: Array<"pdf-text-layer" | "pdf-gemini" | "ocr-vision">;
  };
  audio?: {
    extractors: Array<"audio-transcribe" | "llm-extract">;
  };
}
```

## Data model requirements (no schema changes)

- All extracted outputs must be stored as standard chunks with:
  - `content`: extracted text (or caption)
  - `embedding`: produced by the configured embedding provider (text embedding; image embedding only when supported)
  - `metadata`: must include enough to link back to the asset:
    - `assetId`, `assetKind`, `assetUri`, `mimeType`
    - `extractor`: name/version
    - `extractorMeta`: optional structured metadata (page ranges, timestamps)

## Security, privacy, and compliance requirements

- All modules that call remote providers must document:
  - what is sent (bytes vs derived text)
  - retention/usage claims if known
  - how to disable the module or use local-only alternatives
- Provide clear warnings about ingesting secrets/PII.
- Support redaction hooks (optional) before sending to remote services.

## Performance requirements

- Support batching where possible (e.g., text embeddings with `embedMany`).
- Parallelize extraction with bounded concurrency.
- Provide streaming/chunked extraction outputs for large artifacts (optional but desirable).

## Acceptance criteria

- A user can:\n+  1) run `unrag init`,\n+  2) run `unrag add notion`,\n+  3) run `unrag add extractor pdf-gemini`,\n+  4) configure the extractor in `unrag.config.ts`,\n+  5) ingest a Notion page with an embedded PDF,\n+  6) retrieve relevant chunks from PDF content via text query.\n+- Safety controls prevent downloading/processing unexpectedly large assets by default.\n+- Errors are visible and controllable via `onError` policy.\n+\n+## Open questions (to resolve during implementation)\n+\n+- Exact extractor interface shape: sync vs async generator (streaming).\n+- How modules register themselves: explicit import + config vs auto-registration when installed.\n+- How to handle Notion expiring URLs: require bytes fetch at ingest time vs store stable references only.\n+- Model/provider compatibility: which AI SDK providers support image embeddings in the same space as text.\n+\n*** End Patch}

