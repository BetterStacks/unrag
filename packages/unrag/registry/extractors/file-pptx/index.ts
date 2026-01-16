import type {AssetExtractor} from '@registry/core/types'
import {getAssetBytes} from '@registry/extractors/_shared/fetch'
import {
	extFromFilename,
	normalizeMediaType
} from '@registry/extractors/_shared/media'
import {capText} from '@registry/extractors/_shared/text'

/**
 * Zip file entry interface.
 */
interface ZipFile {
	async(type: 'string'): Promise<string>
}

/**
 * JSZip instance interface.
 */
interface JSZipInstance {
	files: Record<string, ZipFile>
}

/**
 * JSZip constructor interface.
 */
interface JSZipConstructor {
	loadAsync(data: Uint8Array): Promise<JSZipInstance>
}

const PPTX_MEDIA =
	'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const decodeXmlEntities = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&')

export function createFilePptxExtractor(): AssetExtractor {
	return {
		name: 'file:pptx',
		supports: ({asset, ctx}) => {
			if (asset.kind !== 'file') return false
			if (!ctx.assetProcessing.file.pptx.enabled) return false
			const filename =
				asset.data.kind === 'bytes'
					? asset.data.filename
					: asset.data.filename
			const ext = extFromFilename(filename)
			const mt =
				asset.data.kind === 'bytes'
					? normalizeMediaType(asset.data.mediaType)
					: normalizeMediaType(asset.data.mediaType)
			return ext === 'pptx' || mt === PPTX_MEDIA
		},
		extract: async ({asset, ctx}) => {
			const cfg = ctx.assetProcessing.file.pptx
			const fetchConfig = ctx.assetProcessing.fetch

			const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes)
			const {bytes} = await getAssetBytes({
				data: asset.data,
				fetchConfig,
				maxBytes,
				defaultMediaType: PPTX_MEDIA
			})

			// Dynamic import to avoid hard dependency unless installed.
			const JSZip = (await import('jszip'))
				.default as unknown as JSZipConstructor
			const zip = await JSZip.loadAsync(bytes)

			const slidePaths = Object.keys(zip.files).filter((p) =>
				/^ppt\/slides\/slide\d+\.xml$/.test(p)
			)
			slidePaths.sort((a, b) => {
				const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
				const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
				return na - nb
			})

			const texts: Array<{label: string; content: string}> = []
			let totalChars = 0

			for (const slidePath of slidePaths) {
				if (totalChars >= cfg.maxOutputChars) break

				const xml = await zip.files[slidePath]!.async('string')
				const parts: string[] = []
				const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g
				let m: RegExpExecArray | null
				while ((m = re.exec(xml))) {
					const t = decodeXmlEntities(String(m[1] ?? ''))
						.replace(/\s+/g, ' ')
						.trim()
					if (t) parts.push(t)
				}

				const slideText = parts.join(' ').trim()
				if (!slideText) continue

				const slideNum = Number(
					slidePath.match(/slide(\d+)\.xml$/)?.[1] ?? 0
				)
				const capped = capText(
					slideText,
					cfg.maxOutputChars - totalChars
				)
				if (!capped) continue

				texts.push({
					label: `slide-${slideNum || texts.length + 1}`,
					content: capped
				})
				totalChars += capped.length
			}

			const joinedChars = texts.reduce((n, t) => n + t.content.length, 0)
			if (joinedChars < cfg.minChars) return {texts: []}

			return {
				texts: texts.map((t) => ({label: t.label, content: t.content}))
			}
		}
	}
}
