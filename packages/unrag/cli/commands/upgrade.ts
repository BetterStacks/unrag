import {spawn} from 'node:child_process'
import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {confirm, intro, isCancel, outro} from '@clack/prompts'
import {readCliPackageVersion} from '../lib/cliVersion'
import {docsUrl} from '../lib/constants'
import {ensureDir, exists, findUp, tryFindProjectRoot} from '../lib/fs'
import {readJsonFile, writeJsonFile} from '../lib/json'
import {
	type BatteryName,
	type ConnectorName,
	type DepChange,
	type EmbeddingProviderName,
	type ExtractorName,
	depsForAdapter,
	depsForBattery,
	depsForConnector,
	depsForEmbeddingProvider,
	depsForExtractor,
	detectPackageManager,
	installCmd,
	installDependencies,
	mergeDeps,
	readPackageJson,
	writePackageJson
} from '../lib/packageJson'
import {mergeThreeWay} from '../lib/upgrade/merge'
import {
	createSnapshotFromCurrentCli,
	createSnapshotFromExternalCli
} from '../lib/upgrade/snapshot'

type UpgradeConfig = {
	installDir?: string
	storeAdapter?: 'drizzle' | 'prisma' | 'raw-sql'
	aliasBase?: string
	embeddingProvider?: string
	version?: number
	installedFrom?: {unragVersion?: string}
	connectors?: string[]
	extractors?: string[]
	batteries?: string[]
	managedFiles?: string[]
}

type ParsedUpgradeArgs = {
	yes?: boolean
	fromVersion?: string
	dryRun?: boolean
	allowDirty?: boolean
	overwrite?: 'skip' | 'force'
	noInstall?: boolean
	verbose?: boolean
	help?: boolean
}

type FilePlan = {
	path: string
	action:
		| 'add'
		| 'update'
		| 'merge'
		| 'conflict'
		| 'skip'
		| 'unchanged'
		| 'keep'
		| 'removed-upstream'
	content?: string
}

const CONFIG_FILE = 'unrag.json'
const CONFIG_VERSION = 2
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const formatDepChanges = (changes: DepChange[]) =>
	changes
		.map((c) => `${c.name}${c.action === 'update' ? ' (update)' : ''}`)
		.join(', ')

const isEmbeddingProviderName = (v: unknown): v is EmbeddingProviderName =>
	v === 'ai' ||
	v === 'openai' ||
	v === 'google' ||
	v === 'openrouter' ||
	v === 'azure' ||
	v === 'vertex' ||
	v === 'bedrock' ||
	v === 'cohere' ||
	v === 'mistral' ||
	v === 'together' ||
	v === 'ollama' ||
	v === 'voyage'

const isExtractorName = (v: unknown): v is ExtractorName =>
	v === 'pdf-llm' ||
	v === 'pdf-text-layer' ||
	v === 'pdf-ocr' ||
	v === 'image-ocr' ||
	v === 'image-caption-llm' ||
	v === 'audio-transcribe' ||
	v === 'video-transcribe' ||
	v === 'video-frames' ||
	v === 'file-text' ||
	v === 'file-docx' ||
	v === 'file-pptx' ||
	v === 'file-xlsx'

const isConnectorName = (v: unknown): v is ConnectorName =>
	v === 'notion' ||
	v === 'google-drive' ||
	v === 'onedrive' ||
	v === 'dropbox'

const isBatteryName = (v: unknown): v is BatteryName =>
	v === 'reranker' || v === 'eval' || v === 'debug'

const toStringList = (xs: unknown): string[] =>
	Array.isArray(xs) ? xs.map((x) => String(x).trim()).filter(Boolean) : []

const toExtractorNames = (xs: unknown): ExtractorName[] =>
	toStringList(xs).filter(isExtractorName)

const toConnectorNames = (xs: unknown): ConnectorName[] =>
	toStringList(xs).filter(isConnectorName)

const toBatteryNames = (xs: unknown): BatteryName[] =>
	toStringList(xs).filter(isBatteryName)

const parseUpgradeArgs = (args: string[]): ParsedUpgradeArgs => {
	const out: ParsedUpgradeArgs = {}
	for (let i = 0; i < args.length; i++) {
		const a = args[i]
		if (a === '--yes' || a === '-y') {
			out.yes = true
			continue
		}
		if (a === '--dry-run') {
			out.dryRun = true
			continue
		}
		if (a === '--allow-dirty') {
			out.allowDirty = true
			continue
		}
		if (a === '--from-version') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.fromVersion = v
				i++
			}
			continue
		}
		if (a === '--overwrite') {
			const v = args[i + 1]
			if (v === 'skip' || v === 'force') {
				out.overwrite = v
				i++
			}
			continue
		}
		if (a === '--no-install') {
			out.noInstall = true
			continue
		}
		if (a === '--verbose') {
			out.verbose = true
			continue
		}
		if (a === '--help' || a === '-h') {
			out.help = true
		}
	}
	return out
}

const renderUpgradeHelp = () =>
	[
		'unrag upgrade — safely update vendored Unrag sources',
		'',
		'Usage:',
		'  unrag upgrade [options]',
		'',
		'Options:',
		'  --from-version <x>   Base version to diff from (if missing in unrag.json)',
		'  --overwrite <mode>   skip | force (only affects new files)',
		'  --dry-run            Plan only; do not write files',
		'  --no-install         Skip dependency installation',
		'  --allow-dirty        Allow running with uncommitted git changes',
		'  --verbose            Show init/add logs while preparing snapshots',
		'  -y, --yes            Non-interactive; skip prompts',
		'  -h, --help           Show help',
		'',
		'Docs:',
		`  ${docsUrl('/docs/reference/cli')}`
	].join('\n')

const toPosixPath = (p: string) => p.replace(/\\/g, '/')

const readTextIfExists = async (absPath: string): Promise<string | null> => {
	if (!(await exists(absPath))) {
		return null
	}
	return readFile(absPath, 'utf8')
}

const runGit = async (
	projectRoot: string,
	args: string[]
): Promise<{code: number | null; stdout: string; stderr: string} | null> => {
	return await new Promise((resolve) => {
		const child = spawn('git', args, {
			cwd: projectRoot,
			stdio: ['ignore', 'pipe', 'pipe']
		})
		let stdout = ''
		let stderr = ''
		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString()
		})
		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString()
		})
		child.on('error', () => resolve(null))
		child.on('close', (code) => resolve({code, stdout, stderr}))
	})
}

const getGitStatus = async (projectRoot: string) => {
	const rev = await runGit(projectRoot, [
		'rev-parse',
		'--is-inside-work-tree'
	])
	if (!rev || rev.code !== 0) {
		return {isRepo: false, isDirty: false, status: ''}
	}
	const status = await runGit(projectRoot, ['status', '--porcelain'])
	const output = status?.stdout ?? ''
	return {
		isRepo: true,
		isDirty: output.trim().length > 0,
		status: output.trim()
	}
}

const planUpgrade = async (args: {
	projectRoot: string
	installDir: string
	baseFiles: Map<string, string>
	theirsFiles: Map<string, string>
	managedFiles: string[]
	overwrite: 'skip' | 'force'
}): Promise<{plan: FilePlan[]; managedFiles: string[]}> => {
	const managed = new Set<string>(args.managedFiles.map(toPosixPath))
	for (const key of args.baseFiles.keys()) {
		managed.add(key)
	}
	for (const key of args.theirsFiles.keys()) {
		managed.add(key)
	}
	const entries = Array.from(managed).sort()
	const plan: FilePlan[] = []

	for (const rel of entries) {
		const abs = path.join(args.projectRoot, rel)
		const base = args.baseFiles.get(rel) ?? null
		const theirs = args.theirsFiles.get(rel) ?? null
		const ours = await readTextIfExists(abs)

		if (!ours && !theirs) {
			continue
		}

		if (!ours && theirs !== null) {
			plan.push({path: rel, action: 'add', content: theirs})
			continue
		}

		if (ours && theirs === null) {
			if (base === null) {
				plan.push({path: rel, action: 'keep'})
			} else {
				plan.push({path: rel, action: 'removed-upstream'})
			}
			continue
		}

		if (!ours || theirs === null) {
			continue
		}

		if (base === null) {
			if (args.overwrite === 'force') {
				plan.push({path: rel, action: 'update', content: theirs})
			} else {
				plan.push({path: rel, action: 'skip'})
			}
			continue
		}

		if (ours === base) {
			if (theirs === base) {
				plan.push({path: rel, action: 'unchanged'})
			} else {
				plan.push({path: rel, action: 'update', content: theirs})
			}
			continue
		}

		if (theirs === base) {
			plan.push({path: rel, action: 'keep'})
			continue
		}

		const merged = await mergeThreeWay({
			base,
			ours,
			theirs
		})

		plan.push({
			path: rel,
			action: merged.hadConflict ? 'conflict' : 'merge',
			content: merged.mergedText
		})
	}

	return {plan, managedFiles: entries}
}

const applyPlan = async (
	projectRoot: string,
	plan: FilePlan[]
): Promise<void> => {
	for (const item of plan) {
		if (item.content === undefined) {
			continue
		}
		if (
			item.action === 'add' ||
			item.action === 'update' ||
			item.action === 'merge' ||
			item.action === 'conflict'
		) {
			const abs = path.join(projectRoot, item.path)
			await ensureDir(path.dirname(abs))
			await writeFile(abs, item.content, 'utf8')
		}
	}
}

const summarizePlan = (plan: FilePlan[]) => {
	const counts: Record<string, number> = {}
	for (const item of plan) {
		counts[item.action] = (counts[item.action] ?? 0) + 1
	}
	const changedCount =
		(counts.add ?? 0) +
		(counts.update ?? 0) +
		(counts.merge ?? 0) +
		(counts.conflict ?? 0)
	const lines = [
		`- files-changed: ${changedCount}`,
		`- add: ${counts.add ?? 0}`,
		`- update: ${counts.update ?? 0}`,
		`- merge: ${counts.merge ?? 0}`,
		`- conflicts: ${counts.conflict ?? 0}`,
		`- keep: ${counts.keep ?? 0}`,
		`- removed-upstream: ${counts['removed-upstream'] ?? 0}`,
		`- skipped: ${counts.skip ?? 0}`,
		`- unchanged: ${counts.unchanged ?? 0}`
	]
	return {counts, lines, changedCount}
}

export async function upgradeCommand(args: string[]) {
	const parsed = parseUpgradeArgs(args)
	if (parsed.help) {
		outro(renderUpgradeHelp())
		return
	}

	intro('unrag upgrade')

	const root = await tryFindProjectRoot(process.cwd())
	if (!root) {
		throw new Error(
			'Could not find a project root (no package.json found).'
		)
	}

	const configPath = path.join(root, CONFIG_FILE)
	const config = await readJsonFile<UpgradeConfig>(configPath)
	if (!config?.installDir || !config.storeAdapter) {
		throw new Error(
			`Missing ${CONFIG_FILE} or required fields (installDir/storeAdapter). Run \`unrag@latest init\` first.`
		)
	}

	const nonInteractive = parsed.yes || !process.stdin.isTTY
	const overwrite = parsed.overwrite ?? 'skip'
	const verbose = Boolean(parsed.verbose)

	const fromVersion =
		parsed.fromVersion ?? (config.installedFrom?.unragVersion || '').trim()
	if (!fromVersion) {
		throw new Error(
			'Missing base version. Provide --from-version <x> or ensure unrag.json has installedFrom.unragVersion.'
		)
	}

	const gitStatus = await getGitStatus(root)
	if (gitStatus.isRepo && gitStatus.isDirty && !parsed.allowDirty) {
		if (nonInteractive) {
			throw new Error(
				'Working tree has uncommitted changes. Commit or stash before running upgrade, or pass --allow-dirty.'
			)
		}
		const proceed = await confirm({
			message:
				'Uncommitted changes detected. Commit or stash before upgrading. Continue anyway?',
			initialValue: false
		})
		if (isCancel(proceed) || !proceed) {
			outro('Cancelled.')
			return
		}
	}

	const embeddingProvider: EmbeddingProviderName = isEmbeddingProviderName(
		config.embeddingProvider
	)
		? (config.embeddingProvider as EmbeddingProviderName)
		: 'ai'

	const snapshotConfig = {
		projectRoot: root,
		installDir: config.installDir,
		storeAdapter: config.storeAdapter,
		aliasBase: config.aliasBase ?? '@unrag',
		embeddingProvider,
		extractors: toExtractorNames(config.extractors),
		connectors: toConnectorNames(config.connectors),
		batteries: toBatteryNames(config.batteries)
	}

	const baseSnapshot = await createSnapshotFromExternalCli({
		version: fromVersion,
		config: snapshotConfig,
		verbose
	})
	const theirsSnapshot = await createSnapshotFromCurrentCli(snapshotConfig, {
		verbose
	})

	const {plan, managedFiles} = await planUpgrade({
		projectRoot: root,
		installDir: config.installDir,
		baseFiles: baseSnapshot.files,
		theirsFiles: theirsSnapshot.files,
		managedFiles: config.managedFiles ?? [],
		overwrite
	})

	const summary = summarizePlan(plan)
	const conflictFiles = plan
		.filter((item) => item.action === 'conflict')
		.map((item) => item.path)
	const summaryLines = [
		'Upgrade plan:',
		...summary.lines,
		parsed.dryRun ? 'Dry run: no files will be written.' : ''
	].filter(Boolean)

	if (parsed.dryRun) {
		outro(summaryLines.join('\n'))
		return
	}

	if (!nonInteractive) {
		const proceed = await confirm({
			message: `Proceed and apply changes?\n${summaryLines.join('\n')}`,
			initialValue: false
		})
		if (isCancel(proceed) || !proceed) {
			outro('Cancelled.')
			return
		}
	}

	if (!parsed.dryRun) {
		await applyPlan(root, plan)

		const cliPackageRoot = await findUp(__dirname, 'package.json')
		const cliVersion = cliPackageRoot
			? await readCliPackageVersion(cliPackageRoot)
			: 'unknown'
		await writeJsonFile(configPath, {
			...config,
			version: CONFIG_VERSION,
			installedFrom: {unragVersion: cliVersion},
			managedFiles: managedFiles
		})

		const pkg = await readPackageJson(root)
		const {deps, devDeps} = depsForAdapter(config.storeAdapter)
		const embeddingDeps = depsForEmbeddingProvider(embeddingProvider)
		const extractorDeps: Record<string, string> = {}
		const extractorDevDeps: Record<string, string> = {}
		for (const ex of snapshotConfig.extractors) {
			const r = depsForExtractor(ex)
			Object.assign(extractorDeps, r.deps)
			Object.assign(extractorDevDeps, r.devDeps)
		}
		const connectorDeps: Record<string, string> = {}
		const connectorDevDeps: Record<string, string> = {}
		for (const c of snapshotConfig.connectors) {
			const r = depsForConnector(c)
			Object.assign(connectorDeps, r.deps)
			Object.assign(connectorDevDeps, r.devDeps)
		}
		const batteryDeps: Record<string, string> = {}
		const batteryDevDeps: Record<string, string> = {}
		for (const b of snapshotConfig.batteries) {
			const r = depsForBattery(b)
			Object.assign(batteryDeps, r.deps)
			Object.assign(batteryDevDeps, r.devDeps)
		}

		const merged = mergeDeps(
			pkg,
			{
				...deps,
				...embeddingDeps.deps,
				...extractorDeps,
				...connectorDeps,
				...batteryDeps
			},
			{
				...devDeps,
				...embeddingDeps.devDeps,
				...extractorDevDeps,
				...connectorDevDeps,
				...batteryDevDeps
			}
		)

		const noInstall =
			Boolean(parsed.noInstall) || process.env.UNRAG_SKIP_INSTALL === '1'
		if (merged.changes.length > 0) {
			await writePackageJson(root, merged.pkg)
			if (!noInstall) {
				await installDependencies(root)
			}
		}

		const pm = await detectPackageManager(root)
		const depsLine =
			merged.changes.length > 0
				? `Deps: ${formatDepChanges(merged.changes)}`
				: 'Deps: none'
		const installLine =
			merged.changes.length === 0
				? 'Dependencies already satisfied.'
				: noInstall
					? `Next: run \`${installCmd(pm)}\``
					: `Dependencies updated. (ran ${installCmd(pm)})`

		const conflictLines =
			(conflictFiles.length ?? 0) > 0
				? [
						'',
						'Conflicts:',
						...conflictFiles.map((file) => `- ${file}`),
						gitStatus.isRepo
							? 'Resolve with: git diff --name-only --diff-filter=U'
							: '',
						`Docs: ${docsUrl('/docs/upgrade/handling-conflicts')}`,
						'Next: resolve markers, then re-run `unrag doctor`.'
					]
				: []

		outro(
			[
				'Upgrade complete.',
				'',
				...summary.lines,
				'',
				depsLine,
				installLine,
				...conflictLines
			]
				.filter(Boolean)
				.join('\n')
		)
	} else {
		outro(summaryLines.join('\n'))
	}
}
