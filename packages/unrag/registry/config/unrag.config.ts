/**
 * Root Unrag config (generated).
 *
 * This file is meant to be the single place you tweak:
 * - Embedding provider/model/timeouts
 * - Chunking defaults
 * - Retrieval defaults
 * - How you construct your DB client (Pool/Prisma/etc)
 *
 * The files under your install dir (e.g. `lib/unrag/**`) are intended to be
 * treated like vendored source code.
 */

// __UNRAG_IMPORTS__

export const unragConfig = {
  chunking: {
    chunkSize: 200,
    chunkOverlap: 40,
  },
  retrieval: {
    topK: 8,
  },
  embedding: {
    model: "openai/text-embedding-3-small",
    timeoutMs: 15_000,
  },
} as const;

// __UNRAG_CREATE_ENGINE__


