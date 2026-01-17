import type {AssetExtractor} from '@registry/core/types'
import {getAssetBytes} from '@registry/extractors/_shared/fetch'
import {
	extFromFilename,
	normalizeMediaType
} from '@registry/extractors/_shared/media'
import {capText} from '@registry/extractors/_shared/text'

/**
 * Minimal mammoth module interface.
 */
interface MammothModule {
	extractRawText(options: {arrayBuffer: ArrayBuffer}): Promise<{
		value?: string
	}>
}

const DOCX_MEDIA =
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function createFileDocxExtractor(): AssetExtractor {
	return {
		name: 'file:docx',
		supports: ({asset, ctx}) => {
			if (asset.kind !== 'file') {
				return false
			}
			if (!ctx.assetProcessing.file.docx.enabled) {
				return false
			}
			const filename =
				asset.data.kind === 'bytes'
					? asset.data.filename
					: asset.data.filename
			const ext = extFromFilename(filename)
			const mt =
				asset.data.kind === 'bytes'
					? normalizeMediaType(asset.data.mediaType)
					: normalizeMediaType(asset.data.mediaType)
			return ext === 'docx' || mt === DOCX_MEDIA
		},
		extract: async ({asset, ctx}) => {
			const cfg = ctx.assetProcessing.file.docx
			const fetchConfig = ctx.assetProcessing.fetch

			const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes)
			const {bytes} = await getAssetBytes({
				data: asset.data,
				fetchConfig,
				maxBytes,
				defaultMediaType: DOCX_MEDIA
			})

			// Dynamic import so the core package can be used without mammoth unless this extractor is installed.
			const mammoth = (await import('mammoth')) as MammothModule
			// Ensure ArrayBuffer (not SharedArrayBuffer) for mammoth's API surface.
			const arrayBuffer = bytes.slice().buffer
			const res = await mammoth.extractRawText({arrayBuffer})

			const text = String(res?.value ?? '').trim()
			if (text.length < cfg.minChars) {
				return {texts: []}
			}

			return {
				texts: [
					{label: 'docx', content: capText(text, cfg.maxOutputChars)}
				]
			}
		}
	}
}
