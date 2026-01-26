# unrag

## 0.3.3

### Patch Changes

- Advanced chunking methods: semantic, hierarchical, markdown, code, and agentic chunkers
- Shared utilities for LLM-based and text-based chunking operations
- Upgrade CLI crashes due to path resolution conflict on Windows

## 0.3.2

### Patch Changes

- **Improved upgrade command UX**: Added verbose mode (`-v/--verbose`) and detailed conflict information during upgrades
- **Slimmer initial scaffold**: Reduced initial project size by consolidating embedding providers into a single registry-based system
- Improved maintainability of scaffolded code with cleaner file structure
- Enhanced upgrade snapshot diffing with better conflict detection
- Updated CLI registry logic for improved component resolution

## 0.3.1

### Patch Changes

- Fixed a bug in OneDrive connector causing indefinite polling after successful ingestion

## 0.3.0

### Minor Changes

- New OneDrive connector with Microsoft Graph API integration
- New Dropbox connector with full OAuth2 authentication flow
- Added new capabilities in Google Drive connector to sync entire folders and file paths

### Breaking Changes

- `syncPages` and `syncFiles` methods are replaced by `streamPages` and `streamFiles`
- `onProgress` callbacks are removed in favor of onEvent via runConnectorStream, [check here](https://unrag.dev/docs/connectors#the-connector-streaming-model).
- The `engine` parameter is no longer passed to connector functions; instead, pass the stream to `engine.runConnectorStream()`

## 0.2.12

### Patch Changes

- Added `upgrade` command with three-way merge support for seamless code upgrades
- Added `--version` flag for version checking in CLI
- Slimmed down generated config file for minimal installations

## 0.2.11

### Patch Changes

- Debug Panel with TUI for Real-time RAG Pipeline Monitoring: A powerful new terminal-based debugging interface for monitoring and troubleshooting your RAG pipelines in real-time.
  - Interactive TUI Dashboard: Live metrics, connection status, and pipeline health at a glance
  - Event Tracing: Real-time event streaming with detailed inspection for ingest, retrieve, rerank, and delete operations
  - Query Runner: Execute and test retrieval queries directly from the debug panel
  - Doctor Panel: Built-in diagnostics to validate your Unrag configuration
  - Eval Panel: Run and monitor evaluation suites interactively
  - Ingest Panel: Trigger and observe document ingestion workflows
  - Docs Panel: Quick-access documentation viewer
- Universal TypeScript Import Alias Support: Internal refactoring to support path aliases across the codebase for cleaner, more maintainable imports.
  - Introduced tsconfig.json path aliases (@/...) for internal modules
  - Refactored all registry modules to use the new alias convention
  - Consolidated vector store adapters: drizzle-postgres-pgvector → drizzle, prisma-postgres-pgvector → prisma, raw-sql-postgres-pgvector → raw-sql

## 0.2.10

### Patch Changes

- Fixed numerous type issues in vendored code causing build failures
- Fixed reranker response property naming bug causing reranking to fail

## 0.2.9

### Minor Changes

- Added Evaluation harness battery for retrieval quality measurement _(experimental)_. This new eval module is installable via `unrag add battery eval`. It provides systematic, reproducible metrics for measuring and tracking retrieval quality:
  - Dataset format (`EvalDatasetV1`) for defining documents, queries, and ground truth relevance labels
  - Core metrics: Precision@K, Recall@K, MRR, MAP, and NDCG
  - `runEval()` function to execute evaluations with optional reranking pass
  - JSON and Markdown report generation with `writeEvalReport()` and `writeEvalSummaryMd()`
  - Diff comparison between runs via `diffEvalReports()` for tracking regressions
  - Configurable thresholds with `--fail-below` for CI integration
  - Comprehensive documentation at `/docs/eval`
- Batteries now included in preset installs. The `unrag init --preset` flow now supports installing batteries (like `eval` and `reranker`) alongside extractors and connectors.
- Resolved an issue where image URLs passed to multi-modal embedding were not being fetched through the configured fetch policy, causing failures when embedding remote images. Image URLs are now properly resolved to bytes via getAssetBytes() before embedding.

## 0.2.8

### Minor Changes

- **Reranker battery with Cohere and custom reranker support**: Added a new reranking system to improve search result relevance. Includes:
  - Built-in Cohere reranker integration (`rerank/cohere`)
  - Custom reranker support for bring-your-own-reranker scenarios (`rerank/custom`)
  - New `rerank()` function in the context engine for post-retrieval result optimization
  - Configurable via `unrag.config.ts` under `engine.reranker`
  - Comprehensive documentation at `/docs/batteries/reranker`
- **`unrag doctor` command for installation validation and troubleshooting**: New diagnostic CLI command that validates your Unrag installation and identifies common issues:
  - Scans `unrag.config.ts` for configuration problems
  - Validates database connectivity and schema
  - Checks environment variables and dependencies
  - Provides actionable fix suggestions
  - Supports `--fix` flag for auto-remediation of common issues
  - Interactive `unrag doctor --setup` mode for guided configuration

### Patch Changes

- **Fixed deep merge file not present after installation**: Resolved an issue where the `deep-merge.ts` utility was not being copied to the target project during `unrag init`, causing runtime errors.
- **Robust logging for `pdf:text-layer` extractor**: Improved error handling and logging in the PDF text layer extractor to surface extraction issues more clearly and provide better debugging information.
- **New supported runtimes documentation**: Added documentation page covering supported Node.js versions and runtime environments.
- **Updated connector documentation**: Enhanced API documentation for Google Drive and Notion connectors with additional examples and configuration options.

## 0.2.7

### Minor Changes

- The ingest pipeline now supports batch text embeddings via `embedMany()` when the provider supports it, with configurable concurrency limits. This can significantly reduce embedding API calls and improve throughput.
- Added new `embeddingProcessing` config options. Configure `concurrency` (default: 4) and `batchSize` (default: 32) for embedding operations. Set via `unrag.config.ts` under `defaults.embedding` or `engine.embeddingProcessing`.

### Patch Changes

- Eliminate `any` type assertions across the codebase. Replaced all `any` type assertions with properly-typed interfaces for external SDKs and runtime-loaded modules:
  - Added typed interfaces for all 12 embedding providers (OpenAI, Azure, Bedrock, Cohere, Google, Mistral, Ollama, OpenRouter, Together, Vertex, Voyage, AI Gateway)
  - Added structural types for Google Drive API (`DriveFile`, `DriveClient`, `AuthClient`)
  - Added typed interfaces for extractors (pdfjs, audio transcription, video processing)
  - Improved Drizzle store types with proper `QueryRow` interface
- New `AssetMetadataFields` interface and `hasAssetMetadata()` type guard. Standardized metadata shape for asset-derived chunks with compile-time type safety.
- Refactored `mergeDeep` utility. Extracted to dedicated `deep-merge.ts` module with proper generic type signatures and `isRecord()` type guard.
- Typed `requireOptional()` helper. The shared optional dependency loader now requires explicit type parameters instead of defaulting to `any`.

## 0.2.6

### Patch Changes

- Add `--preset` flag to `init` command for preset-based installation from URL or preset ID
- Add `--provider` flag to `init` command to select embedding provider during initialization
- Add `--overwrite` flag to `init` command with `skip` or `force` options for controlling file overwrite behavior
- Support 12 embedding providers with automatic peer dependency installation: OpenAI, Google AI, Azure OpenAI, Vertex AI, AWS Bedrock, Cohere, Mistral, Together.ai, Voyage, OpenRouter, Ollama, and AI Gateway
- Read available extractors and connectors from registry manifest instead of hardcoded lists
- Generate `unrag.config.ts` with preset-configurable defaults for chunkSize, chunkOverlap, topK, embedding model, type, and timeout

### Fixes and improvements

- Fix drizzle pgvector store adapter to handle both array and object return types from `db.execute()`
- Upgrade AI SDK dependency from ^5.0.113 to ^6.0.3
- Refactor `add` command to use registry manifest for available extractors and connectors
- Add new CLI library modules for manifest reading and preset fetching
- Include embedding provider SDK as a dependency when provider is selected during init

## 0.2.5

### Minor Changes

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
