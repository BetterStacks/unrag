import {expect, test} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {run} from '@cli/run'

test('unrag --version prints the CLI package version', async () => {
	const pkgRaw = await readFile(`${process.cwd()}/package.json`, 'utf8')
	const pkg = JSON.parse(pkgRaw) as {version?: string}
	if (typeof pkg.version !== 'string' || !pkg.version) {
		throw new Error('package.json version is missing')
	}

	let out = ''
	const originalWrite = process.stdout.write
	try {
		process.stdout.write = ((chunk: string | Uint8Array) => {
			out +=
				typeof chunk === 'string'
					? chunk
					: Buffer.from(chunk).toString('utf8')
			return true
		}) as typeof process.stdout.write

		await run(['node', 'unrag', '--version'])
	} finally {
		process.stdout.write = originalWrite
	}

	expect(out.trim()).toBe(pkg.version)
})
