# unrag

## 0.2.2

### Patch Changes

- - Expanded help text from a minimal usage hint to a richer “mini manpage” including commands, global flags, `init` options, examples, and quick links to docs + repo.
  - Updated unknown-command handling to include the help text so users can recover quickly.
  - `unrag add notion` now prints a **full documentation URL** (instead of a relative `/docs/...` path) by constructing it from a shared base URL constant via `docsUrl(...)`.
  - Added/used a central constants module (e.g. `cli/lib/constants.ts`) to hold the public base URL + repo URL and a small `docsUrl()` helper for consistent link formatting across commands.

## 0.2.1

### Patch Changes

- - Added `unrag add notion` to install the Notion connector into an existing Unrag installation.
  - Shipped a vendored Notion connector (pages-only v1) that can ingest specific Notion pages by ID/URL and optionally delete on not-found.
  - Added docs at `/docs/connectors/notion`.

## 0.2.0

### Minor Changes

- - `VectorStore` now includes a required `delete({ sourceId } | { sourceIdPrefix })` method.

  - Ingestion is idempotent by default: built-in Postgres adapters treat `upsert()` as **replace-by-`sourceId`** (delete-by-exact-`sourceId` inside the transaction, then insert the new document/chunks/embeddings).
  - `ContextEngine` exposes `delete(...)` to delete a single logical document or wipe a namespace prefix.

## 0.1.1

### Patch Changes

- - Fixed `scope.sourceId` filtering in the Postgres store adapters (Drizzle, Prisma, Raw SQL) to treat `scope.sourceId` as a **prefix** (SQL `LIKE '${scope.sourceId}%'`) instead of an exact match, enabling namespaced/tenant-scoped retrieval consistent with the docs.
  - Updated the Prisma store adapter to use Prisma’s runtime SQL helpers (sqltag/empty) instead of generated-client Prisma.sql
  - Fixed TypeScript errors when Prisma Client isn’t generated yet while keeping the hard @prisma/client imports.

## 0.1.0

### Minor Changes

- Initial version of unrag complete we ingestion and retrieval primitives along with adapters for Drizzle, Prisma & SQL
