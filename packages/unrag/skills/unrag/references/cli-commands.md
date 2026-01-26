# CLI Commands

The Unrag CLI manages installation, updates, and debugging of your RAG system.

## Installation

```bash
# Run without installing
bunx unrag@latest <command>

# Or install globally
bun add -g unrag
unrag <command>
```

---

## unrag init

Initialize Unrag in your project. Copies core files, configures store adapter, selects embedding provider.

```bash
bunx unrag@latest init [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--yes`, `-y` | Non-interactive mode with defaults |
| `--dir <path>` | Install directory (default: `lib/unrag`) |
| `--store <adapter>` | Store adapter: `drizzle`, `prisma`, `raw-sql` |
| `--alias <base>` | Import alias (default: `@unrag`) |
| `--provider <name>` | Embedding provider |
| `--rich-media` | Enable rich media extraction |
| `--no-rich-media` | Disable rich media |
| `--extractors <list>` | Comma-separated extractor IDs |
| `--preset <url>` | Load configuration from preset URL |
| `--overwrite <mode>` | `skip` or `force` existing files |
| `--no-install` | Skip dependency installation |
| `--quiet` | Suppress output |
| `--full` | Full scaffold (legacy mode) |
| `--with-docs` | Generate documentation file |

### Examples

```bash
# Interactive setup
bunx unrag@latest init

# Non-interactive with options
bunx unrag@latest init --yes --store drizzle --provider openai

# Enable rich media with specific extractors
bunx unrag@latest init --rich-media --extractors pdf-text-layer,file-text,image-ocr

# From preset
bunx unrag@latest init --preset https://example.com/my-preset.json
```

### What It Creates

```
lib/unrag/                 # Vendored source code
├── core/                  # Core types and engine
├── store/                 # Store adapter
├── embedding/             # Embedding provider
├── extractors/            # Asset extractors (if enabled)
└── ...

unrag.config.ts            # Configuration file
unrag.json                 # Metadata (version, installed modules)
```

### tsconfig.json Updates

The CLI patches your tsconfig.json to add path aliases:

```json
{
  "compilerOptions": {
    "paths": {
      "@unrag/*": ["./lib/unrag/*"],
      "@unrag/config": ["./lib/unrag/config"]
    }
  }
}
```

---

## unrag add

Add extractors, connectors, chunkers, or batteries to an existing installation.

```bash
bunx unrag@latest add <type> <name>
```

### Types

| Type | Description |
|------|-------------|
| `extractor` | Asset extraction modules |
| `connector` | External service connectors |
| `chunker` | Specialized chunking plugins |
| `battery` | Optional feature modules |

### Examples

```bash
# Add extractors
bunx unrag@latest add extractor pdf-text-layer
bunx unrag@latest add extractor pdf-llm
bunx unrag@latest add extractor image-ocr
bunx unrag@latest add extractor file-docx

# Add chunkers
bunx unrag@latest add chunker semantic      # LLM-guided semantic boundaries
bunx unrag@latest add chunker markdown      # Markdown-aware chunking
bunx unrag@latest add chunker code          # AST-based code chunking
bunx unrag@latest add chunker hierarchical  # Section-first with headers
bunx unrag@latest add chunker agentic       # LLM-powered highest quality

# Add connectors
bunx unrag@latest add connector notion
bunx unrag@latest add connector google-drive

# Add batteries
bunx unrag@latest add battery reranker
bunx unrag@latest add battery eval
bunx unrag@latest add battery debug
```

### What It Does

1. Copies module source files to your install directory
2. Adds required dependencies to package.json
3. Updates unrag.json with installed module
4. Installs dependencies (unless `--no-install`)

### Available Modules

**Extractors:**
- `pdf-text-layer` - PDF text layer extraction
- `pdf-llm` - LLM-based PDF extraction
- `pdf-ocr` - OCR for scanned PDFs (worker-only)
- `image-ocr` - Image text extraction via vision LLM
- `image-caption-llm` - Image captioning
- `audio-transcribe` - Audio transcription
- `video-transcribe` - Video audio transcription
- `video-frames` - Video frame analysis (worker-only)
- `file-text` - txt/md/json/csv extraction
- `file-docx` - Word document extraction
- `file-pptx` - PowerPoint extraction
- `file-xlsx` - Excel extraction

**Chunkers:**
- `semantic` - LLM-guided semantic boundaries (requires `ai` SDK)
- `markdown` - Markdown-aware (headers, fenced code blocks)
- `code` - AST-based for source code (requires `tree-sitter`)
- `hierarchical` - Section-first with header context
- `agentic` - LLM-powered highest quality chunking (requires `ai` SDK)

**Connectors:**
- `notion` - Notion pages and databases
- `google-drive` - Google Drive files
- `onedrive` - Microsoft OneDrive
- `dropbox` - Dropbox files

**Batteries:**
- `reranker` - Cohere reranking
- `eval` - Evaluation harness
- `debug` - Debug TUI

---

## unrag upgrade

Upgrade vendored source files to the latest version with three-way merge.

```bash
bunx unrag@latest upgrade [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--force` | Overwrite local changes |
| `--dry-run` | Preview changes without applying |
| `--no-install` | Skip dependency installation |

### How It Works

1. **Detect current version** from unrag.json
2. **Download new version** from registry
3. **Three-way merge**:
   - Original (what you installed)
   - Current (your modifications)
   - New (latest version)
4. **Apply changes** with conflict markers if needed
5. **Update dependencies** in package.json

### Conflict Resolution

When conflicts occur:

```ts
<<<<<<< LOCAL
// Your modification
const chunkSize = 256;
=======
// New version
const chunkSize = 512;
>>>>>>> REMOTE
```

Resolve manually and remove conflict markers.

### Examples

```bash
# Interactive upgrade
bunx unrag@latest upgrade

# Preview changes
bunx unrag@latest upgrade --dry-run

# Force overwrite (lose local changes)
bunx unrag@latest upgrade --force
```

---

## unrag doctor

Validate configuration and diagnose issues.

```bash
bunx unrag@latest doctor [options]
```

### Checks Performed

1. **Configuration**
   - unrag.config.ts exists and is valid
   - unrag.json is present and current version

2. **Database**
   - DATABASE_URL is set
   - Connection successful
   - pgvector extension enabled
   - Required tables exist
   - Indexes are present

3. **Embedding Provider**
   - API key is set
   - Test embedding works

4. **Store Adapter**
   - Adapter matches configured type
   - Schema is compatible

5. **Extractors**
   - Installed extractors are configured
   - Required dependencies present

### Output

```
Unrag Doctor
============

✓ Configuration valid
✓ Database connected
✓ pgvector extension enabled
✓ Tables exist (documents, chunks, embeddings)
✓ Embedding provider configured (openai)
✓ Test embedding successful
✓ Store adapter ready (drizzle)
✓ Extractors configured (3)

All checks passed!
```

### Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--fix` | Attempt to fix issues |

---

## unrag debug

Launch the interactive debug TUI.

```bash
bunx unrag@latest debug [options]
```

### Requirements

1. Debug battery installed (`add battery debug`)
2. Application running with `UNRAG_DEBUG=true`

### Options

| Option | Description |
|--------|-------------|
| `--port <number>` | WebSocket port (default: 9229) |
| `--host <address>` | WebSocket host (default: localhost) |

### Panels

- **Ingest** - Real-time ingestion monitoring
- **Retrieve** - Query and result inspection
- **Rerank** - Reranking operation details
- **Doctor** - Health checks
- **Query** - Interactive query testing
- **Docs** - Browse indexed documents

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Switch panels |
| `j/k` | Navigate up/down |
| `Enter` | Select/expand |
| `q` | Quit |
| `?` | Help |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `UNRAG_SKIP_INSTALL` | Skip dependency installation (=1) |
| `UNRAG_DEBUG` | Enable debug mode (=true) |
| `UNRAG_DEBUG_PORT` | Debug WebSocket port |

Provider-specific variables are documented in [embedding-providers.md](./embedding-providers.md).

---

## unrag.json

Metadata file tracking your installation:

```json
{
  "installDir": "lib/unrag",
  "storeAdapter": "drizzle",
  "aliasBase": "@unrag",
  "embeddingProvider": "openai",
  "version": 2,
  "installedFrom": {
    "unragVersion": "0.4.0"
  },
  "scaffold": {
    "mode": "slim",
    "withDocs": false
  },
  "connectors": ["notion"],
  "extractors": ["pdf-text-layer", "file-text"],
  "chunkers": ["semantic", "markdown"],
  "batteries": ["reranker", "debug"],
  "managedFiles": [
    "lib/unrag/core/types.ts",
    "lib/unrag/core/context-engine.ts",
    "lib/unrag/core/chunking.ts",
    "..."
  ]
}
```

**Do not edit manually** - the CLI manages this file.

---

## Troubleshooting CLI

**Command not found:**
```bash
# Use bunx instead
bunx unrag@latest init

# Or install globally
bun add -g unrag
```

**Permission errors:**
```bash
# Check file permissions
ls -la lib/unrag/

# Reset permissions
chmod -R 755 lib/unrag/
```

**Dependency conflicts:**
```bash
# Clean install
rm -rf node_modules bun.lockb
bun install
```

**Version mismatch:**
```bash
# Check versions
cat unrag.json | jq '.installedFrom'
bunx unrag@latest --version

# Upgrade to fix
bunx unrag@latest upgrade
```
