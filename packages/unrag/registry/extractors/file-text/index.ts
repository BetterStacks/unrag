import type {AssetExtractor} from '@registry/core/types'
import {getAssetBytes} from '@registry/extractors/_shared/fetch'
import {
	extFromFilename,
	normalizeMediaType
} from '@registry/extractors/_shared/media'
import {capText, toUtf8String} from '@registry/extractors/_shared/text'

const stripHtml = (html: string) => {
	const withoutScripts = html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
	const withBreaks = withoutScripts
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<\/div>/gi, '\n')
	const withoutTags = withBreaks.replace(/<[^>]+>/g, ' ')
	return withoutTags
		.replace(/\s+\n/g, '\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim()
}

const isTextish = (
	mediaType: string | undefined,
	filename: string | undefined
) => {
	const mt = normalizeMediaType(mediaType)
	if (mt?.startsWith('text/')) return true
	if (mt === 'application/json') return true
	if (mt === 'application/xml') return true
	if (mt === 'application/xhtml+xml') return true

	const ext = extFromFilename(filename)
	if (!ext) return false
	return (
		ext === 'txt' ||
		ext === 'md' ||
		ext === 'markdown' ||
		ext === 'html' ||
		ext === 'htm' ||
		ext === 'json' ||
		ext === 'csv' ||
		ext === 'log' ||
		ext === 'xml'
	)
}

export function createFileTextExtractor(): AssetExtractor {
	return {
		name: 'file:text',
		supports: ({asset, ctx}) => {
			if (asset.kind !== 'file') return false
			if (!ctx.assetProcessing.file.text.enabled) return false
			const filename =
				asset.data.kind === 'bytes'
					? asset.data.filename
					: asset.data.filename
			const mediaType =
				asset.data.kind === 'bytes'
					? asset.data.mediaType
					: asset.data.mediaType
			return isTextish(mediaType, filename)
		},
		extract: async ({asset, ctx}) => {
			const cfg = ctx.assetProcessing.file.text
			const fetchConfig = ctx.assetProcessing.fetch

			const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes)
			const {bytes, mediaType, filename} = await getAssetBytes({
				data: asset.data,
				fetchConfig,
				maxBytes,
				defaultMediaType: 'text/plain'
			})

			const ext = extFromFilename(filename)
			const mt = normalizeMediaType(mediaType)

			let text = toUtf8String(bytes)

			if (
				mt === 'text/html' ||
				mt === 'application/xhtml+xml' ||
				ext === 'html' ||
				ext === 'htm'
			) {
				text = stripHtml(text)
			}

			text = text.trim()
			if (text.length < cfg.minChars) return {texts: []}

			return {
				texts: [
					{label: 'text', content: capText(text, cfg.maxOutputChars)}
				],
				metadata: {
					...(mt ? {mediaType: mt} : {}),
					...(ext ? {ext} : {})
				}
			}
		}
	}
}
