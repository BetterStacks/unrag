import type {EmbeddingProvider} from '@unrag/core/types'
import {requireOptional} from '@unrag/embedding/_shared'
import {type EmbeddingModel, embed, embedMany} from 'ai'

/**
 * Azure OpenAI provider module interface.
 */
interface AzureModule {
	azure: {
		embedding: (model: string) => EmbeddingModel
	}
}

export type AzureEmbeddingConfig = {
	model?: string
	timeoutMs?: number
	dimensions?: number
	user?: string
}

const DEFAULT_TEXT_MODEL = 'text-embedding-3-small'

const buildProviderOptions = (config: AzureEmbeddingConfig) => {
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

export const createAzureEmbeddingProvider = (
	config: AzureEmbeddingConfig = {}
): EmbeddingProvider => {
	const {azure} = requireOptional<AzureModule>({
		id: '@ai-sdk/azure',
		installHint: 'bun add @ai-sdk/azure',
		providerName: 'azure'
	})
	const model =
		config.model ?? process.env.AZURE_EMBEDDING_MODEL ?? DEFAULT_TEXT_MODEL
	const timeoutMs = config.timeoutMs
	const providerOptions = buildProviderOptions(config)
	const embeddingModel = azure.embedding(model)

	return {
		name: `azure:${model}`,
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
				throw new Error('Embedding missing from Azure OpenAI response')
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
					'Embeddings missing from Azure OpenAI embedMany response'
				)
			}
			return embeddings
		}
	}
}
