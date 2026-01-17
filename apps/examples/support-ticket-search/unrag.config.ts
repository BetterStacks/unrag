import {drizzle} from 'drizzle-orm/node-postgres'
import {Pool} from 'pg'
/**
 * Root Unrag config (generated).
 *
 * This file is meant to be the single place you tweak:
 * - Defaults (chunking + retrieval)
 * - Engine settings (storage, asset processing, extractors)
 * - Embedding provider/model/timeouts
 * - How you construct your DB client (Pool/Prisma/etc) and vector store adapter
 *
 * The files under your install dir (e.g. `lib/unrag/**`) are intended to be
 * treated like vendored source code.
 */
import {defineUnragConfig} from './lib/unrag/core'
import {createCohereReranker} from './lib/unrag/rerank'
import {createDrizzleVectorStore} from './lib/unrag/store/drizzle'

export const unrag = defineUnragConfig({
	defaults: {
		chunking: {
			chunkSize: 200,
			chunkOverlap: 40
		},
		retrieval: {
			topK: 8
		}
	},
	embedding: {
		provider: 'ai',
		config: {
			model: 'openai/text-embedding-3-small',
			timeoutMs: 15_000
		}
	},
	engine: {
		/**
		 * Reranker for second-stage ranking after retrieval.
		 */
		reranker: createCohereReranker(),
		/**
		 * Storage controls.
		 *
		 * - storeChunkContent: whether `chunk.content` is persisted and returned by retrieval.
		 * - storeDocumentContent: whether the full original document text is stored in `documents.content`.
		 */
		storage: {
			storeChunkContent: true,
			storeDocumentContent: true
		},
		/**
		 * Optional extractor modules that can process non-text assets into text outputs.
		 *
		 * To install:
		 * - `unrag add extractor pdf-llm`
		 *
		 * Then import it in this file and add it here, for example:
		 * - `import { createPdfLlmExtractor } from "./lib/unrag/extractors/pdf-llm";`
		 * - `extractors: [createPdfLlmExtractor()]`
		 */
		extractors: [
			// __UNRAG_EXTRACTORS__
		],
		/**
		 * Rich media processing controls.
		 *
		 * Notes:
		 * - This generated config is cost-safe by default (all extraction is off).
		 * - `unrag init --rich-media` can enable rich media ingestion for you (extractors + assetProcessing flags).
		 * - Tighten fetch allowlists/limits in production if you ingest URL-based assets.
		 */
		assetProcessing: {
			onUnsupportedAsset: 'skip',
			onError: 'skip',
			concurrency: 4,
			fetch: {
				enabled: true,
				maxBytes: 15 * 1024 * 1024,
				timeoutMs: 20_000
				// allowedHosts: ["..."], // recommended to mitigate SSRF
			}
		}
	}
} as const)

export function createUnragEngine() {
	const databaseUrl = process.env.DATABASE_URL
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required')
	}

	const globalForUnrag = globalThis as unknown as {
		__unragPool?: Pool
		__unragDrizzleDb?: ReturnType<typeof drizzle>
	}
	const pool =
		globalForUnrag.__unragPool ?? new Pool({connectionString: databaseUrl})
	globalForUnrag.__unragPool = pool

	const db = globalForUnrag.__unragDrizzleDb ?? drizzle(pool)
	globalForUnrag.__unragDrizzleDb = db

	const store = createDrizzleVectorStore(db)

	return unrag.createEngine({store})
}
