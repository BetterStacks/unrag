import {defineConfig, resolveConfig} from '@registry/core/config'
import {
	type RunConnectorStreamOptions,
	type RunConnectorStreamResult,
	runConnectorStream
} from '@registry/core/connectors'
import {deleteDocuments} from '@registry/core/delete'
import {ingest, planIngest} from '@registry/core/ingest'
import {rerank} from '@registry/core/rerank'
import {retrieve} from '@registry/core/retrieve'
import type {
	AssetExtractor,
	ContextEngineConfig,
	DefineUnragConfigInput,
	DeleteInput,
	EmbeddingProvider,
	IngestInput,
	IngestPlanResult,
	IngestResult,
	RerankInput,
	RerankResult,
	ResolvedContextEngineConfig,
	RetrieveInput,
	RetrieveResult,
	UnragCreateEngineRuntime
} from '@registry/core/types'
import {createEmbeddingProviderFromConfig} from '@registry/embedding/providers'

export class ContextEngine {
	private readonly config: ResolvedContextEngineConfig

	constructor(config: ContextEngineConfig) {
		this.config = resolveConfig(config)

		// Auto-start debug server when UNRAG_DEBUG=true
		if (process.env.UNRAG_DEBUG === 'true') {
			this.initDebugServer()
		}
	}

	/**
	 * Initialize the debug WebSocket server.
	 * This is done asynchronously to avoid blocking engine creation.
	 */
	private initDebugServer(): void {
		// Importing the debug battery must be optional.
		// We use a dynamic importer via `new Function` so bundlers/tsc won't
		// treat it as a hard dependency when the debug battery isn't installed.
		const importOptionalModule = (() => {
			let fn: ((m: string) => Promise<unknown>) | null = null
			return (m: string) => {
				fn ??= new Function('m', 'return import(m)') as (
					m: string
				) => Promise<unknown>
				return fn(m)
			}
		})()

		const debugServerModule: string = '@registry/debug/server'
		const debugRuntimeModule: string = '@registry/debug/runtime'

		Promise.all([
			importOptionalModule(debugServerModule),
			importOptionalModule(debugRuntimeModule)
		])
			.then(([serverMod, runtimeMod]) => {
				const startDebugServer = (
					serverMod as {
						startDebugServer?: () => Promise<unknown>
					}
				)?.startDebugServer
				const registerUnragDebug = (
					runtimeMod as {
						registerUnragDebug?: (args: {
							engine: ContextEngine
							storeInspector?: unknown
						}) => void
					}
				)?.registerUnragDebug

				// Auto-register runtime so interactive TUI features (Query/Docs/Eval) work out of the box
				// when the debug battery is installed.
				if (typeof registerUnragDebug === 'function') {
					try {
						const storeInspector = (
							this.config.store as unknown as {
								inspector?: unknown
							}
						)?.inspector
						registerUnragDebug({
							engine: this,
							...(storeInspector ? {storeInspector} : {})
						})
					} catch {
						// Best effort only.
					}
				}

				if (typeof startDebugServer === 'function') {
					startDebugServer().catch((err: unknown) => {
						console.warn(
							'[unrag:debug] Failed to start debug server:',
							err instanceof Error ? err.message : String(err)
						)
					})
				}
			})
			.catch(() => {
				// Debug battery not installed - silently ignore
			})
	}

	async ingest(input: IngestInput): Promise<IngestResult> {
		return ingest(this.config, input)
	}

	/**
	 * Dry-run for ingestion. Returns which assets would be processed and by which extractors,
	 * without calling external services.
	 *
	 * Note: chunk counts/embeddings are not produced in dry-run.
	 */
	async planIngest(input: IngestInput): Promise<IngestPlanResult> {
		return planIngest(this.config, input)
	}

	async retrieve(input: RetrieveInput): Promise<RetrieveResult> {
		return retrieve(this.config, input)
	}

	/**
	 * Rerank retrieved candidates using the configured reranker.
	 *
	 * This is an explicit second-stage ranking step that can improve precision
	 * by reordering candidates based on a more expensive relevance model.
	 *
	 * @example
	 * ```ts
	 * const retrieved = await engine.retrieve({ query, topK: 30 });
	 * const reranked = await engine.rerank({
	 *   query,
	 *   candidates: retrieved.chunks,
	 *   topK: 8,
	 * });
	 * ```
	 */
	async rerank(input: RerankInput): Promise<RerankResult> {
		return rerank(this.config, input)
	}

	async delete(input: DeleteInput): Promise<void> {
		return deleteDocuments(this.config, input)
	}

	/**
	 * Consume a connector stream and apply its events to this engine.
	 *
	 * This is a convenience wrapper around `runConnectorStream(...)` so callers
	 * can use `engine.runConnectorStream({ stream, ... })` directly.
	 */
	async runConnectorStream<TCheckpoint = unknown>(
		options: Omit<RunConnectorStreamOptions<TCheckpoint>, 'engine'>
	): Promise<RunConnectorStreamResult<TCheckpoint>> {
		return runConnectorStream({
			engine: this,
			...options
		})
	}

	/**
	 * Minimal, safe-to-expose debug info for the debug panel "Doctor" tab.
	 * Avoids leaking secrets while still enabling actionable diagnostics.
	 */
	getDebugInfo(): {
		embedding: {
			name: string
			dimensions?: number
			supportsBatch: boolean
			supportsImage: boolean
		}
		storage: {
			storeChunkContent: boolean
			storeDocumentContent: boolean
		}
		defaults: {
			chunkSize: number
			chunkOverlap: number
		}
		extractorsCount: number
		reranker?: {name: string}
	} {
		return {
			embedding: {
				name: this.config.embedding.name,
				dimensions: this.config.embedding.dimensions,
				supportsBatch:
					typeof this.config.embedding.embedMany === 'function',
				supportsImage:
					typeof this.config.embedding.embedImage === 'function'
			},
			storage: {
				storeChunkContent: Boolean(
					this.config.storage.storeChunkContent
				),
				storeDocumentContent: Boolean(
					this.config.storage.storeDocumentContent
				)
			},
			defaults: {
				chunkSize: this.config.defaults.chunkSize,
				chunkOverlap: this.config.defaults.chunkOverlap
			},
			extractorsCount: this.config.extractors.length,
			reranker: this.config.reranker
				? {name: this.config.reranker.name}
				: undefined
		}
	}
}

export const createContextEngine = (config: ContextEngineConfig) =>
	new ContextEngine(config)

export {defineConfig}

/**
 * Ergonomic, higher-level config wrapper.
 *
 * This helps keep `unrag.config.ts` as a single source of truth while still
 * allowing runtime wiring (DB client/store, optional extractors).
 */
export const defineUnragConfig = <T extends DefineUnragConfigInput>(
	config: T
) => {
	let embeddingProvider: EmbeddingProvider | undefined

	const getEmbeddingProvider = () => {
		if (embeddingProvider) {
			return embeddingProvider
		}
		embeddingProvider = createEmbeddingProviderFromConfig(config.embedding)
		return embeddingProvider
	}

	const defaults = {
		chunking: config.defaults?.chunking ?? {},
		embedding: config.defaults?.embedding ?? {},
		retrieval: {
			topK: config.defaults?.retrieval?.topK ?? 8
		}
	} as const

	const createEngineConfig = (
		runtime: UnragCreateEngineRuntime
	): ContextEngineConfig => {
		const baseExtractors = (config.engine?.extractors ??
			[]) as AssetExtractor[]
		const extractors =
			typeof runtime.extractors === 'function'
				? runtime.extractors(baseExtractors)
				: (runtime.extractors ?? baseExtractors)

		return defineConfig({
			...(config.engine ?? {}),
			defaults: defaults.chunking,
			embeddingProcessing: {
				...(defaults.embedding ?? {}),
				...(config.engine?.embeddingProcessing ?? {})
			},
			embedding: getEmbeddingProvider(),
			store: runtime.store,
			extractors
		})
	}

	return {
		defaults,
		createEngineConfig,
		createEngine: (runtime: UnragCreateEngineRuntime) =>
			new ContextEngine(createEngineConfig(runtime))
	}
}
