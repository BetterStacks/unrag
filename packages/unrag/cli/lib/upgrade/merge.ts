import {spawn} from 'node:child_process'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export type MergeResult = {
	mergedText: string
	hadConflict: boolean
	usedGit: boolean
}

type MergeInput = {
	base: string
	ours: string
	theirs: string
}

const runGitMergeFile = async (input: MergeInput): Promise<MergeResult> => {
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'unrag-merge-'))
	try {
		const basePath = path.join(tmpDir, 'base.txt')
		const oursPath = path.join(tmpDir, 'ours.txt')
		const theirsPath = path.join(tmpDir, 'theirs.txt')
		await writeFile(basePath, input.base, 'utf8')
		await writeFile(oursPath, input.ours, 'utf8')
		await writeFile(theirsPath, input.theirs, 'utf8')

		const result = await new Promise<{
			code: number | null
			stdout: string
			stderr: string
		}>((resolve, reject) => {
			const child = spawn(
				'git',
				['merge-file', '-p', oursPath, basePath, theirsPath],
				{stdio: ['ignore', 'pipe', 'pipe']}
			)
			let stdout = ''
			let stderr = ''
			child.stdout.on('data', (chunk) => {
				stdout += chunk.toString()
			})
			child.stderr.on('data', (chunk) => {
				stderr += chunk.toString()
			})
			child.on('error', (err) => reject(err))
			child.on('close', (code) => resolve({code, stdout, stderr}))
		})

		if (result.code === 0) {
			return {
				mergedText: result.stdout,
				hadConflict: false,
				usedGit: true
			}
		}
		if (result.code === 1) {
			return {
				mergedText: result.stdout,
				hadConflict: true,
				usedGit: true
			}
		}
		throw new Error(
			`git merge-file failed: ${result.stderr || result.code || 'unknown'}`
		)
	} finally {
		await rm(tmpDir, {recursive: true, force: true})
	}
}

const fallbackMerge = (input: MergeInput): MergeResult => {
	if (input.ours === input.theirs) {
		return {
			mergedText: input.ours,
			hadConflict: false,
			usedGit: false
		}
	}
	if (input.ours === input.base) {
		return {
			mergedText: input.theirs,
			hadConflict: false,
			usedGit: false
		}
	}
	if (input.theirs === input.base) {
		return {
			mergedText: input.ours,
			hadConflict: false,
			usedGit: false
		}
	}
	return {
		mergedText: [
			'<<<<<<< ours',
			input.ours,
			'=======',
			input.theirs,
			'>>>>>>> theirs',
			''
		].join('\n'),
		hadConflict: true,
		usedGit: false
	}
}

export const mergeThreeWay = async (
	input: MergeInput
): Promise<MergeResult> => {
	try {
		return await runGitMergeFile(input)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		if (msg.includes('ENOENT') || msg.includes('spawn git')) {
			return fallbackMerge(input)
		}
		return fallbackMerge(input)
	}
}
