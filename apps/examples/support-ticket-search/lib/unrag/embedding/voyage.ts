import {Buffer} from 'node:buffer'
import type {EmbeddingProvider, ImageEmbeddingInput} from '@unrag/core/types'
import {requireOptional} from '@unrag/embedding/_shared'
import {type EmbeddingModel, embed, embedMany} from 'ai'

/**
 * Voyage AI provider module interface.
 */
interface VoyageModule {
	voyage: {
		embeddingModel?: (model: string) => EmbeddingModel
		textEmbeddingModel?: (model: string) => EmbeddingModel
		multimodalEmbeddingModel?: (model: string) => EmbeddingModel
	}
}

type BaseConfig = {
	model?: string
	timeoutMs?: number
}

type VoyageMultimodalTextValue = {
	text: string[]
}

type VoyageMultimodalImageValue = {
	image: string[]
}

type VoyageTextConfig = BaseConfig & {
	type?: 'text'
}

type VoyageMultimodalConfig = BaseConfig & {
	type: 'multimodal'
	text?: {
		value?: (text: string) => VoyageMultimodalTextValue
	}
	image?: {
		value?: (input: ImageEmbeddingInput) => VoyageMultimodalImageValue
	}
}

export type VoyageEmbeddingConfig = VoyageTextConfig | VoyageMultimodalConfig

const DEFAULT_TEXT_MODEL = 'voyage-3.5-lite'
const DEFAULT_MULTIMODAL_MODEL = 'voyage-multimodal-3'

const bytesToDataUrl = (bytes: Uint8Array, mediaType: string) => {
	const base64 = Buffer.from(bytes).toString('base64')
	return `data:${mediaType};base64,${base64}`
}

const defaultTextValue = (text: string) => ({
	text: [text]
})

const defaultImageValue = (input: ImageEmbeddingInput) => {
	const v =
		typeof input.data === 'string'
			? input.data
			: bytesToDataUrl(input.data, input.mediaType ?? 'image/jpeg')
	return {image: [v]}
}

type EmbedFnInput = Parameters<typeof embed>[0]
type EmbedManyFnInput = Parameters<typeof embedMany>[0]

type UnsafeEmbedInput = Omit<EmbedFnInput, 'value'> & {value: unknown}
type UnsafeEmbedManyInput = Omit<EmbedManyFnInput, 'values'> & {
	values: readonly unknown[]
}

async function unsafeEmbed(args: UnsafeEmbedInput) {
	return embed(args as EmbedFnInput)
}

async function unsafeEmbedMany(args: UnsafeEmbedManyInput) {
	return embedMany(args as EmbedManyFnInput)
}

export const createVoyageEmbeddingProvider = (
	config: VoyageEmbeddingConfig = {}
): EmbeddingProvider => {
	const {voyage} = requireOptional<VoyageModule>({
		id: 'voyage-ai-provider',
		installHint: 'bun add voyage-ai-provider',
		providerName: 'voyage'
	})
	const timeoutMs = config.timeoutMs

	if (config.type === 'multimodal') {
		const model =
			config.model ?? process.env.VOYAGE_MODEL ?? DEFAULT_MULTIMODAL_MODEL
		const multimodalModel = voyage.multimodalEmbeddingModel?.(model)
		if (!multimodalModel) {
			throw new Error(
				'Voyage multimodal embedding model is unavailable. ' +
					'Ensure your installed `voyage-ai-provider` version supports multimodal embedding models.'
			)
		}

		const resolveTextValue = (text: string): VoyageMultimodalTextValue => {
			return config.text?.value
				? config.text.value(text)
				: defaultTextValue(text)
		}

		const resolveImageValue = (
			input: ImageEmbeddingInput
		): VoyageMultimodalImageValue => {
			return config.image?.value
				? config.image.value(input)
				: defaultImageValue(input)
		}

		return {
			name: `voyage:${model}`,
			dimensions: undefined,
			embed: async ({text}) => {
				const abortSignal = timeoutMs
					? AbortSignal.timeout(timeoutMs)
					: undefined

				const result = await unsafeEmbed({
					model: multimodalModel,
					value: resolveTextValue(text),
					...(abortSignal ? {abortSignal} : {})
				})

				if (!result.embedding) {
					throw new Error('Embedding missing from Voyage response')
				}

				return result.embedding
			},
			embedMany: async (inputs) => {
				const abortSignal = timeoutMs
					? AbortSignal.timeout(timeoutMs)
					: undefined

				const result = await unsafeEmbedMany({
					model: multimodalModel,
					values: inputs.map((i) => resolveTextValue(i.text)),
					...(abortSignal ? {abortSignal} : {})
				})

				const {embeddings} = result
				if (!Array.isArray(embeddings)) {
					throw new Error(
						'Embeddings missing from Voyage embedMany response'
					)
				}
				return embeddings
			},
			embedImage: async (input: ImageEmbeddingInput) => {
				const abortSignal = timeoutMs
					? AbortSignal.timeout(timeoutMs)
					: undefined

				const result = await unsafeEmbed({
					model: multimodalModel,
					value: resolveImageValue(input),
					...(abortSignal ? {abortSignal} : {})
				})

				if (!result.embedding) {
					throw new Error('Embedding missing from Voyage response')
				}

				return result.embedding
			}
		}
	}

	const model = config.model ?? process.env.VOYAGE_MODEL ?? DEFAULT_TEXT_MODEL
	const textModel =
		typeof voyage.embeddingModel === 'function'
			? voyage.embeddingModel(model)
			: voyage.textEmbeddingModel?.(model)

	if (!textModel) {
		throw new Error(
			'Voyage text embedding model is unavailable. ' +
				'Ensure your installed `voyage-ai-provider` version supports text embedding models.'
		)
	}

	return {
		name: `voyage:${model}`,
		dimensions: undefined,
		embed: async ({text}) => {
			const abortSignal = timeoutMs
				? AbortSignal.timeout(timeoutMs)
				: undefined

			const result = await embed({
				model: textModel,
				value: text,
				...(abortSignal ? {abortSignal} : {})
			})

			if (!result.embedding) {
				throw new Error('Embedding missing from Voyage response')
			}

			return result.embedding
		},
		embedMany: async (inputs) => {
			const abortSignal = timeoutMs
				? AbortSignal.timeout(timeoutMs)
				: undefined

			const result = await embedMany({
				model: textModel,
				values: inputs.map((i) => i.text),
				...(abortSignal ? {abortSignal} : {})
			})

			const {embeddings} = result
			if (!Array.isArray(embeddings)) {
				throw new Error(
					'Embeddings missing from Voyage embedMany response'
				)
			}
			return embeddings
		}
	}
}
