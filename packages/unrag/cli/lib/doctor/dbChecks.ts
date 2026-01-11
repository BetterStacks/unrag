/**
 * Database checks for doctor command (--db mode).
 * Uses bundled pg to validate connectivity, pgvector, schema, indexes,
 * and embedding dimension consistency.
 */

import path from "node:path";
import { docsUrl } from "@cli/lib/constants";
import { inferTableNames } from "./infer";
import type { CheckResult, InferredInstallState } from "./types";

type DbCheckOptions = {
  databaseUrl?: string;
  databaseUrlEnv?: string;
  schema: string;
  scope?: string;
};

type PgClient = {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[] }>;
  end: () => Promise<void>;
};

/**
 * Run database checks.
 */
export async function runDbChecks(
  state: InferredInstallState,
  options: DbCheckOptions
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Resolve database URL
  const dbUrlResult = resolveDbUrl(state, options);
  if (!dbUrlResult.url) {
    results.push({
      id: "db-url",
      title: "Database URL",
      status: "fail",
      summary: "Could not determine database connection string.",
      details: dbUrlResult.details,
      fixHints: [
        "Set DATABASE_URL environment variable",
        "Or use --database-url <url> flag",
        "Or use --database-url-env <VAR_NAME> flag",
      ],
      docsLink: docsUrl("/docs/getting-started/database"),
    });
    return results;
  }

  results.push({
    id: "db-url",
    title: "Database URL",
    status: "pass",
    summary: `Using ${dbUrlResult.source}`,
    details: [redactConnectionString(dbUrlResult.url)],
  });

  // 2. Connect and run checks
  let end: (() => Promise<void>) | undefined;

  try {
    // Dynamic import pg to avoid bundling issues
    const pg = await import("pg");
    const Pool = pg.default?.Pool ?? pg.Pool;

    const pool = new Pool({ connectionString: dbUrlResult.url });
    end = () => pool.end();
    const client: PgClient = {
      query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
        pool.query(sql, params) as unknown as Promise<{ rows: T[] }>,
      end,
    };

    // Run connectivity check
    const connectivityResult = await checkConnectivity(client);
    results.push(connectivityResult);

    if (connectivityResult.status === "fail") {
      return results;
    }

    // Run pgvector check
    const pgvectorResult = await checkPgvector(client);
    results.push(pgvectorResult);

    // Infer table names
    const installDirFull = state.installDir
      ? path.join(state.projectRoot, state.installDir)
      : null;
    const tableNames = await inferTableNames(
      installDirFull ?? "",
      state.storeAdapter
    );

    // Run schema checks
    const schemaResults = await checkSchema(client, options.schema, tableNames);
    results.push(...schemaResults);

    // Run source_id uniqueness checks (required for idempotent upserts)
    const uniquenessResult = await checkSourceIdUniqueness(client, options.schema, tableNames);
    results.push(uniquenessResult);

    // Check for duplicate source_id values (data integrity)
    const duplicatesResult = await checkDuplicateSourceIds(client, options.schema, tableNames);
    results.push(duplicatesResult);

    // Run index checks
    const indexResults = await checkIndexes(client, options.schema, tableNames);
    results.push(...indexResults);

    // Run dimension consistency checks
    const dimensionResults = await checkDimensionConsistency(
      client,
      options.schema,
      tableNames,
      options.scope
    );
    results.push(...dimensionResults);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({
      id: "db-connection",
      title: "Database connection",
      status: "fail",
      summary: `Connection failed: ${message}`,
      fixHints: [
        "Check that DATABASE_URL is correct",
        "Ensure the database server is running",
        "Check network connectivity and firewall rules",
      ],
    });
  } finally {
    if (end) await end().catch(() => {});
  }

  return results;
}

/**
 * Resolve database URL from various sources.
 */
function resolveDbUrl(
  state: InferredInstallState,
  options: DbCheckOptions
): { url: string | null; source: string; details: string[] } {
  const details: string[] = [];

  // Priority 1: Explicit --database-url flag
  if (options.databaseUrl) {
    return {
      url: options.databaseUrl,
      source: "--database-url flag",
      details: ["Using explicitly provided connection string."],
    };
  }

  // Priority 2: --database-url-env flag
  if (options.databaseUrlEnv) {
    const value = process.env[options.databaseUrlEnv];
    if (value) {
      return {
        url: value,
        source: `${options.databaseUrlEnv} (via --database-url-env)`,
        details: [`Using env var specified by flag: ${options.databaseUrlEnv}`],
      };
    }
    details.push(`${options.databaseUrlEnv} is not set (specified via --database-url-env).`);
  }

  // Priority 3: Inferred env var from config
  if (state.inferredDbEnvVar) {
    const value = process.env[state.inferredDbEnvVar];
    if (value) {
      return {
        url: value,
        source: `${state.inferredDbEnvVar} (inferred from config)`,
        details: [`Found ${state.inferredDbEnvVar} in your database configuration.`],
      };
    }
    details.push(`${state.inferredDbEnvVar} inferred from config but not set.`);
  }

  // Priority 4: DATABASE_URL fallback
  if (process.env.DATABASE_URL) {
    return {
      url: process.env.DATABASE_URL,
      source: "DATABASE_URL",
      details: ["Using standard DATABASE_URL environment variable."],
    };
  }

  details.push("DATABASE_URL is not set.");
  return { url: null, source: "", details };
}

/**
 * Redact sensitive parts of connection string for display.
 */
function redactConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString().replace(/\*\*\*\*@/, "****@");
  } catch {
    // If URL parsing fails, do basic redaction
    return url.replace(/:([^:@]+)@/, ":****@");
  }
}

/**
 * Check database connectivity and basic info.
 */
async function checkConnectivity(client: PgClient): Promise<CheckResult> {
  try {
    const versionResult = await client.query<{ version: string }>(
      "SELECT version()"
    );
    const version = versionResult.rows[0]?.version ?? "unknown";

    const userResult = await client.query<{ current_user: string }>(
      "SELECT current_user"
    );
    const user = userResult.rows[0]?.current_user ?? "unknown";

    const dbResult = await client.query<{ current_database: string }>(
      "SELECT current_database()"
    );
    const database = dbResult.rows[0]?.current_database ?? "unknown";

    // Extract just the version number
    const versionMatch = version.match(/PostgreSQL (\d+\.\d+)/);
    const pgVersion = versionMatch ? versionMatch[1] : version.slice(0, 50);

    return {
      id: "db-connectivity",
      title: "Database connectivity",
      status: "pass",
      summary: "Successfully connected to PostgreSQL.",
      details: [
        `Version: PostgreSQL ${pgVersion}`,
        `Database: ${database}`,
        `User: ${user}`,
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: "db-connectivity",
      title: "Database connectivity",
      status: "fail",
      summary: `Connection test failed: ${message}`,
    };
  }
}

/**
 * Check pgvector extension.
 */
async function checkPgvector(client: PgClient): Promise<CheckResult> {
  try {
    // Check if extension is installed
    const extResult = await client.query<{ extname: string; extversion: string }>(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
    );

    if (extResult.rows.length === 0) {
      return {
        id: "db-pgvector",
        title: "pgvector extension",
        status: "fail",
        summary: "pgvector extension is not installed.",
        fixHints: [
          "Run: CREATE EXTENSION IF NOT EXISTS vector;",
          "You may need superuser privileges or extension preinstalled.",
        ],
        docsLink: docsUrl("/docs/getting-started/database#enabling-pgvector"),
      };
    }

    const version = extResult.rows[0]?.extversion ?? "unknown";

    // Check if <=> operator works
    try {
      await client.query("SELECT '[1,2,3]'::vector <=> '[1,2,3]'::vector");
    } catch {
      return {
        id: "db-pgvector",
        title: "pgvector extension",
        status: "warn",
        summary: `pgvector ${version} installed but operator test failed.`,
        details: ["The <=> (cosine distance) operator may not be available."],
      };
    }

    // Check for HNSW support (pgvector 0.5.0+)
    let hasHnsw = false;
    try {
      const amResult = await client.query<{ amname: string }>(
        "SELECT amname FROM pg_am WHERE amname = 'hnsw'"
      );
      hasHnsw = amResult.rows.length > 0;
    } catch {
      // Older pg versions may not have pg_am
    }

    return {
      id: "db-pgvector",
      title: "pgvector extension",
      status: "pass",
      summary: `pgvector ${version} installed and working.`,
      details: hasHnsw
        ? ["HNSW index support available."]
        : ["HNSW index support not detected (requires pgvector 0.5.0+)."],
      meta: { version, hasHnsw },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: "db-pgvector",
      title: "pgvector extension",
      status: "fail",
      summary: `pgvector check failed: ${message}`,
    };
  }
}

/**
 * Check schema tables and structure.
 */
async function checkSchema(
  client: PgClient,
  schema: string,
  tableNames: { documents: string; chunks: string; embeddings: string }
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check each table
  for (const [logicalName, tableName] of Object.entries(tableNames)) {
    const tableResult = await checkTable(client, schema, tableName, logicalName);
    results.push(tableResult);
  }

  // Check foreign key constraints
  const fkResult = await checkForeignKeys(client, schema, tableNames);
  results.push(fkResult);

  return results;
}

/**
 * Check if a table exists and has expected columns.
 */
async function checkTable(
  client: PgClient,
  schema: string,
  tableName: string,
  logicalName: string
): Promise<CheckResult> {
  const expectedColumns: Record<string, string[]> = {
    documents: ["id", "source_id", "content", "metadata"],
    chunks: ["id", "document_id", "source_id", "idx", "content", "token_count", "metadata"],
    embeddings: ["chunk_id", "embedding", "embedding_dimension"],
  };

  try {
    // Check if table exists
    const tableResult = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )`,
      [schema, tableName]
    );

    if (!tableResult.rows[0]?.exists) {
      return {
        id: `db-table-${logicalName}`,
        title: `Table: ${tableName}`,
        status: "fail",
        summary: `Table ${schema}.${tableName} does not exist.`,
        fixHints: [
          "Run the schema migration to create Unrag tables.",
          "See lib/unrag/unrag.md for the required schema.",
        ],
        docsLink: docsUrl("/docs/getting-started/database#creating-the-schema"),
      };
    }

    // Check columns
    const columnResult = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = $1 AND table_name = $2`,
      [schema, tableName]
    );

    const actualColumns = columnResult.rows.map((r) => r.column_name);
    const expected = expectedColumns[logicalName] ?? [];
    const missingColumns = expected.filter((c) => !actualColumns.includes(c));

    if (missingColumns.length > 0) {
      return {
        id: `db-table-${logicalName}`,
        title: `Table: ${tableName}`,
        status: "warn",
        summary: `Table exists but missing columns: ${missingColumns.join(", ")}`,
        details: [
          `Expected: ${expected.join(", ")}`,
          `Found: ${actualColumns.join(", ")}`,
        ],
      };
    }

    return {
      id: `db-table-${logicalName}`,
      title: `Table: ${tableName}`,
      status: "pass",
      summary: "Table exists with expected columns.",
      meta: { columns: actualColumns },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: `db-table-${logicalName}`,
      title: `Table: ${tableName}`,
      status: "fail",
      summary: `Schema check failed: ${message}`,
    };
  }
}

/**
 * Check foreign key constraints with CASCADE.
 */
async function checkForeignKeys(
  client: PgClient,
  schema: string,
  tableNames: { documents: string; chunks: string; embeddings: string }
): Promise<CheckResult> {
  try {
    const fkResult = await client.query<{
      constraint_name: string;
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      delete_rule: string;
    }>(
      `SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu 
         ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu 
         ON tc.constraint_name = ccu.constraint_name
       JOIN information_schema.referential_constraints rc
         ON tc.constraint_name = rc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = $1
         AND tc.table_name IN ($2, $3, $4)`,
      [schema, tableNames.documents, tableNames.chunks, tableNames.embeddings]
    );

    const fks = fkResult.rows;
    const issues: string[] = [];

    // Check chunks.document_id -> documents.id
    const chunksFk = fks.find(
      (f) =>
        f.table_name === tableNames.chunks && f.column_name === "document_id"
    );
    if (!chunksFk) {
      issues.push(`${tableNames.chunks}.document_id: FK not found`);
    } else if (chunksFk.delete_rule !== "CASCADE") {
      issues.push(
        `${tableNames.chunks}.document_id: delete rule is ${chunksFk.delete_rule}, expected CASCADE`
      );
    }

    // Check embeddings.chunk_id -> chunks.id
    const embeddingsFk = fks.find(
      (f) =>
        f.table_name === tableNames.embeddings && f.column_name === "chunk_id"
    );
    if (!embeddingsFk) {
      issues.push(`${tableNames.embeddings}.chunk_id: FK not found`);
    } else if (embeddingsFk.delete_rule !== "CASCADE") {
      issues.push(
        `${tableNames.embeddings}.chunk_id: delete rule is ${embeddingsFk.delete_rule}, expected CASCADE`
      );
    }

    if (issues.length === 0) {
      return {
        id: "db-foreign-keys",
        title: "Foreign key constraints",
        status: "pass",
        summary: "CASCADE delete constraints are properly configured.",
      };
    }

    return {
      id: "db-foreign-keys",
      title: "Foreign key constraints",
      status: "warn",
      summary: "Some foreign key constraints may be misconfigured.",
      details: issues,
      fixHints: [
        "Ensure FK constraints use ON DELETE CASCADE",
        "This ensures chunks/embeddings are deleted when documents are removed.",
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: "db-foreign-keys",
      title: "Foreign key constraints",
      status: "warn",
      summary: `Could not verify FK constraints: ${message}`,
    };
  }
}

/**
 * Check that documents.source_id has a UNIQUE constraint or unique index.
 * This is required for idempotent upsert-by-sourceId semantics under concurrency.
 */
async function checkSourceIdUniqueness(
  client: PgClient,
  schema: string,
  tableNames: { documents: string; chunks: string; embeddings: string }
): Promise<CheckResult> {
  try {
    // We must ensure the uniqueness is EXACTLY on (source_id) — not a composite unique —
    // because the store uses `ON CONFLICT (source_id)`.
    const uniqueConstraintResult = await client.query<{ constraint_name: string }>(
      `SELECT con.conname as constraint_name
       FROM pg_constraint con
       JOIN pg_class t ON t.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = $1
         AND t.relname = $2
         AND con.contype = 'u'
         AND array_length(con.conkey, 1) = 1
         AND (
           SELECT a.attname
           FROM pg_attribute a
           WHERE a.attrelid = t.oid AND a.attnum = con.conkey[1]
         ) = 'source_id'`,
      [schema, tableNames.documents]
    );

    if (uniqueConstraintResult.rows.length > 0) {
      return {
        id: "db-sourceid-unique",
        title: "documents.source_id uniqueness",
        status: "pass",
        summary: "UNIQUE constraint exists on documents.source_id.",
        details: [`Constraint: ${uniqueConstraintResult.rows[0]!.constraint_name}`],
      };
    }

    const uniqueIndexResult = await client.query<{ indexname: string; indexdef: string }>(
      `SELECT i.relname as indexname, pg_get_indexdef(i.oid) as indexdef
       FROM pg_index ix
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = $1
         AND t.relname = $2
         AND ix.indisunique = true
         AND ix.indexprs IS NULL
         AND ix.indpred IS NULL
         -- Ensure key columns are exactly (source_id). This also allows INCLUDE columns.
         AND pg_get_indexdef(i.oid) ~* '\\\\(\\\\s*\"?source_id\"?\\\\s*\\\\)'`,
      [schema, tableNames.documents]
    );

    if (uniqueIndexResult.rows.length > 0) {
      return {
        id: "db-sourceid-unique",
        title: "documents.source_id uniqueness",
        status: "pass",
        summary: "UNIQUE index exists on documents.source_id.",
        details: [`Index: ${uniqueIndexResult.rows[0]!.indexname}`],
      };
    }

    // No unique constraint found
    return {
      id: "db-sourceid-unique",
      title: "documents.source_id uniqueness",
      status: "fail",
      summary: "Missing UNIQUE constraint on documents.source_id.",
      details: [
        "Unrag requires a unique constraint on documents.source_id for idempotent ingestion.",
        "Without this constraint, concurrent ingests for the same sourceId may create duplicates.",
      ],
      fixHints: [
        `ALTER TABLE ${schema}.${tableNames.documents} ADD CONSTRAINT ${tableNames.documents}_source_id_key UNIQUE (source_id);`,
        "-- Or create a unique index:",
        `CREATE UNIQUE INDEX ${tableNames.documents}_source_id_unique_idx ON ${schema}.${tableNames.documents}(source_id);`,
      ],
      docsLink: docsUrl("/docs/getting-started/database#schema-requirements"),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: "db-sourceid-unique",
      title: "documents.source_id uniqueness",
      status: "fail",
      summary: `Could not check uniqueness constraint: ${message}`,
    };
  }
}

/**
 * Check for duplicate source_id values in the documents table.
 * Duplicates indicate data integrity issues that need to be resolved before
 * adding a unique constraint.
 */
async function checkDuplicateSourceIds(
  client: PgClient,
  schema: string,
  tableNames: { documents: string; chunks: string; embeddings: string }
): Promise<CheckResult> {
  try {
    // Count duplicate groups
    const countResult = await client.query<{ duplicate_count: string }>(
      `SELECT COUNT(*) as duplicate_count
       FROM (
         SELECT source_id
         FROM ${schema}.${tableNames.documents}
         GROUP BY source_id
         HAVING COUNT(*) > 1
       ) duplicates`
    );

    const duplicateCount = parseInt(countResult.rows[0]?.duplicate_count ?? "0", 10);

    if (duplicateCount === 0) {
      return {
        id: "db-sourceid-duplicates",
        title: "documents.source_id duplicates",
        status: "pass",
        summary: "No duplicate source_id values found.",
      };
    }

    // Get sample of duplicates for the error message
    const sampleResult = await client.query<{
      source_id: string;
      count: string;
    }>(
      `SELECT source_id, COUNT(*) as count
       FROM ${schema}.${tableNames.documents}
       GROUP BY source_id
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC
       LIMIT 5`
    );

    const samples = sampleResult.rows.map(
      (r) => `"${r.source_id}" (${r.count} copies)`
    );

    return {
      id: "db-sourceid-duplicates",
      title: "documents.source_id duplicates",
      status: "fail",
      summary: `Found ${duplicateCount} source_id value(s) with duplicates.`,
      details: [
        "Duplicate source_id values must be resolved before adding a unique constraint.",
        "",
        "Sample duplicates:",
        ...samples,
        duplicateCount > 5 ? `... and ${duplicateCount - 5} more` : "",
      ].filter(Boolean),
      fixHints: [
        "-- Find all duplicates:",
        `SELECT source_id, COUNT(*), array_agg(id) as document_ids`,
        `FROM ${schema}.${tableNames.documents}`,
        `GROUP BY source_id HAVING COUNT(*) > 1;`,
        "",
        "-- Resolve duplicates by deleting extra rows for a given source_id.",
        "-- (Exact strategy depends on your app; pick which document_id to keep and delete the rest.)",
      ],
      docsLink: docsUrl("/docs/getting-started/database#resolving-duplicates"),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: "db-sourceid-duplicates",
      title: "documents.source_id duplicates",
      status: "warn",
      summary: `Could not check for duplicates: ${message}`,
    };
  }
}

/**
 * Check recommended indexes.
 */
async function checkIndexes(
  client: PgClient,
  schema: string,
  tableNames: { documents: string; chunks: string; embeddings: string }
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    // Get all indexes
    const indexResult = await client.query<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>(
      `SELECT tablename, indexname, indexdef 
       FROM pg_indexes 
       WHERE schemaname = $1 
         AND tablename IN ($2, $3, $4)`,
      [schema, tableNames.documents, tableNames.chunks, tableNames.embeddings]
    );

    const indexes = indexResult.rows;

    // Check for source_id index on chunks
    const chunksSourceIdx = indexes.find(
      (i) =>
        i.tablename === tableNames.chunks &&
        i.indexdef.toLowerCase().includes("source_id")
    );

    results.push({
      id: "db-index-chunks-source",
      title: `Index: ${tableNames.chunks}(source_id)`,
      status: chunksSourceIdx ? "pass" : "warn",
      summary: chunksSourceIdx
        ? "Index exists for source_id filtering."
        : "Recommended index on source_id not found.",
      fixHints: chunksSourceIdx
        ? undefined
        : [
            `CREATE INDEX IF NOT EXISTS ${tableNames.chunks}_source_id_idx ON ${tableNames.chunks}(source_id);`,
          ],
    });

    // Check for source_id index on documents
    const docsSourceIdx = indexes.find(
      (i) =>
        i.tablename === tableNames.documents &&
        i.indexdef.toLowerCase().includes("source_id")
    );

    results.push({
      id: "db-index-docs-source",
      title: `Index: ${tableNames.documents}(source_id)`,
      status: docsSourceIdx ? "pass" : "warn",
      summary: docsSourceIdx
        ? "Index exists for source_id filtering."
        : "Recommended index on source_id not found.",
      fixHints: docsSourceIdx
        ? undefined
        : [
            `CREATE INDEX IF NOT EXISTS ${tableNames.documents}_source_id_idx ON ${tableNames.documents}(source_id);`,
          ],
    });

    // Check for HNSW or IVFFlat index on embeddings
    const vectorIdx = indexes.find(
      (i) =>
        i.tablename === tableNames.embeddings &&
        (i.indexdef.toLowerCase().includes("hnsw") ||
          i.indexdef.toLowerCase().includes("ivfflat"))
    );

    // Get row count to determine if index is recommended
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${schema}.${tableNames.embeddings}`
    );
    const rowCount = parseInt(countResult.rows[0]?.count ?? "0", 10);

    if (vectorIdx) {
      results.push({
        id: "db-index-vector",
        title: "Vector index",
        status: "pass",
        summary: "Vector index found for similarity search.",
        details: [vectorIdx.indexdef],
        meta: { rowCount },
      });
    } else if (rowCount > 50000) {
      results.push({
        id: "db-index-vector",
        title: "Vector index",
        status: "warn",
        summary: `No vector index found (${rowCount.toLocaleString()} embeddings).`,
        details: [
          "Large datasets benefit significantly from HNSW indexing.",
          "Without an index, similarity search scans all rows.",
        ],
        fixHints: [
          `CREATE INDEX IF NOT EXISTS ${tableNames.embeddings}_hnsw_idx`,
          `ON ${tableNames.embeddings} USING hnsw (embedding vector_cosine_ops);`,
        ],
        docsLink: docsUrl("/docs/concepts/performance"),
        meta: { rowCount },
      });
    } else {
      results.push({
        id: "db-index-vector",
        title: "Vector index",
        status: "pass",
        summary: `No vector index (${rowCount.toLocaleString()} embeddings).`,
        details: [
          "Current dataset size is small enough for sequential scan.",
          "Consider adding HNSW index when exceeding ~50k embeddings.",
        ],
        meta: { rowCount },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({
      id: "db-indexes",
      title: "Index validation",
      status: "warn",
      summary: `Could not check indexes: ${message}`,
    });
  }

  return results;
}

/**
 * Check embedding dimension consistency.
 */
async function checkDimensionConsistency(
  client: PgClient,
  schema: string,
  tableNames: { documents: string; chunks: string; embeddings: string },
  scope?: string
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    // Check for NULL or 0 dimensions
    const nullDimSql = scope
      ? `SELECT COUNT(*) as count
         FROM ${schema}.${tableNames.embeddings} e
         JOIN ${schema}.${tableNames.chunks} c ON e.chunk_id = c.id
         WHERE c.source_id LIKE $1
           AND (e.embedding_dimension IS NULL OR e.embedding_dimension = 0)`
      : `SELECT COUNT(*) as count
         FROM ${schema}.${tableNames.embeddings} e
         WHERE (e.embedding_dimension IS NULL OR e.embedding_dimension = 0)`;

    const nullDimResult = await client.query<{ count: string }>(
      nullDimSql,
      scope ? [scope + "%"] : []
    );
    const nullCount = parseInt(nullDimResult.rows[0]?.count ?? "0", 10);

    if (nullCount > 0) {
      results.push({
        id: "db-dim-nulls",
        title: "Embedding dimensions",
        status: "warn",
        summary: `${nullCount} embeddings have NULL or 0 dimension.`,
        details: [
          "This may indicate incomplete ingestion or migration issues.",
          scope ? `Scope: ${scope}*` : "Checking all embeddings.",
        ],
      });
    }

    // Check for mixed dimensions
    const dimSql = scope
      ? `SELECT e.embedding_dimension, COUNT(*) as count
         FROM ${schema}.${tableNames.embeddings} e
         JOIN ${schema}.${tableNames.chunks} c ON e.chunk_id = c.id
         WHERE c.source_id LIKE $1
           AND e.embedding_dimension IS NOT NULL AND e.embedding_dimension > 0
         GROUP BY e.embedding_dimension
         ORDER BY count DESC`
      : `SELECT e.embedding_dimension, COUNT(*) as count
         FROM ${schema}.${tableNames.embeddings} e
         WHERE e.embedding_dimension IS NOT NULL AND e.embedding_dimension > 0
         GROUP BY e.embedding_dimension
         ORDER BY count DESC`;

    const dimResult = await client.query<{
      embedding_dimension: number;
      count: string;
    }>(
      dimSql,
      scope ? [scope + "%"] : []
    );

    const dimensions = dimResult.rows;

    if (dimensions.length === 0) {
      results.push({
        id: "db-dim-consistency",
        title: "Dimension consistency",
        status: "pass",
        summary: "No embeddings found to check.",
        details: scope ? [`Scope: ${scope}*`] : undefined,
      });
    } else if (dimensions.length === 1) {
      const dim = dimensions[0]!;
      results.push({
        id: "db-dim-consistency",
        title: "Dimension consistency",
        status: "pass",
        summary: `All embeddings use ${dim.embedding_dimension} dimensions.`,
        details: [
          `Total: ${parseInt(dim.count, 10).toLocaleString()} embeddings`,
          scope ? `Scope: ${scope}*` : "All embeddings checked.",
        ],
        meta: { dimension: dim.embedding_dimension, count: parseInt(dim.count, 10) },
      });
    } else {
      const details = dimensions.map(
        (d) =>
          `${d.embedding_dimension} dimensions: ${parseInt(d.count, 10).toLocaleString()} embeddings`
      );

      results.push({
        id: "db-dim-consistency",
        title: "Dimension consistency",
        status: "warn",
        summary: `Mixed dimensions found (${dimensions.length} different values).`,
        details: [
          ...details,
          "",
          "Mixed dimensions can cause retrieval errors.",
          "This typically happens when changing embedding models.",
        ],
        fixHints: [
          "Use --scope to isolate different embedding sets",
          "Re-ingest documents with the current model",
          "Or separate content by sourceId prefix",
        ],
        docsLink: docsUrl("/docs/concepts/architecture"),
        meta: {
          dimensions: dimensions.map((d) => ({
            dimension: d.embedding_dimension,
            count: parseInt(d.count, 10),
          })),
        },
      });
    }

    // Verify embedding_dimension matches actual vector length (sample check)
    try {
      const sampleResult = await client.query<{
        chunk_id: string;
        stored_dim: number;
        actual_dim: number;
      }>(
        `SELECT 
           chunk_id, 
           embedding_dimension as stored_dim,
           vector_dims(embedding) as actual_dim
         FROM ${schema}.${tableNames.embeddings}
         WHERE embedding IS NOT NULL
         LIMIT 100`
      );

      const mismatches = sampleResult.rows.filter(
        (r) => r.stored_dim !== r.actual_dim
      );

      if (mismatches.length > 0) {
        results.push({
          id: "db-dim-mismatch",
          title: "Dimension metadata",
          status: "warn",
          summary: `${mismatches.length} sampled rows have dimension mismatch.`,
          details: [
            "embedding_dimension column doesn't match actual vector length.",
            "This may cause issues with some operations.",
          ],
        });
      }
    } catch {
      // vector_dims may not be available in older pgvector versions
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({
      id: "db-dimensions",
      title: "Dimension checks",
      status: "warn",
      summary: `Could not check dimensions: ${message}`,
    });
  }

  return results;
}
