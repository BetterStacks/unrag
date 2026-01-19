import {spawn} from 'node:child_process'
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {addCommand} from '../../commands/add'
import {initCommand} from '../../commands/init'
import {ensureDir, exists, listFilesRecursive} from '../fs'
import type {
	BatteryName,
	ConnectorName,
	EmbeddingProviderName,
	ExtractorName
} from '../packageJson'

type SnapshotConfig = {
	projectRoot: string
	installDir: string
	storeAdapter: 'drizzle' | 'prisma' | 'raw-sql'
	aliasBase: string
	embeddingProvider?: EmbeddingProviderName
	extractors: ExtractorName[]
	connectors: ConnectorName[]
	batteries: BatteryName[]
	full?: boolean
	withDocs?: boolean
}

export type Snapshot = {
	files: Map<string, string>
}

const toPosixPath = (p: string) => p.replace(/\\/g, '/')

type ExternalRunner = {
	cmd: string
	argsPrefix: string[]
	label: string
}

const inferExternalRunners = (): ExternalRunner[] => {
	// Note: `bunx` can execute Node-targeted CLIs without actually running the CLI in the Bun runtime.
	// In that case `process.versions.bun` is undefined, so we also look at the package-manager user agent.
	const versions = (
		process as unknown as {versions?: Record<string, unknown>}
	).versions
	const ua = (process.env.npm_config_user_agent ?? '').toLowerCase()

	const candidates: ExternalRunner[] = []

	if (typeof versions?.bun === 'string' || ua.includes('bun')) {
		candidates.push({cmd: 'bunx', argsPrefix: [], label: 'bunx'})
	}
	if (ua.includes('pnpm')) {
		candidates.push({cmd: 'pnpm', argsPrefix: ['dlx'], label: 'pnpm dlx'})
	}
	if (ua.includes('yarn')) {
		candidates.push({cmd: 'yarn', argsPrefix: ['dlx'], label: 'yarn dlx'})
	}

	// Default/fallback runner (works on Node/npm installs).
	if (process.platform === 'win32') {
		candidates.push({cmd: 'npx.cmd', argsPrefix: ['-y'], label: 'npx.cmd -y'})
	}
	candidates.push({cmd: 'npx', argsPrefix: ['-y'], label: 'npx -y'})
	// Last resort: even if we can't detect Bun, `bunx` may still be available (e.g. when this CLI
	// is being executed via `bunx`, which can sanitize PATH and hide `npx`).
	candidates.push({cmd: 'bunx', argsPrefix: [], label: 'bunx'})

	// De-dupe while preserving order.
	const seen = new Set<string>()
	return candidates.filter((c) => {
		const key = `${c.cmd} ${c.argsPrefix.join(' ')}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

const writeMinimalPackageJson = async (root: string) => {
	const pkg = {
		name: 'unrag-upgrade-snapshot',
		private: true,
		type: 'module',
		dependencies: {}
	}
	await ensureDir(root)
	await writeFile(
		path.join(root, 'package.json'),
		`${JSON.stringify(pkg, null, 2)}\n`,
		'utf8'
	)
}

const collectSnapshotFiles = async (
	projectRoot: string,
	installDir: string
): Promise<Map<string, string>> => {
	const files = new Map<string, string>()
	const installAbs = path.join(projectRoot, installDir)
	if (await exists(installAbs)) {
		const vendoredFiles = await listFilesRecursive(installAbs)
		for (const abs of vendoredFiles) {
			const rel = toPosixPath(path.relative(projectRoot, abs))
			const content = await readFile(abs, 'utf8')
			files.set(rel, content)
		}
	}
	const configAbs = path.join(projectRoot, 'unrag.config.ts')
	if (await exists(configAbs)) {
		const rel = toPosixPath(path.relative(projectRoot, configAbs))
		const content = await readFile(configAbs, 'utf8')
		files.set(rel, content)
	}
	return files
}

const runExternalUnrag = async (
	projectRoot: string,
	version: string,
	args: string[],
	options?: {verbose?: boolean}
) => {
	const verbose = Boolean(options?.verbose)

	const runners = inferExternalRunners()
	let lastSpawnErr: unknown = null

	for (const runner of runners) {
		const fullArgs = [...runner.argsPrefix, `unrag@${version}`, ...args]
		try {
			await new Promise<void>((resolve, reject) => {
				const child = spawn(runner.cmd, fullArgs, {
					cwd: projectRoot,
					stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
					env: process.env
				})
				let stdout = ''
				let stderr = ''
				if (!verbose) {
					child.stdout?.on('data', (chunk) => {
						stdout += chunk.toString()
					})
					child.stderr?.on('data', (chunk) => {
						stderr += chunk.toString()
					})
				}
				child.on('error', (err) => reject(err))
				child.on('exit', (code, signal) => {
					if (code === 0) {
						return resolve()
					}
					const combined = [stdout.trim(), stderr.trim()]
						.filter(Boolean)
						.join('\n')
					const output = combined ? `\n\nOutput:\n${combined}` : ''
					reject(
						new Error(
							`Failed to run ${runner.cmd} ${fullArgs.join(' ')} (code: ${
								code ?? 'null'
							}, signal: ${signal ?? 'null'})${output}`
						)
					)
				})
			})
			return
		} catch (err) {
			const code = (err as {code?: unknown} | null)?.code
			if (code === 'ENOENT') {
				lastSpawnErr = err
				continue
			}
			throw err
		}
	}

	const tried = runners.map((r) => r.label).join(', ')
	const details =
		lastSpawnErr instanceof Error ? `\n\nLast error: ${lastSpawnErr.message}` : ''
	throw new Error(
		`Could not find a package runner to execute unrag@${version}. Tried: ${tried}.${details}`
	)
}

const runCurrentInitAndAdds = async (
	config: SnapshotConfig,
	root: string,
	options?: {quiet?: boolean}
) => {
	const originalCwd = process.cwd()
	const quiet = Boolean(options?.quiet)
	try {
		process.chdir(root)
		await initCommand([
			'--yes',
			'--store',
			config.storeAdapter,
			'--dir',
			config.installDir,
			'--alias',
			config.aliasBase,
			...(config.embeddingProvider
				? ['--provider', config.embeddingProvider]
				: []),
			...(config.full ? ['--full'] : []),
			...(config.withDocs ? ['--with-docs'] : []),
			'--no-install',
			...(quiet ? ['--quiet'] : [])
		])

		for (const extractor of config.extractors) {
			await addCommand([
				'extractor',
				extractor,
				'--yes',
				'--no-install',
				...(quiet ? ['--quiet'] : [])
			])
		}
		for (const connector of config.connectors) {
			await addCommand([
				connector,
				'--yes',
				'--no-install',
				...(quiet ? ['--quiet'] : [])
			])
		}
		for (const battery of config.batteries) {
			await addCommand([
				'battery',
				battery,
				'--yes',
				'--no-install',
				...(quiet ? ['--quiet'] : [])
			])
		}
	} finally {
		process.chdir(originalCwd)
	}
}

const runExternalInitAndAdds = async (
	config: SnapshotConfig,
	root: string,
	version: string,
	options?: {verbose?: boolean}
) => {
	const initArgs = [
		'init',
		'--yes',
		'--store',
		config.storeAdapter,
		'--dir',
		config.installDir,
		'--alias',
		config.aliasBase,
		...(config.embeddingProvider
			? ['--provider', config.embeddingProvider]
			: []),
		...(config.full ? ['--full'] : []),
		...(config.withDocs ? ['--with-docs'] : []),
		'--no-install'
	]

	try {
		await runExternalUnrag(root, version, initArgs, options)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		const usesNewFlags = Boolean(config.full || config.withDocs)
		const looksLikeUnknownFlag =
			msg.includes('--full') ||
			msg.includes('--with-docs') ||
			msg.toLowerCase().includes('unknown option') ||
			msg.toLowerCase().includes('unknown argument')

		if (usesNewFlags && looksLikeUnknownFlag) {
			const fallbackArgs = initArgs.filter(
				(a) => a !== '--full' && a !== '--with-docs'
			)
			await runExternalUnrag(root, version, fallbackArgs, options)
		} else {
			throw err
		}
	}

	for (const extractor of config.extractors) {
		await runExternalUnrag(
			root,
			version,
			['add', 'extractor', extractor, '--yes', '--no-install'],
			options
		)
	}
	for (const connector of config.connectors) {
		await runExternalUnrag(
			root,
			version,
			['add', connector, '--yes', '--no-install'],
			options
		)
	}
	for (const battery of config.batteries) {
		await runExternalUnrag(
			root,
			version,
			['add', 'battery', battery, '--yes', '--no-install'],
			options
		)
	}
}

const buildSnapshotConfig = (config: SnapshotConfig) => ({
	...config,
	extractors: Array.from(new Set(config.extractors)).filter(Boolean),
	connectors: Array.from(new Set(config.connectors)).filter(Boolean),
	batteries: Array.from(new Set(config.batteries)).filter(Boolean)
})

export const createSnapshotFromCurrentCli = async (
	config: SnapshotConfig,
	options?: {verbose?: boolean}
): Promise<Snapshot> => {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), 'unrag-current-'))
	const snapshotConfig = buildSnapshotConfig(config)
	try {
		await writeMinimalPackageJson(tempDir)
		await runCurrentInitAndAdds(snapshotConfig, tempDir, {
			quiet: !options?.verbose
		})
		const files = await collectSnapshotFiles(
			tempDir,
			snapshotConfig.installDir
		)
		return {files}
	} finally {
		await rm(tempDir, {recursive: true, force: true})
	}
}

export const createSnapshotFromExternalCli = async (args: {
	version: string
	config: SnapshotConfig
	verbose?: boolean
}): Promise<Snapshot> => {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), 'unrag-external-'))
	const snapshotConfig = buildSnapshotConfig(args.config)
	try {
		await writeMinimalPackageJson(tempDir)
		await runExternalInitAndAdds(snapshotConfig, tempDir, args.version, {
			verbose: args.verbose
		})
		const files = await collectSnapshotFiles(
			tempDir,
			snapshotConfig.installDir
		)
		return {files}
	} finally {
		await rm(tempDir, {recursive: true, force: true})
	}
}
