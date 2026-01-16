import {generateText, type LanguageModel} from 'ai'
import type {
	AssetData,
	AssetExtractor,
	AssetFetchConfig
} from '@registry/core/types'
import {getAssetBytes} from '@registry/extractors/_shared/fetch'
import {normalizeMediaType} from '@registry/extractors/_shared/media'
import {capText} from '@registry/extractors/_shared/text'

/**
 * Model reference type that accepts both string gateway IDs and LanguageModel instances.
 */
type ModelRef = string | LanguageModel

async function getPdfBytes(args: {
	data: AssetData
	fetchConfig: AssetFetchConfig
	maxBytes: number
}): Promise<{bytes: Uint8Array; mediaType: string; filename?: string}> {
	return await getAssetBytes({
		data: args.data,
		fetchConfig: args.fetchConfig,
		maxBytes: args.maxBytes,
		defaultMediaType: 'application/pdf'
	})
}

/**
 * PDF text extraction via LLM (default model: Gemini via AI Gateway).
 *
 * This extractor reads its configuration from `assetProcessing.pdf.llmExtraction`.
 */
export function createPdfLlmExtractor(): AssetExtractor {
	return {
		name: 'pdf:llm',
		supports: ({asset, ctx}) =>
			asset.kind === 'pdf' &&
			ctx.assetProcessing.pdf.llmExtraction.enabled,
		extract: async ({asset, ctx}) => {
			const llm = ctx.assetProcessing.pdf.llmExtraction
			const fetchConfig = ctx.assetProcessing.fetch

			if (!llm.enabled) {
				return {texts: []}
			}

			const maxBytes = Math.min(llm.maxBytes, fetchConfig.maxBytes)
			const {bytes, mediaType, filename} = await getPdfBytes({
				data: asset.data,
				fetchConfig,
				maxBytes
			})

			if (bytes.byteLength > maxBytes) {
				throw new Error(
					`PDF too large (${bytes.byteLength} > ${maxBytes})`
				)
			}

			const abortSignal = AbortSignal.timeout(llm.timeoutMs)

			const result = await generateText({
				// String model IDs are supported for AI Gateway routing.
				model: llm.model as ModelRef,
				abortSignal,
				messages: [
					{
						role: 'user',
						content: [
							{type: 'text', text: llm.prompt},
							{
								type: 'file',
								data: bytes,
								mediaType:
									normalizeMediaType(mediaType) ??
									'application/pdf',
								...(filename ? {filename} : {})
							}
						]
					}
				]
			})

			const text = (result.text ?? '').trim()
			if (!text) return {texts: [], diagnostics: {model: llm.model}}

			const capped = capText(text, llm.maxOutputChars)

			return {
				texts: [{label: 'fulltext', content: capped}],
				diagnostics: {model: llm.model}
			}
		}
	}
}
