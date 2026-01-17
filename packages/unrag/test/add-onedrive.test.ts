import {afterEach, beforeEach, describe, expect, test} from 'bun:test'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {addCommand} from '@cli/commands/add'

const workspaceTmpRoot = path.join(process.cwd(), 'tmp', 'test-runs')

async function writeJson(filePath: string, data: unknown) {
	await mkdir(path.dirname(filePath), {recursive: true})
	await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
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

describe('unrag add onedrive', () => {
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

	test('installs connector files and updates config', async () => {
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
			connectors: []
		})

		process.chdir(runDir)
		await addCommand(['onedrive', '--yes', '--no-install'])

		expect(
			await pathExists(
				path.join(runDir, 'lib/unrag/connectors/onedrive/index.ts')
			)
		).toBe(true)

		const pkg = await readJson<{dependencies?: Record<string, string>}>(
			path.join(runDir, 'package.json')
		)
		expect(pkg.dependencies ?? {}).toEqual({})

		const cfg = await readJson<{connectors?: string[]}>(
			path.join(runDir, 'unrag.json')
		)
		expect(cfg.connectors).toEqual(['onedrive'])
	})
})
