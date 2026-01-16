import {embed, embedMany, type EmbeddingModel} from 'ai'
import type {EmbeddingProvider} from '@registry/core/types'
import {requireOptional} from '@registry/embedding/_shared'

/**
 * Vertex AI provider module interface.
 */
interface VertexModule {
	vertex: {
		embeddingModel: (model: string) => EmbeddingModel
	}
}

export type VertexEmbeddingTaskType =
	| 'SEMANTIC_SIMILARITY'
	| 'CLASSIFICATION'
	| 'CLUSTERING'
	| 'RETRIEVAL_DOCUMENT'
	| 'RETRIEVAL_QUERY'
	| 'QUESTION_ANSWERING'
	| 'FACT_VERIFICATION'
	| 'CODE_RETRIEVAL_QUERY'

export type VertexEmbeddingConfig = {
	model?: string
	timeoutMs?: number
	outputDimensionality?: number
	taskType?: VertexEmbeddingTaskType
	title?: string
	autoTruncate?: boolean
}

const DEFAULT_TEXT_MODEL = 'text-embedding-004'

const buildProviderOptions = (config: VertexEmbeddingConfig) => {
	if (
		config.outputDimensionality === undefined &&
		!config.taskType &&
		config.autoTruncate === undefined &&
		!config.title
	) {
		return undefined
	}
	return {
		google: {
			...(config.outputDimensionality !== undefined
				? {outputDimensionality: config.outputDimensionality}
				: {}),
			...(config.taskType ? {taskType: config.taskType} : {}),
			...(config.autoTruncate !== undefined
				? {autoTruncate: config.autoTruncate}
				: {}),
			...(config.title ? {title: config.title} : {})
		}
	}
}

export const createVertexEmbeddingProvider = (
	config: VertexEmbeddingConfig = {}
): EmbeddingProvider => {
	const {vertex} = requireOptional<VertexModule>({
		id: '@ai-sdk/google-vertex',
		installHint: 'bun add @ai-sdk/google-vertex',
		providerName: 'vertex'
	})
	const model =
		config.model ??
		process.env.GOOGLE_VERTEX_EMBEDDING_MODEL ??
		DEFAULT_TEXT_MODEL
	const timeoutMs = config.timeoutMs
	const providerOptions = buildProviderOptions(config)
	const embeddingModel = vertex.embeddingModel(model)

	return {
		name: `vertex:${model}`,
		dimensions: config.outputDimensionality,
		embed: async ({text}) => {
			const abortSignal = timeoutMs
				? AbortSignal.timeout(timeoutMs)
				: undefined

			const result = await embed({
				model: embeddingModel,
				value: text,
				...(providerOptions ? {providerOptions} : {}),
				...(abortSignal ? {abortSignal} : {})
			})

			if (!result.embedding) {
				throw new Error('Embedding missing from Vertex response')
			}

			return result.embedding
		},
		embedMany: async (inputs) => {
			const values = inputs.map((i) => i.text)
			const abortSignal = timeoutMs
				? AbortSignal.timeout(timeoutMs)
				: undefined

			const result = await embedMany({
				model: embeddingModel,
				values,
				...(providerOptions ? {providerOptions} : {}),
				...(abortSignal ? {abortSignal} : {})
			})

			const {embeddings} = result
			if (!Array.isArray(embeddings)) {
				throw new Error(
					'Embeddings missing from Vertex embedMany response'
				)
			}
			return embeddings
		}
	}
}
