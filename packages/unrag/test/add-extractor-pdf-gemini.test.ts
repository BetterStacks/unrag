import {test, expect, describe, beforeEach, afterEach} from 'bun:test'
import path from 'node:path'
import {mkdir, rm, writeFile, readFile} from 'node:fs/promises'
import {addCommand} from '@cli/commands/add'
import {initCommand} from '@cli/commands/init'

const workspaceTmpRoot = path.join(process.cwd(), 'tmp', 'test-runs')

async function writeJson(filePath: string, data: unknown) {
	await mkdir(path.dirname(filePath), {recursive: true})
	await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

async function readJson<T>(filePath: string): Promise<T> {
	const raw = await readFile(filePath, 'utf8')
	return JSON.parse(raw) as T
}

async function pathExists(p: string) {
	try {
		await readFile(p)
		return true
	} catch {
		return false
	}
}

describe('unrag add extractor pdf-llm', () => {
	let runDir: string
	let originalCwd: string

	beforeEach(async () => {
		originalCwd = process.cwd()
		runDir = path.join(workspaceTmpRoot, crypto.randomUUID())
		await rm(runDir, {recursive: true, force: true})
		await mkdir(runDir, {recursive: true})
	})

	afterEach(async () => {
		process.chdir(originalCwd)
		await rm(runDir, {recursive: true, force: true})
	})

	const cases: Array<{
		extractor: string
		expectDeps: string[]
	}> = [
		{extractor: 'pdf-llm', expectDeps: ['ai']},
		{extractor: 'pdf-text-layer', expectDeps: ['pdfjs-dist']},
		{extractor: 'pdf-ocr', expectDeps: []},
		{extractor: 'image-ocr', expectDeps: ['ai']},
		{extractor: 'image-caption-llm', expectDeps: ['ai']},
		{extractor: 'audio-transcribe', expectDeps: ['ai']},
		{extractor: 'video-transcribe', expectDeps: ['ai']},
		{extractor: 'video-frames', expectDeps: ['ai']},
		{extractor: 'file-text', expectDeps: []},
		{extractor: 'file-docx', expectDeps: ['mammoth']},
		{extractor: 'file-pptx', expectDeps: ['jszip']},
		{extractor: 'file-xlsx', expectDeps: ['xlsx']}
	]

	for (const c of cases) {
		test(`installs extractor (${c.extractor}) files and records into unrag.json`, async () => {
			await writeJson(path.join(runDir, 'package.json'), {
				name: 'proj',
				private: true,
				type: 'module',
				dependencies: {}
			})

			await writeJson(path.join(runDir, 'unrag.json'), {
				installDir: 'lib/unrag',
				storeAdapter: 'raw-sql',
				aliasBase: '@unrag',
				version: 1,
				connectors: [],
				extractors: []
			})

			process.chdir(runDir)
			await addCommand([
				'extractor',
				c.extractor,
				'--yes',
				'--no-install'
			])

			expect(
				await pathExists(
					path.join(
						runDir,
						`lib/unrag/extractors/${c.extractor}/index.ts`
					)
				)
			).toBe(true)

			// Shared extractor utilities should be installed alongside any extractor.
			expect(
				await pathExists(
					path.join(runDir, 'lib/unrag/extractors/_shared/fetch.ts')
				)
			).toBe(true)

			const cfg = await readJson<{extractors?: string[]}>(
				path.join(runDir, 'unrag.json')
			)
			expect(cfg.extractors).toEqual([c.extractor])

			const pkg = await readJson<{dependencies?: Record<string, string>}>(
				path.join(runDir, 'package.json')
			)
			const deps = pkg.dependencies ?? {}

			for (const depName of c.expectDeps) {
				expect(Object.keys(deps)).toContain(depName)
			}
		})
	}

	test('add extractor patches unrag.config.ts with import, registration, and enabled flags', async () => {
		await writeJson(path.join(runDir, 'package.json'), {
			name: 'proj',
			private: true,
			type: 'module',
			dependencies: {}
		})

		// First, create a minimal config via init
		process.chdir(runDir)
		await initCommand([
			'--yes',
			'--store',
			'drizzle',
			'--dir',
			'lib/unrag',
			'--no-install'
		])

		// Verify minimal config doesn't have assetProcessing
		let cfg = await readFile(path.join(runDir, 'unrag.config.ts'), 'utf8')
		expect(cfg).not.toContain('assetProcessing:')
		expect(cfg).not.toContain('createPdfTextLayerExtractor')

		// Now add an extractor
		await addCommand([
			'extractor',
			'pdf-text-layer',
			'--yes',
			'--no-install'
		])

		// Verify config was patched
		cfg = await readFile(path.join(runDir, 'unrag.config.ts'), 'utf8')
		expect(cfg).toContain(
			'import { createPdfTextLayerExtractor } from "./lib/unrag/extractors/pdf-text-layer";'
		)
		expect(cfg).toContain('createPdfTextLayerExtractor()')
		expect(cfg).toContain('assetProcessing:')
		expect(cfg).toContain('pdf:')
		expect(cfg).toContain('textLayer:')
		expect(cfg).toContain('enabled: true')
		// Should only have minimal overrides, not full tree
		expect(cfg).not.toContain('image:')
		expect(cfg).not.toContain('audio:')
	})

	test("add extractor is idempotent (doesn't duplicate imports/entries)", async () => {
		await writeJson(path.join(runDir, 'package.json'), {
			name: 'proj',
			private: true,
			type: 'module',
			dependencies: {}
		})

		process.chdir(runDir)
		await initCommand([
			'--yes',
			'--store',
			'drizzle',
			'--dir',
			'lib/unrag',
			'--no-install'
		])

		// Add extractor twice
		await addCommand(['extractor', 'file-text', '--yes', '--no-install'])
		const cfg1 = await readFile(
			path.join(runDir, 'unrag.config.ts'),
			'utf8'
		)
		const importCount1 = (cfg1.match(/createFileTextExtractor/g) || [])
			.length
		const extractorCallCount1 = (
			cfg1.match(/createFileTextExtractor\(\)/g) || []
		).length

		await addCommand(['extractor', 'file-text', '--yes', '--no-install'])
		const cfg2 = await readFile(
			path.join(runDir, 'unrag.config.ts'),
			'utf8'
		)
		const importCount2 = (cfg2.match(/createFileTextExtractor/g) || [])
			.length
		const extractorCallCount2 = (
			cfg2.match(/createFileTextExtractor\(\)/g) || []
		).length

		// Should not have duplicated
		expect(importCount2).toBe(importCount1)
		expect(extractorCallCount2).toBe(extractorCallCount1)
	})
})
