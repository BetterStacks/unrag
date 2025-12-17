# Unrag

Unrag is a **RAG installer** for TypeScript projects that installs **composable, drop-in primitives** as source files you own.

It installs small, auditable source files into your repo:
- `unrag.config.ts` (project root)
- `lib/unrag/**` (or your chosen directory)
- `lib/unrag/unrag.md` (setup notes + schema)

## Usage

```bash
bunx unrag init
```

### Common flags

```bash
bunx unrag init --yes --store drizzle --dir lib/unrag --alias @unrag
```

- `--store`: `drizzle` | `prisma` | `raw-sql`
- `--dir`: where to install the module code (default `lib/unrag`)
- `--alias`: import alias base (default `@unrag`) used to patch `tsconfig.json` in Next.js projects

## After install

Import the engine from your project root config:

```ts
import { createUnragEngine } from "@unrag/config";
```

Then use the primitives:

```ts
const engine = createUnragEngine();
await engine.ingest({ sourceId: "doc-1", content: "..." });
const result = await engine.retrieve({ query: "search", topK: 5 });
```

## Database

Unrag assumes **Postgres + pgvector**. You manage migrations yourself.
See the installed `lib/unrag/unrag.md` for the expected schema and indexes.


