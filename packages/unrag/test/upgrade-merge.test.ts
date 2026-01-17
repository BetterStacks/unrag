import {afterEach, beforeEach, describe, expect, test} from 'bun:test'
import {chmod, mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {upgradeCommand} from '@cli/commands/upgrade'
import {mergeThreeWay} from '@cli/lib/upgrade/merge'

const workspaceTmpRoot = path.join(process.cwd(), 'tmp', 'test-runs')

async function writeJson(filePath: string, data: unknown) {
	await mkdir(path.dirname(filePath), {recursive: true})
	await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function writeFakeGitBin(binDir: string, porcelainOutput: string) {
	await mkdir(binDir, {recursive: true})
	const gitPath = path.join(binDir, 'git')
	const script = `#!/usr/bin/env bash
set -euo pipefail

if [[ "\${1:-}" == "rev-parse" && "\${2:-}" == "--is-inside-work-tree" ]]; then
  echo "true"
  exit 0
fi

if [[ "\${1:-}" == "status" && "\${2:-}" == "--porcelain" ]]; then
  printf "%s" ${JSON.stringify(porcelainOutput)}
  exit 0
fi

# Default: act like git is present but do nothing.
exit 0
`
	await writeFile(gitPath, script, 'utf8')
	await chmod(gitPath, 0o755)
}

describe('mergeThreeWay', () => {
	test('fast-forward when ours equals base', async () => {
		const base = 'a\nb\n'
		const ours = 'a\nb\n'
		const theirs = 'a\nb\nc\n'
		const result = await mergeThreeWay({base, ours, theirs})
		expect(result.hadConflict).toBe(false)
		expect(result.mergedText).toContain('c')
	})

	test('conflict when both ours and theirs diverge', async () => {
		const base = 'hello\n'
		const ours = 'hello ours\n'
		const theirs = 'hello theirs\n'
		const result = await mergeThreeWay({base, ours, theirs})
		expect(result.hadConflict).toBe(true)
		expect(result.mergedText).toContain('<<<<<<<')
		expect(result.mergedText).toContain('>>>>>>>')
	})
})

describe('upgrade preflight', () => {
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

	test('refuses dirty git trees unless --allow-dirty', async () => {
		await writeJson(path.join(runDir, 'package.json'), {
			name: 'proj',
			private: true,
			type: 'module'
		})
		await writeJson(path.join(runDir, 'unrag.json'), {
			installDir: 'lib/unrag',
			storeAdapter: 'raw-sql',
			aliasBase: '@unrag',
			version: 2
		})

		const originalPath = process.env.PATH
		const fakeBin = path.join(runDir, 'bin')
		await writeFakeGitBin(fakeBin, '?? README.md\\n')
		process.env.PATH = `${fakeBin}${path.delimiter}${originalPath ?? ''}`

		process.chdir(runDir)
		let threw = false
		try {
			await upgradeCommand(['--yes', '--from-version', '0.0.0'])
		} catch (err) {
			threw = true
			expect(String(err)).toContain('uncommitted')
		}
		process.env.PATH = originalPath
		expect(threw).toBe(true)
	})

	test('requires --from-version when missing from unrag.json', async () => {
		await writeJson(path.join(runDir, 'package.json'), {
			name: 'proj',
			private: true,
			type: 'module'
		})
		await writeJson(path.join(runDir, 'unrag.json'), {
			installDir: 'lib/unrag',
			storeAdapter: 'raw-sql',
			aliasBase: '@unrag',
			version: 2
		})

		process.chdir(runDir)
		let threw = false
		try {
			await upgradeCommand(['--yes'])
		} catch (err) {
			threw = true
			expect(String(err)).toContain('from-version')
		}
		expect(threw).toBe(true)
	})
})
