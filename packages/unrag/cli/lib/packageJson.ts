import {spawn} from 'node:child_process'
import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {exists} from './fs'

type PackageJson = {
	name?: string
	private?: boolean
	type?: string
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm'

export async function detectPackageManager(
	projectRoot: string
): Promise<PackageManager> {
	if (await exists(path.join(projectRoot, 'bun.lock'))) return 'bun'
	if (await exists(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm'
	if (await exists(path.join(projectRoot, 'yarn.lock'))) return 'yarn'
	if (await exists(path.join(projectRoot, 'package-lock.json'))) return 'npm'
	return 'npm'
}

export async function readPackageJson(
	projectRoot: string
): Promise<PackageJson> {
	const raw = await readFile(path.join(projectRoot, 'package.json'), 'utf8')
	return JSON.parse(raw) as PackageJson
}

export async function writePackageJson(projectRoot: string, pkg: PackageJson) {
	await writeFile(
		path.join(projectRoot, 'package.json'),
		JSON.stringify(pkg, null, 2) + '\n',
		'utf8'
	)
}

export type DepChange = {name: string; version: string; kind: 'dep' | 'devDep'}

export function mergeDeps(
	pkg: PackageJson,
	deps: Record<string, string>,
	devDeps: Record<string, string>
): {pkg: PackageJson; changes: DepChange[]} {
	const next: PackageJson = {...pkg}
	next.dependencies = {...(pkg.dependencies ?? {})}
	next.devDependencies = {...(pkg.devDependencies ?? {})}

	const changes: DepChange[] = []

	for (const [name, version] of Object.entries(deps)) {
		if (!next.dependencies[name] && !next.devDependencies[name]) {
			next.dependencies[name] = version
			changes.push({name, version, kind: 'dep'})
		}
	}

	for (const [name, version] of Object.entries(devDeps)) {
		if (!next.dependencies[name] && !next.devDependencies[name]) {
			next.devDependencies[name] = version
			changes.push({name, version, kind: 'devDep'})
		}
	}

	return {pkg: next, changes}
}

export function depsForAdapter(adapter: 'drizzle' | 'prisma' | 'raw-sql') {
	const deps: Record<string, string> = {
		ai: '^6.0.3'
	}

	const devDeps: Record<string, string> = {}

	if (adapter === 'drizzle') {
		deps['drizzle-orm'] = '^0.45.1'
		deps['pg'] = '^8.16.3'
		devDeps['@types/pg'] = '^8.16.0'
	}

	if (adapter === 'raw-sql') {
		deps['pg'] = '^8.16.3'
		devDeps['@types/pg'] = '^8.16.0'
	}

	if (adapter === 'prisma') {
		deps['@prisma/client'] = '^6.0.0'
		devDeps['prisma'] = '^6.0.0'
	}

	return {deps, devDeps}
}

export type ConnectorName = 'notion' | 'google-drive'

export function depsForConnector(connector: ConnectorName) {
	const deps: Record<string, string> = {}
	const devDeps: Record<string, string> = {}

	if (connector === 'notion') {
		deps['@notionhq/client'] = '^2.2.16'
	}

	if (connector === 'google-drive') {
		// Keep these as direct deps so they work under strict node_modules layouts (e.g. pnpm).
		deps['googleapis'] = '^148.0.0'
		deps['google-auth-library'] = '^10.0.0'
	}

	return {deps, devDeps}
}

export type ExtractorName =
	| 'pdf-llm'
	| 'pdf-text-layer'
	| 'pdf-ocr'
	| 'image-ocr'
	| 'image-caption-llm'
	| 'audio-transcribe'
	| 'video-transcribe'
	| 'video-frames'
	| 'file-text'
	| 'file-docx'
	| 'file-pptx'
	| 'file-xlsx'

export function depsForExtractor(extractor: ExtractorName) {
	const deps: Record<string, string> = {}
	const devDeps: Record<string, string> = {}

	// pdf-llm uses the AI SDK which is already installed by `unrag init`,
	// but keep this here in case extractor installs are used independently later.
	if (extractor === 'pdf-llm') {
		deps['ai'] = '^6.0.3'
	}

	if (extractor === 'pdf-text-layer') {
		deps['pdfjs-dist'] = '^5.4.149'
	}

	if (extractor === 'pdf-ocr') {
		// No JS deps. Requires external binaries in worker environments (poppler/tesseract).
	}

	if (extractor === 'image-ocr' || extractor === 'image-caption-llm') {
		deps['ai'] = '^6.0.3'
	}

	if (extractor === 'audio-transcribe' || extractor === 'video-transcribe') {
		deps['ai'] = '^6.0.3'
	}

	if (extractor === 'video-frames') {
		deps['ai'] = '^6.0.3'
	}

	if (extractor === 'file-text') {
		// No JS deps.
	}

	if (extractor === 'file-docx') {
		deps['mammoth'] = '^1.10.0'
	}

	if (extractor === 'file-pptx') {
		deps['jszip'] = '^3.10.1'
	}

	if (extractor === 'file-xlsx') {
		deps['xlsx'] = '^0.18.5'
	}

	return {deps, devDeps}
}

export type EmbeddingProviderName =
	| 'ai'
	| 'openai'
	| 'google'
	| 'openrouter'
	| 'azure'
	| 'vertex'
	| 'bedrock'
	| 'cohere'
	| 'mistral'
	| 'together'
	| 'ollama'
	| 'voyage'

export function depsForEmbeddingProvider(provider: EmbeddingProviderName) {
	const deps: Record<string, string> = {}
	const devDeps: Record<string, string> = {}

	// Note: `ai` (core package) is installed via depsForAdapter() for all setups.
	// Provider-specific packages are optional and only needed when that provider is selected.
	if (provider === 'openai') deps['@ai-sdk/openai'] = '^3.0.1'
	if (provider === 'google') deps['@ai-sdk/google'] = '^3.0.1'
	if (provider === 'azure') deps['@ai-sdk/azure'] = '^3.0.1'
	if (provider === 'vertex') deps['@ai-sdk/google-vertex'] = '^3.0.1'
	if (provider === 'bedrock') deps['@ai-sdk/amazon-bedrock'] = '^3.0.72'
	if (provider === 'cohere') deps['@ai-sdk/cohere'] = '^3.0.1'
	if (provider === 'mistral') deps['@ai-sdk/mistral'] = '^3.0.1'
	if (provider === 'together') deps['@ai-sdk/togetherai'] = '^3.0.1'
	if (provider === 'openrouter') deps['@openrouter/sdk'] = '^0.3.10'
	if (provider === 'ollama') deps['ollama-ai-provider-v2'] = '^2.0.0'
	if (provider === 'voyage') deps['voyage-ai-provider'] = '^3.0.0'

	return {deps, devDeps}
}

export type BatteryName = 'reranker' | 'eval' | 'debug'

export function depsForBattery(battery: BatteryName) {
	const deps: Record<string, string> = {}
	const devDeps: Record<string, string> = {}

	if (battery === 'reranker') {
		deps['ai'] = '^6.0.3'
		deps['@ai-sdk/cohere'] = '^3.0.1'
	}

	if (battery === 'eval') {
		// Intentionally no deps: runner is dependency-free and uses project wiring.
	}

	if (battery === 'debug') {
		// The debug server runs in the user's app:
		// - Bun runtimes use Bun.serve (no extra deps)
		// - Node runtimes (Next.js, etc.) fall back to `ws`
		deps['ws'] = '^8.18.0'
	}

	return {deps, devDeps}
}

export function installCmd(pm: PackageManager) {
	if (pm === 'bun') return 'bun install'
	if (pm === 'pnpm') return 'pnpm install'
	if (pm === 'yarn') return 'yarn'
	return 'npm install'
}

function installSpawnSpec(pm: PackageManager): {cmd: string; args: string[]} {
	if (pm === 'bun') return {cmd: 'bun', args: ['install']}
	if (pm === 'pnpm') return {cmd: 'pnpm', args: ['install']}
	if (pm === 'yarn') return {cmd: 'yarn', args: []}
	return {cmd: 'npm', args: ['install']}
}

export async function installDependencies(projectRoot: string): Promise<void> {
	const pm = await detectPackageManager(projectRoot)
	const {cmd, args} = installSpawnSpec(pm)

	await new Promise<void>((resolve, reject) => {
		const child = spawn(cmd, args, {
			cwd: projectRoot,
			stdio: 'inherit',
			env: process.env
		})

		child.on('error', (err) => reject(err))
		child.on('exit', (code, signal) => {
			if (code === 0) return resolve()
			reject(
				new Error(
					`Dependency installation failed (${installCmd(pm)}). Exit code: ${
						code ?? 'null'
					}, signal: ${signal ?? 'null'}`
				)
			)
		})
	})
}
