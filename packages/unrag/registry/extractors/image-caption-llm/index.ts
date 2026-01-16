import type {AssetExtractor} from '@registry/core/types'
import {getAssetBytes} from '@registry/extractors/_shared/fetch'
import {normalizeMediaType} from '@registry/extractors/_shared/media'
import {capText} from '@registry/extractors/_shared/text'
import {type LanguageModel, generateText} from 'ai'

/**
 * Model reference type that accepts both string gateway IDs and LanguageModel instances.
 */
type ModelRef = string | LanguageModel

/**
 * Caption generation for images via a vision-capable LLM.
 *
 * Useful when you want text-based retrieval for images but the source system does not provide captions/alt text.
 */
export function createImageCaptionLlmExtractor(): AssetExtractor {
	return {
		name: 'image:caption-llm',
		supports: ({asset, ctx}) =>
			asset.kind === 'image' &&
			ctx.assetProcessing.image.captionLlm.enabled,
		extract: async ({asset, ctx}) => {
			const cfg = ctx.assetProcessing.image.captionLlm
			const fetchConfig = ctx.assetProcessing.fetch

			const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes)
			const {bytes, mediaType} = await getAssetBytes({
				data: asset.data,
				fetchConfig,
				maxBytes,
				defaultMediaType: 'image/jpeg'
			})

			const abortSignal = AbortSignal.timeout(cfg.timeoutMs)

			const result = await generateText({
				model: cfg.model as ModelRef,
				abortSignal,
				messages: [
					{
						role: 'user',
						content: [
							{type: 'text', text: cfg.prompt},
							{
								type: 'image',
								image: bytes,
								mediaType: normalizeMediaType(mediaType)
							}
						]
					}
				]
			})

			const caption = (result.text ?? '').trim()
			if (!caption) {
				return {texts: [], diagnostics: {model: cfg.model}}
			}

			return {
				texts: [
					{
						label: 'caption',
						content: capText(caption, cfg.maxOutputChars)
					}
				],
				diagnostics: {model: cfg.model}
			}
		}
	}
}
