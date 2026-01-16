import type {AssetExtractor} from '@registry/core/types'
import {getAssetBytes} from '@registry/extractors/_shared/fetch'
import {capText} from '@registry/extractors/_shared/text'

/**
 * Text content item from pdfjs-dist.
 */
interface PdfTextItem {
	str?: string
}

/**
 * Minimal pdfjs-dist module interface.
 */
interface PdfJsModule {
	getDocument(params: {
		data: Uint8Array
		standardFontDataUrl?: string
		cMapUrl?: string
		cMapPacked?: boolean
		useSystemFonts?: boolean
	}): {
		promise: Promise<{
			numPages: number
			getPage(pageNum: number): Promise<{
				getTextContent(): Promise<{items?: PdfTextItem[]}>
			}>
			destroy?: () => Promise<void> | void
		}>
	}
	VerbosityLevel?: {ERRORS?: number}
	setVerbosityLevel?: (level: number) => void
}

let cachedPdfJsAssetUrls: {
	standardFontDataUrl: string
	cMapUrl: string
} | null = null

async function getPdfJsAssetUrls(): Promise<{
	standardFontDataUrl: string
	cMapUrl: string
}> {
	if (cachedPdfJsAssetUrls) {
		return cachedPdfJsAssetUrls
	}

	// Lazily resolve pdfjs-dist asset dirs at runtime (Node-only).
	const {createRequire} = await import('node:module')
	const path = (await import('node:path')).default
	const {pathToFileURL} = await import('node:url')

	const require = createRequire(import.meta.url)
	const pkgJsonAbs = require.resolve('pdfjs-dist/package.json')
	const root = path.dirname(pkgJsonAbs)

	const withSlash = (p: string) => (p.endsWith(path.sep) ? p : p + path.sep)

	cachedPdfJsAssetUrls = {
		standardFontDataUrl: pathToFileURL(
			withSlash(path.join(root, 'standard_fonts'))
		).href,
		cMapUrl: pathToFileURL(withSlash(path.join(root, 'cmaps'))).href
	}

	return cachedPdfJsAssetUrls
}

/**
 * Fast/cheap PDF extraction using the PDF's built-in text layer.
 *
 * This extractor is best-effort: if the PDF has little/no embedded text (scanned PDFs),
 * it returns empty output so the pipeline can fall back to another extractor (e.g. `pdf:llm`).
 *
 * Dependencies (installed by CLI):
 * - `pdfjs-dist`
 */
export function createPdfTextLayerExtractor(): AssetExtractor {
	return {
		name: 'pdf:text-layer',
		supports: ({asset, ctx}) =>
			asset.kind === 'pdf' && ctx.assetProcessing.pdf.textLayer.enabled,
		extract: async ({asset, ctx}) => {
			const cfg = ctx.assetProcessing.pdf.textLayer
			const fetchConfig = ctx.assetProcessing.fetch

			const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes)
			const {bytes} = await getAssetBytes({
				data: asset.data,
				fetchConfig,
				maxBytes,
				defaultMediaType: 'application/pdf'
			})

			// Dynamic import so the core package can be used without pdfjs unless this extractor is installed.
			const pdfjs = (await import(
				'pdfjs-dist/legacy/build/pdf.mjs'
			)) as PdfJsModule

			// Reduce noisy PDF.js warnings in CLI usage.
			try {
				pdfjs.setVerbosityLevel?.(pdfjs.VerbosityLevel?.ERRORS ?? 0)
			} catch {
				// ignore
			}

			const {standardFontDataUrl, cMapUrl} = await getPdfJsAssetUrls()

			const doc = await pdfjs.getDocument({
				data: bytes,
				// Required by recent pdfjs-dist in Node to avoid "standardFontDataUrl" warnings.
				standardFontDataUrl,
				// Helps with PDFs using custom encodings; also reduces warning spam.
				cMapUrl,
				cMapPacked: true,
				// Prefer system fonts when available (best-effort).
				useSystemFonts: true
			}).promise

			const totalPages: number = Number(doc?.numPages ?? 0)
			const maxPages = Math.max(
				0,
				Math.min(totalPages, cfg.maxPages ?? totalPages)
			)

			const pageConcurrency = Math.max(
				1,
				Math.min(Number(ctx.assetProcessing.concurrency ?? 1) || 1, 8)
			)

			const extractPageText = async (
				pageNum: number
			): Promise<string> => {
				try {
					const page = await doc.getPage(pageNum)
					const textContent = await page.getTextContent()
					const items: PdfTextItem[] = Array.isArray(
						textContent?.items
					)
						? textContent.items
						: []
					return items
						.map((it) =>
							typeof it?.str === 'string' ? it.str : ''
						)
						.join(' ')
						.replace(/\s+/g, ' ')
						.trim()
				} catch {
					return ''
				}
			}

			let out = ''
			outer: for (
				let start = 1;
				start <= maxPages;
				start += pageConcurrency
			) {
				const end = Math.min(maxPages, start + pageConcurrency - 1)
				const texts = await Promise.all(
					Array.from({length: end - start + 1}, (_, i) =>
						extractPageText(start + i)
					)
				)

				for (const pageText of texts) {
					if (!pageText) {
						continue
					}
					out += (out ? '\n\n' : '') + pageText
					// No need to parse more pages than we can return.
					if (out.length >= cfg.maxOutputChars) {
						break outer
					}
				}
			}

			out = out.trim()
			if (out.length < cfg.minChars) {
				try {
					await doc.destroy?.()
				} catch {
					// ignore
				}
				return {texts: []}
			}

			try {
				await doc.destroy?.()
			} catch {
				// ignore
			}

			return {
				texts: [
					{
						label: 'text-layer',
						content: capText(out, cfg.maxOutputChars),
						pageRange: totalPages
							? [1, maxPages || totalPages]
							: undefined
					}
				]
			}
		}
	}
}
