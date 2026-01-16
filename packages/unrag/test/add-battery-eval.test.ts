import {test, expect, describe, beforeEach, afterEach} from 'bun:test'
import path from 'node:path'
import {mkdir, rm, writeFile, readFile} from 'node:fs/promises'
import {addCommand} from '@cli/commands/add'

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

describe('unrag add battery eval', () => {
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

	test('vendors eval battery and generates scaffolding + scripts', async () => {
		await writeJson(path.join(runDir, 'package.json'), {
			name: 'proj',
			private: true,
			type: 'module',
			dependencies: {},
			scripts: {}
		})

		await writeJson(path.join(runDir, 'unrag.json'), {
			installDir: 'lib/unrag',
			storeAdapter: 'raw-sql',
			aliasBase: '@unrag',
			version: 1,
			batteries: []
		})

		process.chdir(runDir)
		await addCommand(['battery', 'eval', '--yes', '--no-install'])

		expect(
			await pathExists(path.join(runDir, 'lib/unrag/eval/index.ts'))
		).toBe(true)
		expect(
			await pathExists(
				path.join(runDir, '.unrag/eval/datasets/sample.json')
			)
		).toBe(true)
		expect(
			await pathExists(path.join(runDir, '.unrag/eval/config.json'))
		).toBe(true)
		expect(
			await pathExists(path.join(runDir, 'scripts/unrag-eval.ts'))
		).toBe(true)

		const pkg = await readJson<{scripts?: Record<string, string>}>(
			path.join(runDir, 'package.json')
		)
		expect(pkg.scripts?.['unrag:eval']).toContain('scripts/unrag-eval.ts')
		expect(pkg.scripts?.['unrag:eval:ci']).toContain('--ci')

		const cfg = await readJson<{batteries?: string[]}>(
			path.join(runDir, 'unrag.json')
		)
		expect(cfg.batteries).toEqual(['eval'])
	})
})
