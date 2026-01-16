import {embed, embedMany, type EmbeddingModel} from 'ai'
import type {EmbeddingProvider} from '@registry/core/types'
import {requireOptional} from '@registry/embedding/_shared'

/**
 * OpenAI provider module interface.
 */
interface OpenAiModule {
	openai: {
		embedding: (model: string) => EmbeddingModel
	}
}

export type OpenAiEmbeddingConfig = {
	model?: string
	timeoutMs?: number
	dimensions?: number
	user?: string
}

const DEFAULT_TEXT_MODEL = 'text-embedding-3-small'

const buildProviderOptions = (config: OpenAiEmbeddingConfig) => {
	if (config.dimensions === undefined && config.user === undefined) {
		return undefined
	}
	return {
		openai: {
			...(config.dimensions !== undefined
				? {dimensions: config.dimensions}
				: {}),
			...(config.user ? {user: config.user} : {})
		}
	}
}

export const createOpenAiEmbeddingProvider = (
	config: OpenAiEmbeddingConfig = {}
): EmbeddingProvider => {
	const {openai} = requireOptional<OpenAiModule>({
		id: '@ai-sdk/openai',
		installHint: 'bun add @ai-sdk/openai',
		providerName: 'openai'
	})
	const model =
		config.model ?? process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_TEXT_MODEL
	const timeoutMs = config.timeoutMs
	const providerOptions = buildProviderOptions(config)
	const embeddingModel = openai.embedding(model)

	return {
		name: `openai:${model}`,
		dimensions: config.dimensions,
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
				throw new Error('Embedding missing from OpenAI response')
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
					'Embeddings missing from OpenAI embedMany response'
				)
			}
			return embeddings
		}
	}
}
