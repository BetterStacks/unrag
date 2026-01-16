import {
	experimental_transcribe as transcribe,
	type TranscriptionModel
} from 'ai'
import type {AssetExtractor, ExtractedTextItem} from '@registry/core/types'
import {getAssetBytes} from '@registry/extractors/_shared/fetch'

/**
 * Model reference type that accepts both string gateway IDs and TranscriptionModel instances.
 */
type TranscriptionModelRef = string | TranscriptionModel

/**
 * Transcription segment from the AI SDK.
 */
interface TranscriptionSegment {
	text?: string
	startSecond?: number
	endSecond?: number
}

/**
 * Audio transcription via the AI SDK `transcribe()` API.
 */
export function createAudioTranscribeExtractor(): AssetExtractor {
	return {
		name: 'audio:transcribe',
		supports: ({asset, ctx}) =>
			asset.kind === 'audio' &&
			ctx.assetProcessing.audio.transcription.enabled,
		extract: async ({asset, ctx}) => {
			const cfg = ctx.assetProcessing.audio.transcription
			const fetchConfig = ctx.assetProcessing.fetch

			const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes)
			const {bytes} = await getAssetBytes({
				data: asset.data,
				fetchConfig,
				maxBytes,
				defaultMediaType: 'audio/mpeg'
			})

			const abortSignal = AbortSignal.timeout(cfg.timeoutMs)

			const result = await transcribe({
				model: cfg.model as TranscriptionModelRef,
				audio: bytes,
				abortSignal
			})

			const segments: TranscriptionSegment[] = Array.isArray(
				result.segments
			)
				? result.segments
				: []

			if (segments.length > 0) {
				const textItems: ExtractedTextItem[] = segments
					.map((s, i) => {
						const t = String(s?.text ?? '').trim()
						if (!t) return null
						const start = Number(s?.startSecond ?? NaN)
						const end = Number(s?.endSecond ?? NaN)
						return {
							label: `segment-${i + 1}`,
							content: t,
							...(Number.isFinite(start) && Number.isFinite(end)
								? {
										timeRangeSec: [start, end] as [
											number,
											number
										]
									}
								: {})
						}
					})
					.filter((item): item is ExtractedTextItem => item !== null)

				return {
					texts: textItems,
					diagnostics: {
						model: cfg.model,
						seconds:
							typeof result.durationInSeconds === 'number'
								? result.durationInSeconds
								: undefined
					}
				}
			}

			const text = (result.text ?? '').trim()
			if (!text) return {texts: [], diagnostics: {model: cfg.model}}

			return {
				texts: [{label: 'transcript', content: text}],
				diagnostics: {model: cfg.model}
			}
		}
	}
}
