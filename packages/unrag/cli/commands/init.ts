import {writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {
	cancel,
	confirm,
	groupMultiselect,
	isCancel,
	outro,
	select,
	text
} from '@clack/prompts'
import {
	EVAL_CONFIG_DEFAULT,
	EVAL_PACKAGE_JSON_SCRIPTS,
	EVAL_SAMPLE_DATASET_V1,
	renderEvalRunnerScript
} from '../lib/evalBatteryScaffold'
import {
	ensureDir,
	exists,
	findUp,
	normalizePosixPath,
	tryFindProjectRoot
} from '../lib/fs'
import {readJsonFile, writeJsonFile} from '../lib/json'
import {readRegistryManifest} from '../lib/manifest'
import {
	type BatteryName,
	type ConnectorName,
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
import {type PresetPayloadV1, fetchPreset} from '../lib/preset'
import {
	type RegistrySelection,
	copyBatteryFiles,
	copyConnectorFiles,
	copyExtractorFiles,
	copyRegistryFiles
} from '../lib/registry'
import {patchTsconfigPaths} from '../lib/tsconfig'

type InitConfig = {
	installDir: string
	storeAdapter: 'drizzle' | 'prisma' | 'raw-sql'
	aliasBase?: string
	embeddingProvider?: EmbeddingProviderName
	version: number
	connectors?: string[]
	extractors?: string[]
	batteries?: string[]
}

const CONFIG_FILE = 'unrag.json'
const CONFIG_VERSION = 1

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type ParsedInitArgs = {
	installDir?: string
	storeAdapter?: InitConfig['storeAdapter']
	aliasBase?: string
	yes?: boolean
	richMedia?: boolean
	extractors?: string[]
	provider?: EmbeddingProviderName
	preset?: string
	overwrite?: 'skip' | 'force'
	noInstall?: boolean
}

const parseInitArgs = (args: string[]): ParsedInitArgs => {
	const out: ParsedInitArgs = {}

	for (let i = 0; i < args.length; i++) {
		const a = args[i]
		if (a === '--yes' || a === '-y') {
			out.yes = true
			continue
		}
		if (a === '--dir' || a === '--install-dir') {
			const v = args[i + 1]
			if (v) {
				out.installDir = v
				i++
			}
			continue
		}
		if (a === '--store') {
			const v = args[i + 1]
			if (v === 'drizzle' || v === 'prisma' || v === 'raw-sql') {
				out.storeAdapter = v
				i++
			}
			continue
		}
		if (a === '--alias') {
			const v = args[i + 1]
			if (v) {
				out.aliasBase = v
				i++
			}
			continue
		}
		if (a === '--rich-media') {
			out.richMedia = true
			continue
		}
		if (a === '--no-rich-media') {
			out.richMedia = false
			continue
		}
		if (a === '--extractors') {
			const v = args[i + 1]
			if (v) {
				out.extractors = v
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
				i++
			}
			continue
		}
		if (a === '--provider') {
			const v = args[i + 1] as EmbeddingProviderName | undefined
			if (
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
			) {
				out.provider = v
				i++
			}
			continue
		}
		if (a === '--preset') {
			const v = args[i + 1]
			if (v) {
				out.preset = v
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
		}
	}

	return out
}

const toExtractors = (xs: string[] | undefined): ExtractorName[] =>
	(Array.isArray(xs) ? xs : [])
		.map((s) => String(s).trim())
		.filter(Boolean) as ExtractorName[]

const toConnectors = (xs: string[] | undefined): ConnectorName[] =>
	(Array.isArray(xs) ? xs : [])
		.map((s) => String(s).trim())
		.filter(Boolean) as ConnectorName[]

const toBatteries = (xs: string[] | undefined): BatteryName[] =>
	(Array.isArray(xs) ? xs : [])
		.map((s) => String(s).trim())
		.filter(Boolean) as BatteryName[]

function getPresetEmbeddingProvider(
	preset: PresetPayloadV1 | null
): EmbeddingProviderName | undefined {
	const cfg = preset?.config
	if (!cfg || typeof cfg !== 'object') {
		return undefined
	}
	const embedding = (cfg as Record<string, unknown>).embedding
	if (!embedding || typeof embedding !== 'object') {
		return undefined
	}
	const v = (embedding as Record<string, unknown>).provider
	return v === 'ai' ||
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
		v === 'voyage' ||
		v === 'custom'
		? v
		: undefined
}

export async function initCommand(args: string[]) {
	const root = await tryFindProjectRoot(process.cwd())
	if (!root) {
		throw new Error(
			'Could not find a project root (no package.json found).'
		)
	}

	const cliPackageRoot = await findUp(__dirname, 'package.json')
	if (!cliPackageRoot) {
		throw new Error(
			'Could not locate CLI package root (package.json not found).'
		)
	}
	const registryRoot = path.join(cliPackageRoot, 'registry')
	const manifest = await readRegistryManifest(registryRoot)

	const extractorOptions = manifest.extractors.map((ex) => {
		const value = ex.id as ExtractorName
		const label = ex.description
			? `${ex.label} (${ex.description})`
			: ex.label
		return {
			group: ex.group,
			value,
			label,
			hint: ex.hint,
			defaultSelected: Boolean(ex.defaultSelected)
		}
	})

	const availableExtractors = new Set<ExtractorName>(
		extractorOptions.map((o) => o.value)
	)

	const defaultRichMediaExtractors: ExtractorName[] = extractorOptions
		.filter((o) => o.defaultSelected)
		.map((o) => o.value)
		.sort()

	const existing = await readJsonFile<InitConfig>(
		path.join(root, CONFIG_FILE)
	)

	const parsed = parseInitArgs(args)
	const noInstall =
		Boolean(parsed.noInstall) || process.env.UNRAG_SKIP_INSTALL === '1'

	const preset: PresetPayloadV1 | null = parsed.preset
		? await fetchPreset(parsed.preset)
		: null

	if (preset) {
		const hasOtherChoices =
			Boolean(parsed.installDir) ||
			Boolean(parsed.storeAdapter) ||
			Boolean(parsed.aliasBase) ||
			typeof parsed.richMedia === 'boolean' ||
			(parsed.extractors ?? []).length > 0
		if (hasOtherChoices) {
			throw new Error(
				'When using "--preset", do not pass other init preference flags (--store/--dir/--alias/--rich-media/--extractors).'
			)
		}
	}

	const presetEmbeddingProvider = getPresetEmbeddingProvider(preset)

	const defaults = {
		installDir:
			preset?.install?.installDir ?? existing?.installDir ?? 'lib/unrag',
		storeAdapter:
			preset?.install?.storeAdapter ??
			existing?.storeAdapter ??
			'drizzle',
		aliasBase:
			preset?.install?.aliasBase ?? existing?.aliasBase ?? '@unrag',
		embeddingProvider:
			parsed.provider ??
			presetEmbeddingProvider ??
			existing?.embeddingProvider ??
			'ai'
	} as const

	const nonInteractive =
		Boolean(parsed.yes) || Boolean(preset) || !process.stdin.isTTY
	const overwritePolicy = parsed.overwrite ?? 'skip'

	const installDirAnswer = parsed.installDir
		? parsed.installDir
		: nonInteractive
			? defaults.installDir
			: await text({
					message: 'Install directory',
					initialValue: defaults.installDir,
					validate: (v) => {
						if (!v.trim()) {
							return 'Install directory is required'
						}
						if (v.startsWith('/')) {
							return 'Use a project-relative path'
						}
						return
					}
				})
	if (isCancel(installDirAnswer)) {
		cancel('Cancelled.')
		return
	}
	const installDir = normalizePosixPath(String(installDirAnswer))

	const storeAdapterAnswer = parsed.storeAdapter
		? parsed.storeAdapter
		: nonInteractive
			? defaults.storeAdapter
			: await select({
					message: 'Store adapter',
					initialValue: defaults.storeAdapter,
					options: [
						{
							value: 'drizzle',
							label: 'Drizzle (Postgres + pgvector)'
						},
						{
							value: 'prisma',
							label: 'Prisma (Postgres + pgvector)'
						},
						{
							value: 'raw-sql',
							label: 'Raw SQL (Postgres + pgvector)'
						}
					]
				})
	if (isCancel(storeAdapterAnswer)) {
		cancel('Cancelled.')
		return
	}

	const aliasAnswer = parsed.aliasBase
		? parsed.aliasBase
		: nonInteractive
			? defaults.aliasBase
			: await text({
					message: 'Import alias base',
					initialValue: defaults.aliasBase,
					validate: (v) => {
						const s = v.trim()
						if (!s) {
							return 'Alias is required'
						}
						if (s.includes(' ')) {
							return 'Alias must not contain spaces'
						}
						if (!s.startsWith('@')) {
							return 'Alias should start with "@" (e.g. "@unrag")'
						}
						if (s.endsWith('/')) {
							return 'Alias must not end with /'
						}
						return
					}
				})
	if (isCancel(aliasAnswer)) {
		cancel('Cancelled.')
		return
	}
	const aliasBase = String(aliasAnswer).trim()

	const embeddingProviderAnswer = parsed.provider
		? parsed.provider
		: nonInteractive
			? defaults.embeddingProvider
			: await select({
					message: 'Embedding provider',
					initialValue: defaults.embeddingProvider,
					options: [
						{
							value: 'ai',
							label: 'Vercel AI Gateway (AI SDK)',
							hint: 'default'
						},
						{value: 'openai', label: 'OpenAI'},
						{value: 'google', label: 'Google AI (Gemini)'},
						{value: 'openrouter', label: 'OpenRouter'},
						{value: 'azure', label: 'Azure OpenAI'},
						{value: 'vertex', label: 'Google Vertex AI'},
						{value: 'bedrock', label: 'AWS Bedrock'},
						{value: 'cohere', label: 'Cohere'},
						{value: 'mistral', label: 'Mistral'},
						{value: 'together', label: 'Together.ai'},
						{value: 'ollama', label: 'Ollama (local)'},
						{value: 'voyage', label: 'Voyage AI'}
					]
				})
	if (isCancel(embeddingProviderAnswer)) {
		cancel('Cancelled.')
		return
	}
	const embeddingProvider = embeddingProviderAnswer as EmbeddingProviderName

	if (parsed.richMedia === false && (parsed.extractors ?? []).length > 0) {
		throw new Error(
			'Cannot use "--no-rich-media" together with "--extractors".'
		)
	}

	const extractorsFromArgs = (
		preset
			? toExtractors(preset.modules?.extractors)
			: (parsed.extractors ?? [])
	)
		.filter((x): x is ExtractorName =>
			availableExtractors.has(x as ExtractorName)
		)
		.sort()

	if (preset) {
		const unknown = toExtractors(preset.modules?.extractors).filter(
			(x) => !availableExtractors.has(x)
		)
		if (unknown.length > 0) {
			throw new Error(
				`Preset contains unknown extractors: ${unknown.join(', ')}`
			)
		}
	}

	const richMediaAnswer =
		extractorsFromArgs.length > 0
			? true
			: typeof parsed.richMedia === 'boolean'
				? parsed.richMedia
				: nonInteractive
					? false
					: await confirm({
							message:
								'Enable rich media ingestion (PDF/images/audio/video/files)? This enables extractor modules and assetProcessing (you can change this later).',
							initialValue: false
						})
	if (isCancel(richMediaAnswer)) {
		cancel('Cancelled.')
		return
	}
	const richMediaEnabled = Boolean(richMediaAnswer)

	const selectedExtractorsAnswer =
		richMediaEnabled || extractorsFromArgs.length > 0
			? nonInteractive
				? extractorsFromArgs.length > 0
					? extractorsFromArgs
					: defaultRichMediaExtractors.length > 0
						? defaultRichMediaExtractors
						: (['pdf-text-layer', 'file-text'] as ExtractorName[]) // fallback preset
				: await groupMultiselect<ExtractorName>({
						message:
							'Select extractors to enable (space to toggle, enter to confirm)',
						options: extractorOptions.reduce<
							Record<
								string,
								Array<{
									value: ExtractorName
									label: string
									hint?: string
								}>
							>
						>((acc, opt) => {
							acc[opt.group] ??= []
							acc[opt.group]?.push({
								value: opt.value,
								label: opt.label,
								...(opt.hint ? {hint: opt.hint} : {})
							})
							return acc
						}, {}),
						initialValues:
							extractorsFromArgs.length > 0
								? extractorsFromArgs
								: defaultRichMediaExtractors.length > 0
									? defaultRichMediaExtractors
									: ([
											'pdf-text-layer',
											'file-text'
										] as ExtractorName[]),
						required: false
					})
			: []

	if (isCancel(selectedExtractorsAnswer)) {
		cancel('Cancelled.')
		return
	}

	const selectedExtractors = Array.from(
		new Set(
			(Array.isArray(selectedExtractorsAnswer)
				? selectedExtractorsAnswer
				: []) as ExtractorName[]
		)
	).sort()

	const selection: RegistrySelection = {
		installDir,
		storeAdapter: storeAdapterAnswer as RegistrySelection['storeAdapter'],
		projectRoot: root,
		registryRoot,
		aliasBase,
		embeddingProvider,
		yes: nonInteractive,
		overwrite: overwritePolicy,
		presetConfig:
			(preset?.config as RegistrySelection['presetConfig'] | undefined) ??
			undefined,
		richMedia: richMediaEnabled
			? {
					enabled: true,
					extractors: selectedExtractors
				}
			: {enabled: false, extractors: []}
	}

	await copyRegistryFiles(selection)

	// Install selected extractor modules (vendor code) before updating deps.
	if (richMediaEnabled && selectedExtractors.length > 0) {
		for (const extractor of selectedExtractors) {
			await copyExtractorFiles({
				projectRoot: root,
				registryRoot,
				installDir,
				aliasBase,
				extractor,
				yes: nonInteractive,
				overwrite: overwritePolicy
			})
		}
	}

	const pkg = await readPackageJson(root)
	const {deps, devDeps} = depsForAdapter(storeAdapterAnswer)
	const embeddingDeps = depsForEmbeddingProvider(embeddingProvider)
	const extractorDeps: Record<string, string> = {}
	const extractorDevDeps: Record<string, string> = {}
	for (const ex of selectedExtractors) {
		const r = depsForExtractor(ex)
		Object.assign(extractorDeps, r.deps)
		Object.assign(extractorDevDeps, r.devDeps)
	}

	const connectorsFromPreset = preset
		? toConnectors(preset.modules?.connectors)
		: []
	const availableConnectorIds = new Set(
		manifest.connectors
			.filter((c) => c.status === 'available')
			.map((c) => c.id as ConnectorName)
	)
	if (preset) {
		const unknown = connectorsFromPreset.filter(
			(c) => !availableConnectorIds.has(c)
		)
		if (unknown.length > 0) {
			throw new Error(
				`Preset contains unknown/unavailable connectors: ${unknown.join(', ')}`
			)
		}
	}

	// Install connector modules (vendor code) before updating deps.
	if (connectorsFromPreset.length > 0) {
		for (const connector of connectorsFromPreset) {
			await copyConnectorFiles({
				projectRoot: root,
				registryRoot,
				installDir,
				aliasBase,
				connector,
				yes: nonInteractive,
				overwrite: overwritePolicy
			})
		}
	}

	const connectorDeps: Record<string, string> = {}
	const connectorDevDeps: Record<string, string> = {}
	for (const c of connectorsFromPreset) {
		const r = depsForConnector(c)
		Object.assign(connectorDeps, r.deps)
		Object.assign(connectorDevDeps, r.devDeps)
	}

	const batteriesFromPreset = preset
		? Array.from(new Set(toBatteries(preset.modules?.batteries))).sort()
		: []
	const availableBatteryIds = new Set(
		(manifest.batteries ?? [])
			.filter((b) => b.status === 'available')
			.map((b) => b.id as BatteryName)
	)
	if (preset) {
		const unknown = batteriesFromPreset.filter(
			(b) => !availableBatteryIds.has(b)
		)
		if (unknown.length > 0) {
			throw new Error(
				`Preset contains unknown/unavailable batteries: ${unknown.join(', ')}`
			)
		}
	}

	// Install battery modules (vendor code) before updating deps.
	if (batteriesFromPreset.length > 0) {
		for (const battery of batteriesFromPreset) {
			await copyBatteryFiles({
				projectRoot: root,
				registryRoot,
				installDir,
				aliasBase,
				battery,
				yes: nonInteractive,
				overwrite: overwritePolicy
			})
		}
	}

	const batteryDeps: Record<string, string> = {}
	const batteryDevDeps: Record<string, string> = {}
	for (const b of batteriesFromPreset) {
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
	if (merged.changes.length > 0) {
		await writePackageJson(root, merged.pkg)
		if (!noInstall) {
			await installDependencies(root)
		}
	}

	const config: InitConfig = {
		installDir,
		storeAdapter: storeAdapterAnswer,
		aliasBase,
		embeddingProvider,
		version: CONFIG_VERSION,
		connectors: Array.from(
			new Set([...(existing?.connectors ?? []), ...connectorsFromPreset])
		).sort(),
		extractors: Array.from(
			new Set([
				...(existing?.extractors ?? []),
				...(richMediaEnabled ? selectedExtractors : [])
			])
		).sort(),
		batteries: Array.from(
			new Set([...(existing?.batteries ?? []), ...batteriesFromPreset])
		).sort()
	}
	await writeJsonFile(path.join(root, CONFIG_FILE), config)

	// Battery-specific scaffolding (preset installs are non-interactive).
	const writeTextFile = async (absPath: string, content: string) => {
		await ensureDir(path.dirname(absPath))
		await writeFile(absPath, content, 'utf8')
	}
	const writeIfMissing = async (absPath: string, content: string) => {
		if (await exists(absPath)) {
			return false
		}
		await writeTextFile(absPath, content)
		return true
	}

	if (batteriesFromPreset.includes('eval')) {
		const datasetAbs = path.join(root, '.unrag/eval/datasets/sample.json')
		const evalConfigAbs = path.join(root, '.unrag/eval/config.json')
		const scriptAbs = path.join(root, 'scripts/unrag-eval.ts')

		await writeIfMissing(
			datasetAbs,
			`${JSON.stringify(EVAL_SAMPLE_DATASET_V1, null, 2)}\n`
		)
		await writeIfMissing(
			evalConfigAbs,
			`${JSON.stringify(EVAL_CONFIG_DEFAULT, null, 2)}\n`
		)
		await writeIfMissing(scriptAbs, renderEvalRunnerScript({aliasBase}))

		// Add package.json scripts, non-destructively.
		type PackageJsonWithScripts = Awaited<
			ReturnType<typeof readPackageJson>
		> & {
			scripts?: Record<string, string>
		}
		const pkg2 = (await readPackageJson(root)) as PackageJsonWithScripts
		const existingScripts = (pkg2.scripts ?? {}) as Record<string, string>
		const toAdd: Record<string, string> = {}
		for (const [name, cmd] of Object.entries(EVAL_PACKAGE_JSON_SCRIPTS)) {
			if (!(name in existingScripts)) {
				toAdd[name] = cmd
			}
		}
		if (Object.keys(toAdd).length > 0) {
			pkg2.scripts = {...existingScripts, ...toAdd}
			await writePackageJson(root, pkg2)
		}
	}

	const pm = await detectPackageManager(root)
	const installLine =
		merged.changes.length === 0
			? 'Dependencies already satisfied.'
			: noInstall
				? `Next: run \`${installCmd(pm)}\``
				: 'Dependencies installed.'

	const tsconfigResult = await patchTsconfigPaths({
		projectRoot: root,
		installDir,
		aliasBase
	})

	const envHint = (() => {
		if (embeddingProvider === 'ai') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- AI_GATEWAY_API_KEY=...',
				'- (optional) AI_GATEWAY_MODEL=openai/text-embedding-3-small'
			]
		}
		if (embeddingProvider === 'openai') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- OPENAI_API_KEY=...',
				'- (optional) OPENAI_EMBEDDING_MODEL=text-embedding-3-small'
			]
		}
		if (embeddingProvider === 'google') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- GOOGLE_GENERATIVE_AI_API_KEY=...',
				'- (optional) GOOGLE_GENERATIVE_AI_EMBEDDING_MODEL=gemini-embedding-001'
			]
		}
		if (embeddingProvider === 'openrouter') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- OPENROUTER_API_KEY=...',
				'- (optional) OPENROUTER_EMBEDDING_MODEL=text-embedding-3-small'
			]
		}
		if (embeddingProvider === 'cohere') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- COHERE_API_KEY=...',
				'- (optional) COHERE_EMBEDDING_MODEL=embed-english-v3.0'
			]
		}
		if (embeddingProvider === 'mistral') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- MISTRAL_API_KEY=...',
				'- (optional) MISTRAL_EMBEDDING_MODEL=mistral-embed'
			]
		}
		if (embeddingProvider === 'together') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- TOGETHER_AI_API_KEY=...',
				'- (optional) TOGETHER_AI_EMBEDDING_MODEL=togethercomputer/m2-bert-80M-2k-retrieval'
			]
		}
		if (embeddingProvider === 'voyage') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- VOYAGE_API_KEY=...',
				'- (optional) VOYAGE_MODEL=voyage-3.5-lite'
			]
		}
		if (embeddingProvider === 'ollama') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- (optional) OLLAMA_EMBEDDING_MODEL=nomic-embed-text'
			]
		}
		if (embeddingProvider === 'azure') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- AZURE_OPENAI_API_KEY=...',
				'- AZURE_RESOURCE_NAME=...',
				'- (optional) AZURE_EMBEDDING_MODEL=text-embedding-3-small'
			]
		}
		if (embeddingProvider === 'vertex') {
			return [
				'Env:',
				'- DATABASE_URL=...',
				'- GOOGLE_APPLICATION_CREDENTIALS=... (when outside GCP)',
				'- (optional) GOOGLE_VERTEX_EMBEDDING_MODEL=text-embedding-004'
			]
		}
		return [
			'Env:',
			'- DATABASE_URL=...',
			'- AWS_REGION=... (Bedrock)',
			'- AWS credentials (when outside AWS)',
			'- (optional) BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0'
		]
	})()

	outro(
		[
			'Installed Unrag.',
			'',
			`- Code: ${path.join(installDir)}`,
			`- Docs: ${path.join(installDir, 'unrag.md')}`,
			'- Config: unrag.config.ts',
			`- Imports: ${aliasBase}/* and ${aliasBase}/config`,
			'',
			`- Rich media: ${richMediaEnabled ? 'enabled' : 'disabled'}`,
			`- Embedding provider: ${embeddingProvider}`,
			richMediaEnabled
				? `- Extractors: ${selectedExtractors.length > 0 ? selectedExtractors.join(', ') : 'none'}`
				: '',
			richMediaEnabled
				? '  Tip: you can tweak extractors + assetProcessing flags in unrag.config.ts later.'
				: '  Tip: re-run `unrag init --rich-media` (or edit unrag.config.ts) to enable rich media later.',
			tsconfigResult.changed
				? `- TypeScript: updated ${tsconfigResult.file} (added aliases)`
				: '- TypeScript: no tsconfig changes needed',
			'',
			merged.changes.length > 0
				? `Added deps: ${merged.changes.map((c) => c.name).join(', ')}`
				: 'Added deps: none',
			installLine,
			'',
			...envHint,
			'',
			`Saved ${CONFIG_FILE}.`
		].join('\n')
	)
}
