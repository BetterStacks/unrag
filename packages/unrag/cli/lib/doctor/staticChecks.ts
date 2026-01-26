/**
 * Static checks for doctor command.
 * Validates install integrity, env vars, dependencies, and module presence.
 */

import path from 'node:path'
import {docsUrl} from '../constants'
import {exists} from '../fs'
import {readJsonFile} from '../json'
import type {CheckResult, InferredInstallState} from './types'
import {EMBEDDING_PROVIDER_ENV_VARS, STORE_ADAPTER_DEPS} from './types'

type StaticCheckResults = {
	install: CheckResult[]
	env: CheckResult[]
	modules: CheckResult[]
}

/**
 * Run all static checks.
 */
export async function runStaticChecks(
	state: InferredInstallState
): Promise<StaticCheckResults> {
	const install = await runInstallChecks(state)
	const env = await runEnvChecks(state)
	const modules = await runModuleChecks(state)

	return {install, env, modules}
}

/**
 * Check project/install integrity.
 */
async function runInstallChecks(
	state: InferredInstallState
): Promise<CheckResult[]> {
	const results: CheckResult[] = []

	// 1. unrag.json check
	results.push(
		state.unragJsonExists && state.unragJsonParseable
			? {
					id: 'unrag-json',
					title: 'unrag.json',
					status: 'pass',
					summary: 'Configuration file found and parseable.',
					meta: {version: state.unragJson?.version}
				}
			: state.unragJsonExists
				? {
						id: 'unrag-json',
						title: 'unrag.json',
						status: 'warn',
						summary:
							'Configuration file exists but could not be parsed.',
						fixHints: [
							'Check for JSON syntax errors in unrag.json',
							'Try running `unrag init` again to regenerate'
						]
					}
				: {
						id: 'unrag-json',
						title: 'unrag.json',
						status: 'warn',
						summary: 'Configuration file not found.',
						details: [
							'Doctor is inferring configuration from filesystem.',
							`Inference confidence: ${state.inferenceConfidence}`
						],
						fixHints: ['Run `unrag init` to create unrag.json'],
						docsLink: docsUrl('/docs/reference/cli')
					}
	)

	// 2. unrag.config.ts check
	results.push(
		state.configFileExists
			? {
					id: 'config-ts',
					title: 'unrag.config.ts',
					status: 'pass',
					summary: 'Engine configuration file found.'
				}
			: {
					id: 'config-ts',
					title: 'unrag.config.ts',
					status: 'fail',
					summary: 'Engine configuration file not found.',
					details: [
						'unrag.config.ts is required to create and configure the Unrag engine.'
					],
					fixHints: ['Run `unrag init` to create unrag.config.ts'],
					docsLink: docsUrl('/docs/getting-started/quickstart')
				}
	)

	// 3. Install directory check
	if (state.installDir) {
		const installDirFull = path.join(state.projectRoot, state.installDir)
		const coreExists = await exists(path.join(installDirFull, 'core'))
		const storeExists = await exists(path.join(installDirFull, 'store'))
		const embeddingExists = await exists(
			path.join(installDirFull, 'embedding')
		)
		const coreConnectorsExists =
			coreExists &&
			(await exists(path.join(installDirFull, 'core', 'connectors.ts')))
		const unragMdExists = await exists(
			path.join(installDirFull, 'unrag.md')
		)

		const missingDirs: string[] = []
		if (!coreExists) {
			missingDirs.push('core/')
		}
		if (!storeExists) {
			missingDirs.push('store/')
		}
		if (!embeddingExists) {
			missingDirs.push('embedding/')
		}

		const missingCoreFiles: string[] = []
		if (!coreConnectorsExists) {
			missingCoreFiles.push('core/connectors.ts')
		}

		if (
			state.installDirExists &&
			missingDirs.length === 0 &&
			missingCoreFiles.length === 0
		) {
			results.push({
				id: 'install-dir',
				title: 'Install directory',
				status: 'pass',
				summary: `Install directory found at ${state.installDir}`,
				details: [
					`core/: ${coreExists ? '✓' : '✗'}`,
					`core/connectors.ts: ${coreConnectorsExists ? '✓' : '✗'}`,
					`store/: ${storeExists ? '✓' : '✗'}`,
					`embedding/: ${embeddingExists ? '✓' : '✗'}`,
					`unrag.md: ${unragMdExists ? '✓' : '✗'}`
				]
			})
		} else if (state.installDirExists) {
			const missing: string[] = [
				...missingDirs,
				...missingCoreFiles
			].filter(Boolean)
			results.push({
				id: 'install-dir',
				title: 'Install directory',
				status: 'warn',
				summary: 'Install directory exists but is incomplete.',
				details: [`Missing: ${missing.join(', ')}`],
				fixHints: ['Run `unrag init` to reinstall missing files']
			})
		} else {
			results.push({
				id: 'install-dir',
				title: 'Install directory',
				status: 'fail',
				summary: `Install directory not found at ${state.installDir}`,
				fixHints: [
					'Run `unrag init` to install Unrag files',
					'Or use --install-dir to specify a different location'
				]
			})
		}
	} else {
		results.push({
			id: 'install-dir',
			title: 'Install directory',
			status: 'fail',
			summary: 'Could not determine install directory.',
			fixHints: [
				'Run `unrag init` to install Unrag',
				'Or use --install-dir to specify the location'
			]
		})
	}

	// 4. Store adapter check
	if (state.storeAdapter) {
		results.push({
			id: 'store-adapter',
			title: 'Store adapter',
			status: 'pass',
			summary: `Using ${state.storeAdapter} adapter.`
		})
	} else if (state.installDirExists) {
		results.push({
			id: 'store-adapter',
			title: 'Store adapter',
			status: 'warn',
			summary: 'Could not determine store adapter.',
			details: [
				'Expected to find drizzle, prisma, or raw-sql adapter folder.'
			]
		})
	}

	// 5. Dependencies check
	const depResults = await checkDependencies(state)
	results.push(...depResults)

	return results
}

/**
 * Check that required dependencies are installed.
 */
async function checkDependencies(
	state: InferredInstallState
): Promise<CheckResult[]> {
	const results: CheckResult[] = []

	const pkgJsonPath = path.join(state.projectRoot, 'package.json')
	if (!(await exists(pkgJsonPath))) {
		results.push({
			id: 'deps-check',
			title: 'Dependencies',
			status: 'skip',
			summary: 'No package.json found.'
		})
		return results
	}

	const pkgJson = await readJsonFile<{
		dependencies?: Record<string, string>
		devDependencies?: Record<string, string>
	}>(pkgJsonPath)

	if (!pkgJson) {
		results.push({
			id: 'deps-check',
			title: 'Dependencies',
			status: 'warn',
			summary: 'Could not parse package.json.'
		})
		return results
	}

	const allDeps = {
		...(pkgJson.dependencies ?? {}),
		...(pkgJson.devDependencies ?? {})
	}

	// Check store adapter deps
	if (state.storeAdapter) {
		const adapterDeps = STORE_ADAPTER_DEPS[state.storeAdapter]
		const missingDeps: string[] = []

		for (const dep of adapterDeps.required) {
			if (!allDeps[dep]) {
				missingDeps.push(dep)
			}
		}

		if (missingDeps.length === 0) {
			results.push({
				id: 'deps-store',
				title: `${state.storeAdapter} dependencies`,
				status: 'pass',
				summary: 'All required dependencies installed.'
			})
		} else {
			results.push({
				id: 'deps-store',
				title: `${state.storeAdapter} dependencies`,
				status: 'fail',
				summary: `Missing dependencies: ${missingDeps.join(', ')}`,
				fixHints: [`Run: npm install ${missingDeps.join(' ')}`]
			})
		}
	}

	// Check for ai SDK (required for all setups)
	if (!allDeps.ai) {
		results.push({
			id: 'deps-ai',
			title: 'AI SDK',
			status: 'fail',
			summary: 'Missing required dependency: ai',
			fixHints: ['Run: npm install ai']
		})
	}

	return results
}

/**
 * Check environment variables.
 */
async function runEnvChecks(
	state: InferredInstallState
): Promise<CheckResult[]> {
	const results: CheckResult[] = []

	// 1. DATABASE_URL check
	const dbUrl =
		process.env.DATABASE_URL ||
		(state.inferredDbEnvVar
			? process.env[state.inferredDbEnvVar]
			: undefined)
	const dbEnvVarName = state.inferredDbEnvVar ?? 'DATABASE_URL'
	const actualEnvVar = process.env.DATABASE_URL
		? 'DATABASE_URL'
		: state.inferredDbEnvVar && process.env[state.inferredDbEnvVar]
			? state.inferredDbEnvVar
			: null

	if (dbUrl) {
		// Basic validation
		const isValidFormat =
			dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')
		results.push({
			id: 'env-database-url',
			title: 'Database URL',
			status: isValidFormat ? 'pass' : 'warn',
			summary: isValidFormat
				? `${actualEnvVar} is set and appears to be a valid Postgres URL.`
				: `${actualEnvVar} is set but doesn't look like a Postgres URL.`,
			details: isValidFormat
				? undefined
				: ['Expected format: postgres://user:pass@host:port/db'],
			meta: {envVar: actualEnvVar}
		})
	} else {
		results.push({
			id: 'env-database-url',
			title: 'Database URL',
			status: 'warn',
			summary: `${dbEnvVarName} is not set.`,
			details:
				state.inferredDbEnvVar &&
				state.inferredDbEnvVar !== 'DATABASE_URL'
					? [
							`Inferred env var from config: ${state.inferredDbEnvVar}`,
							'Neither DATABASE_URL nor the inferred var is set.'
						]
					: undefined,
			fixHints: [
				`Set ${dbEnvVarName} to your Postgres connection string`,
				'Example: postgresql://user:pass@localhost:5432/mydb'
			],
			docsLink: docsUrl('/docs/getting-started/database')
		})
	}

	// 2. Embedding provider env vars
	if (state.embeddingProvider) {
		const providerEnv = EMBEDDING_PROVIDER_ENV_VARS[state.embeddingProvider]
		if (providerEnv) {
			const missingRequired: string[] = []
			const missingOptional: string[] = []

			for (const envVar of providerEnv.required) {
				if (!process.env[envVar]) {
					missingRequired.push(envVar)
				}
			}
			for (const envVar of providerEnv.optional) {
				if (!process.env[envVar]) {
					missingOptional.push(envVar)
				}
			}

			if (missingRequired.length === 0) {
				results.push({
					id: 'env-embedding',
					title: `${state.embeddingProvider} provider`,
					status: 'pass',
					summary: 'Required environment variables are set.',
					details:
						missingOptional.length > 0
							? [
									`Optional (not set): ${missingOptional.join(', ')}`
								]
							: undefined
				})
			} else {
				results.push({
					id: 'env-embedding',
					title: `${state.embeddingProvider} provider`,
					status: 'fail',
					summary: `Missing required env vars: ${missingRequired.join(', ')}`,
					fixHints: missingRequired.map(
						(v) => `Set ${v} in your environment`
					),
					docsLink: docsUrl(
						`/docs/providers/${state.embeddingProvider}`
					)
				})
			}
		}
	} else {
		results.push({
			id: 'env-embedding',
			title: 'Embedding provider',
			status: 'skip',
			summary: 'Could not determine embedding provider.'
		})
	}

	// 3. Connector env vars
	for (const connector of state.installedConnectors) {
		const connectorEnvResults = await checkConnectorEnvVars(connector)
		results.push(...connectorEnvResults)
	}

	return results
}

/**
 * Check connector-specific env vars.
 */
async function checkConnectorEnvVars(
	connector: string
): Promise<CheckResult[]> {
	const results: CheckResult[] = []

	// Known connector env var requirements
	const connectorEnvVars: Record<
		string,
		{required: string[]; optional: string[]}
	> = {
		notion: {
			required: ['NOTION_TOKEN'],
			optional: []
		},
		'google-drive': {
			required: [],
			optional: [
				'GOOGLE_SERVICE_ACCOUNT_JSON',
				'GOOGLE_CLIENT_ID',
				'GOOGLE_CLIENT_SECRET'
			]
		},
		onedrive: {
			required: [],
			optional: [
				'AZURE_TENANT_ID',
				'AZURE_CLIENT_ID',
				'AZURE_CLIENT_SECRET'
			]
		},
		dropbox: {
			required: [],
			optional: ['DROPBOX_CLIENT_ID', 'DROPBOX_CLIENT_SECRET']
		}
	}

	const envVars = connectorEnvVars[connector]
	if (!envVars) {
		return results
	}

	const missingRequired: string[] = []
	for (const envVar of envVars.required) {
		if (!process.env[envVar]) {
			missingRequired.push(envVar)
		}
	}

	if (envVars.required.length === 0) {
		// All optional
		const hasAny = envVars.optional.some((v) => process.env[v])
		results.push({
			id: `env-connector-${connector}`,
			title: `${connector} connector`,
			status: hasAny ? 'pass' : 'warn',
			summary: hasAny
				? 'Connector credentials configured.'
				: 'No credentials found (may be configured at runtime).',
			docsLink: docsUrl(`/docs/connectors/${connector}`)
		})
	} else if (missingRequired.length === 0) {
		results.push({
			id: `env-connector-${connector}`,
			title: `${connector} connector`,
			status: 'pass',
			summary: 'Required environment variables are set.'
		})
	} else {
		results.push({
			id: `env-connector-${connector}`,
			title: `${connector} connector`,
			status: 'fail',
			summary: `Missing required env vars: ${missingRequired.join(', ')}`,
			fixHints: missingRequired.map(
				(v) => `Set ${v} in your environment`
			),
			docsLink: docsUrl(`/docs/connectors/${connector}`)
		})
	}

	return results
}

/**
 * Check module presence (extractors, connectors).
 */
async function runModuleChecks(
	state: InferredInstallState
): Promise<CheckResult[]> {
	const results: CheckResult[] = []

	if (!state.installDir || !state.installDirExists) {
		return results
	}

	const installDirFull = path.join(state.projectRoot, state.installDir)

	// Check extractors
	for (const extractor of state.installedExtractors) {
		const extractorDir = path.join(installDirFull, 'extractors', extractor)
		const extractorExists = await exists(extractorDir)
		const hasIndex =
			extractorExists &&
			(await exists(path.join(extractorDir, 'index.ts')))

		if (extractorExists && hasIndex) {
			results.push({
				id: `module-extractor-${extractor}`,
				title: `Extractor: ${extractor}`,
				status: 'pass',
				summary: 'Module files present.'
			})
		} else if (extractorExists) {
			results.push({
				id: `module-extractor-${extractor}`,
				title: `Extractor: ${extractor}`,
				status: 'warn',
				summary: 'Module directory exists but may be incomplete.',
				details: ['Expected index.ts not found.']
			})
		} else {
			results.push({
				id: `module-extractor-${extractor}`,
				title: `Extractor: ${extractor}`,
				status: 'fail',
				summary: 'Listed in unrag.json but directory not found.',
				fixHints: [`Run: unrag add extractor ${extractor}`]
			})
		}
	}

	// Check connectors
	for (const connector of state.installedConnectors) {
		const connectorDir = path.join(installDirFull, 'connectors', connector)
		const connectorExists = await exists(connectorDir)
		const hasIndex =
			connectorExists &&
			(await exists(path.join(connectorDir, 'index.ts')))

		if (connectorExists && hasIndex) {
			results.push({
				id: `module-connector-${connector}`,
				title: `Connector: ${connector}`,
				status: 'pass',
				summary: 'Module files present.'
			})
		} else if (connectorExists) {
			results.push({
				id: `module-connector-${connector}`,
				title: `Connector: ${connector}`,
				status: 'warn',
				summary: 'Module directory exists but may be incomplete.'
			})
		} else {
			results.push({
				id: `module-connector-${connector}`,
				title: `Connector: ${connector}`,
				status: 'fail',
				summary: 'Listed in unrag.json but directory not found.',
				fixHints: [`Run: unrag add ${connector}`]
			})
		}
	}

	// Check chunkers
	for (const chunker of state.installedChunkers) {
		const chunkerDir = path.join(installDirFull, 'chunkers', chunker)
		const chunkerExists = await exists(chunkerDir)
		const hasIndex =
			chunkerExists && (await exists(path.join(chunkerDir, 'index.ts')))

		if (chunkerExists && hasIndex) {
			results.push({
				id: `module-chunker-${chunker}`,
				title: `Chunker: ${chunker}`,
				status: 'pass',
				summary: 'Module files present.'
			})
		} else if (chunkerExists) {
			results.push({
				id: `module-chunker-${chunker}`,
				title: `Chunker: ${chunker}`,
				status: 'warn',
				summary: 'Module directory exists but may be incomplete.',
				details: ['Expected index.ts not found.']
			})
		} else {
			results.push({
				id: `module-chunker-${chunker}`,
				title: `Chunker: ${chunker}`,
				status: 'fail',
				summary: 'Listed in unrag.json but directory not found.',
				fixHints: [`Run: unrag add chunker ${chunker}`]
			})
		}
	}

	// Check extractor dependencies
	const depResults = await checkExtractorDependencies(state)
	results.push(...depResults)

	return results
}

/**
 * Check that extractor dependencies are installed.
 */
async function checkExtractorDependencies(
	state: InferredInstallState
): Promise<CheckResult[]> {
	const results: CheckResult[] = []

	const pkgJsonPath = path.join(state.projectRoot, 'package.json')
	if (!(await exists(pkgJsonPath))) {
		return results
	}

	const pkgJson = await readJsonFile<{
		dependencies?: Record<string, string>
		devDependencies?: Record<string, string>
	}>(pkgJsonPath)

	if (!pkgJson) {
		return results
	}

	const allDeps = {
		...(pkgJson.dependencies ?? {}),
		...(pkgJson.devDependencies ?? {})
	}

	// Known extractor dependencies
	const extractorDeps: Record<string, string[]> = {
		'pdf-text-layer': ['pdfjs-dist'],
		'file-docx': ['mammoth'],
		'file-pptx': ['jszip'],
		'file-xlsx': ['xlsx']
		// AI-based extractors need 'ai' which is already checked
	}

	for (const extractor of state.installedExtractors) {
		const deps = extractorDeps[extractor]
		if (!deps || deps.length === 0) {
			continue
		}

		const missingDeps = deps.filter((d) => !allDeps[d])
		if (missingDeps.length > 0) {
			results.push({
				id: `deps-extractor-${extractor}`,
				title: `${extractor} dependencies`,
				status: 'fail',
				summary: `Missing: ${missingDeps.join(', ')}`,
				fixHints: [`Run: npm install ${missingDeps.join(' ')}`]
			})
		}
	}

	return results
}
