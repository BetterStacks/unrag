import type {EmbeddingProvider} from '@unrag/core/types'
import {requireOptional} from '@unrag/embedding/_shared'
import {type EmbeddingModel, embed, embedMany} from 'ai'

/**
 * Mistral provider module interface.
 */
interface MistralModule {
	mistral: {
		embedding: (model: string) => EmbeddingModel
	}
}

export type MistralEmbeddingConfig = {
	model?: string
	timeoutMs?: number
}

const DEFAULT_TEXT_MODEL = 'mistral-embed'

export const createMistralEmbeddingProvider = (
	config: MistralEmbeddingConfig = {}
): EmbeddingProvider => {
	const {mistral} = requireOptional<MistralModule>({
		id: '@ai-sdk/mistral',
		installHint: 'bun add @ai-sdk/mistral',
		providerName: 'mistral'
	})
	const model =
		config.model ??
		process.env.MISTRAL_EMBEDDING_MODEL ??
		DEFAULT_TEXT_MODEL
	const timeoutMs = config.timeoutMs
	const embeddingModel = mistral.embedding(model)

	return {
		name: `mistral:${model}`,
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
				throw new Error('Embedding missing from Mistral response')
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
					'Embeddings missing from Mistral embedMany response'
				)
			}
			return embeddings
		}
	}
}
