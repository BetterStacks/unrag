# Unrag

Unrag is a **RAG installer** that adds small, auditable, **drop-in primitives** (ingest/retrieve + adapters) directly into your codebase as vendored source files.

This repository is a **Turborepo + Bun workspaces** monorepo.

## Repo structure

- `packages/unrag`: the publishable npm package and CLI (`unrag`) plus the embedded `registry/**` templates it installs.
- `apps/web`: Next.js + Fumadocs site (landing + documentation).

## Local development

Install deps:

```bash
bun install
```

Run everything:

```bash
bun run build
bun run test
```

Run the docs site:

```bash
cd apps/web
bun run dev
```

## Try the CLI locally (link)

```bash
cd packages/unrag
bun run build
bun link
```

Then in any project:

```bash
bun link unrag
bunx unrag init
```

## Releases (Changesets)

- Create a changeset:

```bash
bun run changeset
```

- Version packages:

```bash
bun run version-packages
```

Push to `main`. GitHub Actions will open a Version PR and publish after merge (requires `NPM_TOKEN` secret).
