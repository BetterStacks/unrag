# unrag

## 0.1.1

### Patch Changes

- - Fixed `scope.sourceId` filtering in the Postgres store adapters (Drizzle, Prisma, Raw SQL) to treat `scope.sourceId` as a **prefix** (SQL `LIKE '${scope.sourceId}%'`) instead of an exact match, enabling namespaced/tenant-scoped retrieval consistent with the docs.
  - Updated the Prisma store adapter to use Prisma’s runtime SQL helpers (sqltag/empty) instead of generated-client Prisma.sql
  - Fixed TypeScript errors when Prisma Client isn’t generated yet while keeping the hard @prisma/client imports.

## 0.1.0

### Minor Changes

- Initial version of unrag complete we ingestion and retrieval primitives along with adapters for Drizzle, Prisma & SQL
