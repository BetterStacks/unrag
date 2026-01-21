# Troubleshooting

Common issues and solutions when working with Unrag.

## Database Issues

### Connection Failed

**Error:** `ECONNREFUSED` or `connection refused`

**Solutions:**
1. Verify DATABASE_URL is set correctly
   ```bash
   echo $DATABASE_URL
   # Should be: postgresql://user:pass@host:5432/dbname
   ```

2. Check database is running
   ```bash
   pg_isready -h localhost -p 5432
   ```

3. Test connection directly
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

4. Check firewall/network rules for remote databases

---

### pgvector Extension Missing

**Error:** `type "vector" does not exist`

**Solution:**
```sql
-- Connect as superuser
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

For managed databases (Supabase, Neon, etc.):
- Supabase: Enable in Dashboard → Database → Extensions
- Neon: `CREATE EXTENSION vector;` (auto-enabled)
- AWS RDS: Use pgvector-enabled instance class

---

### Tables Don't Exist

**Error:** `relation "documents" does not exist`

**Solution:**
Run the schema migration:

```bash
# Drizzle
bunx drizzle-kit migrate

# Prisma
bunx prisma db push

# Raw SQL - run migration manually
psql $DATABASE_URL -f migrations/0001_init_unrag.sql
```

---

### Dimension Mismatch

**Error:** `expected 1536 dimensions, not 768`

**Cause:** Embedding model changed after data was indexed.

**Solutions:**
1. Re-index all data with new model
   ```ts
   await engine.delete({ sourceIdPrefix: "" });  // Delete all
   // Re-ingest everything
   ```

2. Or update vector column dimension
   ```sql
   ALTER TABLE embeddings
   ALTER COLUMN embedding TYPE vector(768);
   ```

3. Recreate index
   ```sql
   DROP INDEX embeddings_embedding_idx;
   CREATE INDEX embeddings_embedding_idx ON embeddings
     USING hnsw (embedding vector_cosine_ops);
   ```

---

## Embedding Issues

### API Key Invalid

**Error:** `401 Unauthorized` or `Invalid API key`

**Solutions:**
1. Check environment variable is set
   ```bash
   echo $OPENAI_API_KEY  # Should not be empty
   ```

2. Verify key format (no extra spaces/newlines)
   ```bash
   # In .env
   OPENAI_API_KEY=sk-proj-...  # No quotes
   ```

3. Test key directly
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

---

### Rate Limits

**Error:** `429 Too Many Requests` or `rate_limit_exceeded`

**Solutions:**
1. Reduce concurrency
   ```ts
   defaults: {
     embedding: {
       concurrency: 2,  // Lower from default 4
       batchSize: 50,   // Smaller batches
     },
   },
   ```

2. Add retry logic
   ```ts
   // In custom provider
   embed: async (input) => {
     for (let i = 0; i < 3; i++) {
       try {
         return await provider.embed(input);
       } catch (e) {
         if (e.status === 429) {
           await sleep(1000 * (i + 1));
           continue;
         }
         throw e;
       }
     }
   }
   ```

3. Upgrade API tier or use different provider

---

### Timeout Errors

**Error:** `AbortError` or `timeout`

**Solutions:**
1. Increase timeout in config
   ```ts
   embedding: {
     provider: "openai",
     config: {
       timeoutMs: 60_000,  // 60 seconds
     },
   },
   ```

2. Check network connectivity

3. Use regional endpoint if available

---

## Extractor Issues

### Extractor Not Found

**Error:** `No extractor found for asset kind: pdf`

**Solutions:**
1. Add the extractor
   ```bash
   bunx unrag@latest add extractor pdf-text-layer
   ```

2. Wire it in config
   ```ts
   import { createPdfTextLayerExtractor } from "./lib/unrag/extractors/pdf-text-layer";

   engine: {
     extractors: [createPdfTextLayerExtractor()],
   },
   ```

3. Enable in assetProcessing
   ```ts
   assetProcessing: {
     pdf: {
       textLayer: { enabled: true },
     },
   },
   ```

---

### Dependency Missing

**Error:** `Cannot find module 'pdfjs-dist'`

**Solution:**
Install missing dependency:
```bash
bun add pdfjs-dist
```

Common extractor dependencies:
- `pdf-text-layer`: `pdfjs-dist`
- `file-docx`: `mammoth`
- `file-pptx`: `jszip`
- `file-xlsx`: `xlsx`

---

### Worker-Only Extractor in Serverless

**Error:** `pdf-ocr requires native binaries`

**Cause:** Worker-only extractors (`pdf-ocr`, `video-frames`) need native binaries.

**Solutions:**
1. Use serverless-compatible extractors
   - `pdf-text-layer` instead of `pdf-ocr`
   - `pdf-llm` for scanned PDFs

2. Process in worker environment
   - Use background job (Trigger.dev, BullMQ)
   - Separate worker service

3. Disable worker-only extractors in serverless
   ```ts
   assetProcessing: {
     pdf: {
       ocr: { enabled: false },
     },
     video: {
       frames: { enabled: false },
     },
   },
   ```

---

## Retrieval Issues

### No Results

**Query returns empty array**

**Causes & Solutions:**

1. **No data ingested**
   ```ts
   // Check if documents exist
   const result = await engine.retrieve({ query: "*", topK: 1 });
   console.log("Has data:", result.chunks.length > 0);
   ```

2. **Scope too narrow**
   ```ts
   // Try without scope
   const result = await engine.retrieve({ query, topK: 10 });
   // vs with scope
   const scoped = await engine.retrieve({
     query,
     topK: 10,
     scope: { sourceId: "docs:" },  // May be filtering everything
   });
   ```

3. **Embedding model mismatch** - See Dimension Mismatch above

4. **Query too short/vague**
   ```ts
   // Use more specific queries
   query: "how to reset password"  // Better
   query: "reset"  // Too vague
   ```

---

### Poor Quality Results

**Results don't match query well**

**Solutions:**

1. **Try reranking**
   ```ts
   const retrieved = await engine.retrieve({ query, topK: 30 });
   const reranked = await engine.rerank({
     query,
     candidates: retrieved.chunks,
     topK: 8,
   });
   ```

2. **Adjust chunk size**
   ```ts
   defaults: {
     chunking: {
       chunkSize: 256,   // Smaller for precise matching
       chunkOverlap: 50,
     },
   },
   ```

3. **Use better embedding model**
   - `text-embedding-3-large` > `text-embedding-3-small`
   - Cohere `embed-english-v3.0` for retrieval

4. **Add metadata for filtering**
   ```ts
   // At ingest
   metadata: { category: "docs", language: "en" }

   // At retrieval - filter client-side
   const filtered = result.chunks.filter(
     c => c.metadata.category === "docs"
   );
   ```

---

### Slow Retrieval

**Queries taking > 500ms**

**Solutions:**

1. **Check index exists**
   ```sql
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'embeddings';

   -- Should see: embeddings_embedding_idx
   ```

2. **Optimize index** (HNSW)
   ```sql
   -- For faster queries (tradeoff: lower recall)
   SET hnsw.ef_search = 40;  -- Default: 40

   -- Rebuild with better parameters
   DROP INDEX embeddings_embedding_idx;
   CREATE INDEX embeddings_embedding_idx ON embeddings
     USING hnsw (embedding vector_cosine_ops)
     WITH (m = 24, ef_construction = 200);
   ```

3. **Use connection pooling**
   ```ts
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20,
   });
   ```

4. **Reduce topK**
   ```ts
   topK: 10  // Instead of 100
   ```

---

## Debug Tools

### Enable Debug Mode

```bash
UNRAG_DEBUG=true bun run dev
```

### Run Doctor

```bash
bunx unrag@latest doctor
```

### Launch Debug TUI

```bash
bunx unrag@latest debug
```

### Add Logging

```ts
// Wrap engine calls
const originalRetrieve = engine.retrieve.bind(engine);
engine.retrieve = async (input) => {
  console.log("[retrieve]", input.query);
  const start = Date.now();
  const result = await originalRetrieve(input);
  console.log("[retrieve] done", Date.now() - start, "ms");
  return result;
};
```

### Asset Processing Events

```ts
assetProcessing: {
  hooks: {
    onEvent: (event) => {
      console.log(`[${event.type}]`, JSON.stringify(event, null, 2));
    },
  },
},
```

---

## Common Error Messages

| Error | Likely Cause | Quick Fix |
|-------|--------------|-----------|
| `ECONNREFUSED` | Database not running | Start Postgres |
| `type "vector" does not exist` | pgvector not installed | `CREATE EXTENSION vector` |
| `401 Unauthorized` | Bad API key | Check env var |
| `429 Too Many Requests` | Rate limited | Reduce concurrency |
| `dimension mismatch` | Model changed | Re-index data |
| `No extractor found` | Missing extractor | `unrag add extractor` |
| `Cannot find module` | Missing dependency | `bun add <package>` |

---

## Getting Help

1. **Check logs** - Look for stack traces and error codes

2. **Run doctor** - `bunx unrag@latest doctor`

3. **Enable debug** - `UNRAG_DEBUG=true`

4. **Search docs** - Check `/docs` for your specific issue

5. **Check source** - The code is in your repo at `lib/unrag/`
