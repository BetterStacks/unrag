import type {EmbeddingProvider} from '@unrag/core/types'
import {requireOptional} from '@unrag/embedding/_shared'
import {type EmbeddingModel, embed, embedMany} from 'ai'

/**
 * Together AI provider module interface.
 */
interface TogetherAiModule {
	togetherai: {
		embeddingModel?: (model: string) => EmbeddingModel
		textEmbeddingModel?: (model: string) => EmbeddingModel
	}
}

export type TogetherEmbeddingConfig = {
	model?: string
	timeoutMs?: number
}

const DEFAULT_TEXT_MODEL = 'togethercomputer/m2-bert-80M-2k-retrieval'

export const createTogetherEmbeddingProvider = (
	config: TogetherEmbeddingConfig = {}
): EmbeddingProvider => {
	const {togetherai} = requireOptional<TogetherAiModule>({
		id: '@ai-sdk/togetherai',
		installHint: 'bun add @ai-sdk/togetherai',
		providerName: 'together'
	})
	const model =
		config.model ??
		process.env.TOGETHER_AI_EMBEDDING_MODEL ??
		DEFAULT_TEXT_MODEL
	const timeoutMs = config.timeoutMs
	const embeddingModel =
		typeof togetherai.embeddingModel === 'function'
			? togetherai.embeddingModel(model)
			: togetherai.textEmbeddingModel?.(model)

	if (!embeddingModel) {
		throw new Error('Together.ai embedding model function not available')
	}

	return {
		name: `together:${model}`,
		dimensions: undefined,
		embed: async ({text}) => {
			const abortSignal = timeoutMs
				? AbortSignal.timeout(timeoutMs)
				: undefined

			const result = await embed({
				model: embeddingModel,
				value: text,
				...(abortSignal ? {abortSignal} : {})
			})

			if (!result.embedding) {
				throw new Error('Embedding missing from Together.ai response')
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
				...(abortSignal ? {abortSignal} : {})
			})

			const {embeddings} = result
			if (!Array.isArray(embeddings)) {
				throw new Error(
					'Embeddings missing from Together.ai embedMany response'
				)
			}
			return embeddings
		}
	}
}
