import {spawn} from 'node:child_process'
import {mkdir, readdir, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type {AssetExtractor} from '@registry/core/types'
import {getAssetBytes} from '@registry/extractors/_shared/fetch'
import {capText} from '@registry/extractors/_shared/text'

const run = async (cmd: string, args: string[], opts: {cwd: string}) => {
	return await new Promise<{stdout: string; stderr: string}>(
		(resolve, reject) => {
			const child = spawn(cmd, args, {
				cwd: opts.cwd,
				stdio: ['ignore', 'pipe', 'pipe']
			})
			let stdout = ''
			let stderr = ''
			child.stdout.on('data', (d) => (stdout += d.toString()))
			child.stderr.on('data', (d) => (stderr += d.toString()))
			child.on('error', reject)
			child.on('close', (code) => {
				if (code === 0) return resolve({stdout, stderr})
				reject(
					new Error(
						`${cmd} exited with code ${code}\n${stderr}`.trim()
					)
				)
			})
		}
	)
}

/**
 * Worker-only PDF OCR extractor.
 *
 * This extractor expects external binaries to be available:
 * - `pdftoppm` (Poppler) to rasterize pages
 * - `tesseract` to OCR rasterized images
 *
 * It is intentionally not serverless-friendly.
 */
export function createPdfOcrExtractor(): AssetExtractor {
	return {
		name: 'pdf:ocr',
		supports: ({asset, ctx}) =>
			asset.kind === 'pdf' && ctx.assetProcessing.pdf.ocr.enabled,
		extract: async ({asset, ctx}) => {
			const cfg = ctx.assetProcessing.pdf.ocr
			const fetchConfig = ctx.assetProcessing.fetch

			const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes)
			const {bytes} = await getAssetBytes({
				data: asset.data,
				fetchConfig,
				maxBytes,
				defaultMediaType: 'application/pdf'
			})

			const tmpDir = path.join(
				os.tmpdir(),
				`unrag-pdf-ocr-${crypto.randomUUID()}`
			)
			await mkdir(tmpDir, {recursive: true})

			try {
				const pdfPath = path.join(tmpDir, 'input.pdf')
				await writeFile(pdfPath, bytes)

				const prefix = path.join(tmpDir, 'page')
				const pdftoppm = cfg.pdftoppmPath ?? 'pdftoppm'
				const dpi = cfg.dpi ?? 200

				const pdftoppmArgs = [
					'-png',
					'-r',
					String(dpi),
					'-f',
					'1',
					...(cfg.maxPages ? ['-l', String(cfg.maxPages)] : []),
					pdfPath,
					prefix
				]

				await run(pdftoppm, pdftoppmArgs, {cwd: tmpDir})

				const files = (await readdir(tmpDir)).filter((f) =>
					/^page-\d+\.png$/.test(f)
				)

				// Sort by page number: page-1.png, page-2.png, ...
				files.sort((a, b) => {
					const na = Number(a.match(/^page-(\d+)\.png$/)?.[1] ?? 0)
					const nb = Number(b.match(/^page-(\d+)\.png$/)?.[1] ?? 0)
					return na - nb
				})

				const tesseract = cfg.tesseractPath ?? 'tesseract'
				const lang = cfg.lang ?? 'eng'

				let out = ''
				for (const f of files) {
					const imgPath = path.join(tmpDir, f)
					const {stdout} = await run(
						tesseract,
						[imgPath, 'stdout', '-l', lang],
						{cwd: tmpDir}
					)
					const text = String(stdout ?? '').trim()
					if (text) {
						out += (out ? '\n\n' : '') + text
					}
					if (out.length >= cfg.maxOutputChars) {
						break
					}
				}

				out = capText(out.trim(), cfg.maxOutputChars)
				if (out.length < cfg.minChars) {
					return {texts: []}
				}

				return {
					texts: [
						{
							label: 'ocr',
							content: out
						}
					]
				}
			} finally {
				await rm(tmpDir, {recursive: true, force: true})
			}
		}
	}
}
