# unrag

## 0.2.5

### Patch Changes

- Added Google Drive connector. Sync specific Google Drive files into Unrag by file ID, with stable source IDs for reliable updates and deletes.
- New support for safer, more controllable sync. Configurable per-file size limit (defaults to **15MB**) and an option to **delete previously ingested content when a file is removed or access is revoked**.
- `unrag add google-drive` is now supported (and `unrag add` lists available connectors).

## 0.2.4

### Patch Changes

- New `--rich-media` flag enables multimodal embeddings and prompts for extractor selection
- New `--extractors <list>` flag to specify extractors directly (e.g., `pdf-text-layer,image-ocr`)
- Interactive grouped extractor picker (PDF, Image, Audio, Video, Files)
- Default preset (`pdf-text-layer`, `file-text`) for non-interactive mode with `--yes --rich-media`

## 0.2.3

### Minor Changes

- **Multi-modal ingestion**: The engine now processes images, PDFs, audio, video, and documents alongside text within a unified embedding space. Text queries can retrieve content from any modality.
- **Extractor modules system**: Added 12 extractors installable via `unrag add extractor:<name>`:
  - **PDF**: `pdf-llm` (LLM-based extraction), `pdf-ocr` (OCR fallback), `pdf-text-layer` (native text layer)
  - **Image**: `image-caption-llm` (LLM captioning), `image-ocr` (text extraction)
  - **Audio**: `audio-transcribe` (speech-to-text transcription)
  - **Video**: `video-frames` (frame extraction + analysis), `video-transcribe` (audio track transcription)
  - **Files**: `file-docx`, `file-pptx`, `file-xlsx`, `file-text` (document parsing)
- **Asset processing pipeline**: New `assetProcessing` config for routing assets to extractors with support for fallback chains, size limits, and per-kind strategies.
- **`getAssetFromChunk()` helper**: Resolve asset URLs from retrieved chunks to display original media alongside extracted text.
- **Redesigned config API**: More ergonomic configuration structure with optional storage of content in document and embedding tables.

### Patch Changes

- Added default multi-modal model configuration so extraction works out of the box.
- Extractor-produced metadata (e.g., page numbers, confidence scores) now preserved as first-class metadata keys on chunks.
- Added ingestion warnings for skipped assets with clear reasons (unsupported kind, size limits, missing extractor).
- Added `repository` field to CLI's `package.json` for better npm discoverability.

## 0.2.2

### Patch Changes

- Expanded help text from a minimal usage hint to a richer “mini manpage” including commands, global flags, `init` options, examples, and quick links to docs + repo.
- Updated unknown-command handling to include the help text so users can recover quickly.
- `unrag add notion` now prints a **full documentation URL** (instead of a relative `/docs/...` path) by constructing it from a shared base URL constant via `docsUrl(...)`.
- Added/used a central constants module (e.g. `cli/lib/constants.ts`) to hold the public base URL + repo URL and a small `docsUrl()` helper for consistent link formatting across commands.

## 0.2.1

### Patch Changes

- Added `unrag add notion` to install the Notion connector into an existing Unrag installation.
- Shipped a vendored Notion connector (pages-only v1) that can ingest specific Notion pages by ID/URL and optionally delete on not-found.
- Added docs at `/docs/connectors/notion`.

## 0.2.0

### Minor Changes

- `VectorStore` now includes a required `delete({ sourceId } | { sourceIdPrefix })` method.

- Ingestion is idempotent by default: built-in Postgres adapters treat `upsert()` as **replace-by-`sourceId`** (delete-by-exact-`sourceId` inside the transaction, then insert the new document/chunks/embeddings).
- `ContextEngine` exposes `delete(...)` to delete a single logical document or wipe a namespace prefix.

## 0.1.1

### Patch Changes

- Fixed `scope.sourceId` filtering in the Postgres store adapters (Drizzle, Prisma, Raw SQL) to treat `scope.sourceId` as a **prefix** (SQL `LIKE '${scope.sourceId}%'`) instead of an exact match, enabling namespaced/tenant-scoped retrieval consistent with the docs.
- Updated the Prisma store adapter to use Prisma’s runtime SQL helpers (sqltag/empty) instead of generated-client Prisma.sql
- Fixed TypeScript errors when Prisma Client isn’t generated yet while keeping the hard @prisma/client imports.

## 0.1.0

### Minor Changes

- Initial version of unrag complete we ingestion and retrieval primitives along with adapters for Drizzle, Prisma & SQL
