/**
 * `unrag doctor setup` command
 *
 * Interactive wizard that generates a project-specific doctor config file
 * and adds convenient package.json scripts.
 */

import path from 'node:path'
import {
	cancel,
	confirm,
	isCancel,
	multiselect,
	outro,
	select,
	spinner,
	text
} from '@clack/prompts'
import {docsUrl} from '../lib/constants'
import {
	DEFAULT_ENV_LOAD_FILES,
	DOCTOR_CONFIG_VERSION,
	type DoctorConfig
} from '../lib/doctor/doctorConfig'
import {inferInstallState, inferTableNames} from '../lib/doctor/infer'
import {ensureDir, exists, tryFindProjectRoot} from '../lib/fs'
import {readJsonFile, writeJsonFile} from '../lib/json'

const DEFAULT_CONFIG_PATH = '.unrag/doctor.json'

type ParsedSetupArgs = {
	yes?: boolean
	projectRoot?: string
	configPath?: string
}

type PackageJson = {
	name?: string
	scripts?: Record<string, string>
	[key: string]: unknown
}

function parseSetupArgs(args: string[]): ParsedSetupArgs {
	const out: ParsedSetupArgs = {}

	for (let i = 0; i < args.length; i++) {
		const a = args[i]

		if (a === '--yes' || a === '-y') {
			out.yes = true
			continue
		}

		if (a === '--project-root') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.projectRoot = v
				i++
			}
			continue
		}

		if (a === '--config') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.configPath = v
				i++
			}
		}
	}

	return out
}

function renderSetupHelp(): string {
	return [
		'unrag doctor setup — configure doctor for your project',
		'',
		'Usage:',
		'  unrag doctor setup [options]',
		'',
		'Options:',
		'  --yes, -y               Non-interactive; accept defaults',
		'  --project-root <path>   Override project root directory',
		'  --config <path>         Output config file path (default: .unrag/doctor.json)',
		'',
		'This command will:',
		'  1. Detect your Unrag installation settings',
		'  2. Create a doctor config file with your project-specific settings',
		'  3. Add convenient npm scripts to your package.json:',
		'     - unrag:doctor      Run static checks',
		'     - unrag:doctor:db   Run with database checks',
		'     - unrag:doctor:ci   Run strict mode with JSON output for CI',
		'',
		'Examples:',
		'  unrag doctor setup                  Interactive setup',
		'  unrag doctor setup --yes            Use detected defaults',
		'  unrag doctor setup --config .doctor.json   Custom config location',
		'',
		'Docs:',
		`  ${docsUrl('/docs/reference/cli')}`
	].join('\n')
}

/**
 * Main doctor setup command handler.
 */
export async function doctorSetupCommand(args: string[]): Promise<void> {
	// Check for help flag
	if (args.includes('--help') || args.includes('-h')) {
		outro(renderSetupHelp())
		return
	}

	const parsed = parseSetupArgs(args)
	const nonInteractive = Boolean(parsed.yes) || !process.stdin.isTTY

	// 1. Find project root
	const projectRoot =
		parsed.projectRoot ??
		(await tryFindProjectRoot(process.cwd())) ??
		process.cwd()

	const s = spinner()
	s.start('Detecting project configuration...')

	// 2. Infer install state
	const state = await inferInstallState({
		projectRootOverride: projectRoot
	})

	// 3. Infer table names from store adapter
	const tableNames = state.installDir
		? await inferTableNames(
				path.join(projectRoot, state.installDir),
				state.storeAdapter
			)
		: {documents: 'documents', chunks: 'chunks', embeddings: 'embeddings'}

	s.stop('Configuration detected.')

	// 4. Interactive prompts (or use defaults)
	const configPathAnswer = parsed.configPath
		? parsed.configPath
		: nonInteractive
			? DEFAULT_CONFIG_PATH
			: await text({
					message: 'Config file path',
					initialValue: DEFAULT_CONFIG_PATH,
					validate: (v) => {
						if (!v.trim()) {
							return 'Config path is required'
						}
						if (!v.endsWith('.json')) {
							return 'Config file must be .json'
						}
						return
					}
				})

	if (isCancel(configPathAnswer)) {
		cancel('Cancelled.')
		return
	}
	const configPath = String(configPathAnswer).trim()

	// Check if config already exists
	const configFullPath = path.isAbsolute(configPath)
		? configPath
		: path.join(projectRoot, configPath)

	if (await exists(configFullPath)) {
		if (nonInteractive) {
			// In non-interactive mode, we overwrite
		} else {
			const overwrite = await confirm({
				message: `Config file ${configPath} already exists. Overwrite?`,
				initialValue: false
			})
			if (isCancel(overwrite)) {
				cancel('Cancelled.')
				return
			}
			if (!overwrite) {
				outro('Keeping existing config file.')
				return
			}
		}
	}

	// Install directory
	const installDirAnswer = nonInteractive
		? (state.installDir ?? 'lib/unrag')
		: await text({
				message: 'Unrag install directory',
				initialValue: state.installDir ?? 'lib/unrag',
				validate: (v) => {
					if (!v.trim()) {
						return 'Install directory is required'
					}
					return
				}
			})

	if (isCancel(installDirAnswer)) {
		cancel('Cancelled.')
		return
	}
	const installDir = String(installDirAnswer).trim()

	// Env files to load
	const envFilesAnswer = nonInteractive
		? DEFAULT_ENV_LOAD_FILES
		: await multiselect({
				message:
					'Which .env files should doctor load? (space to toggle)',
				options: [
					{value: '.env', label: '.env', hint: 'base env'},
					{
						value: '.env.local',
						label: '.env.local',
						hint: 'local overrides'
					},
					{
						value: '.env.${NODE_ENV}',
						label: '.env.${NODE_ENV}',
						hint: 'e.g. .env.development'
					},
					{
						value: '.env.${NODE_ENV}.local',
						label: '.env.${NODE_ENV}.local',
						hint: 'e.g. .env.development.local'
					}
				],
				initialValues: DEFAULT_ENV_LOAD_FILES,
				required: false
			})

	if (isCancel(envFilesAnswer)) {
		cancel('Cancelled.')
		return
	}
	const envFiles = envFilesAnswer as string[]

	// Database URL env var
	const dbEnvVarDefault = state.inferredDbEnvVar ?? 'DATABASE_URL'
	const dbEnvVarAnswer = nonInteractive
		? dbEnvVarDefault
		: await text({
				message: 'Database URL environment variable name',
				initialValue: dbEnvVarDefault,
				validate: (v) => {
					if (!v.trim()) {
						return 'Env var name is required'
					}
					if (!/^[A-Z_][A-Z0-9_]*$/i.test(v)) {
						return 'Invalid env var name'
					}
					return
				}
			})

	if (isCancel(dbEnvVarAnswer)) {
		cancel('Cancelled.')
		return
	}
	const databaseUrlEnv = String(dbEnvVarAnswer).trim()

	// Database schema
	const schemaAnswer = nonInteractive
		? 'public'
		: await text({
				message: 'Database schema name',
				initialValue: 'public'
			})

	if (isCancel(schemaAnswer)) {
		cancel('Cancelled.')
		return
	}
	const schema = String(schemaAnswer).trim() || 'public'

	// Table names
	const documentsTableAnswer = nonInteractive
		? tableNames.documents
		: await text({
				message: 'Documents table name',
				initialValue: tableNames.documents
			})

	if (isCancel(documentsTableAnswer)) {
		cancel('Cancelled.')
		return
	}
	const documentsTable = String(documentsTableAnswer).trim() || 'documents'

	const chunksTableAnswer = nonInteractive
		? tableNames.chunks
		: await text({
				message: 'Chunks table name',
				initialValue: tableNames.chunks
			})

	if (isCancel(chunksTableAnswer)) {
		cancel('Cancelled.')
		return
	}
	const chunksTable = String(chunksTableAnswer).trim() || 'chunks'

	const embeddingsTableAnswer = nonInteractive
		? tableNames.embeddings
		: await text({
				message: 'Embeddings table name',
				initialValue: tableNames.embeddings
			})

	if (isCancel(embeddingsTableAnswer)) {
		cancel('Cancelled.')
		return
	}
	const embeddingsTable = String(embeddingsTableAnswer).trim() || 'embeddings'

	// Default scope
	const scopeAnswer = nonInteractive
		? ''
		: await text({
				message:
					'Default scope prefix for dimension checks (optional, press enter to skip)',
				initialValue: ''
			})

	if (isCancel(scopeAnswer)) {
		cancel('Cancelled.')
		return
	}
	const defaultScope = String(scopeAnswer).trim() || null

	// Strict mode default
	const strictAnswer = nonInteractive
		? false
		: await confirm({
				message:
					'Enable strict mode by default? (treat warnings as failures)',
				initialValue: false
			})

	if (isCancel(strictAnswer)) {
		cancel('Cancelled.')
		return
	}
	const strictDefault = Boolean(strictAnswer)

	// CI script options
	const ciIncludeDbAnswer = nonInteractive
		? true
		: await confirm({
				message: 'Should CI script include database checks (--db)?',
				initialValue: true
			})

	if (isCancel(ciIncludeDbAnswer)) {
		cancel('Cancelled.')
		return
	}
	const ciIncludeDb = Boolean(ciIncludeDbAnswer)

	const ciStrictAnswer = nonInteractive
		? true
		: await confirm({
				message: 'Should CI script use strict mode (--strict)?',
				initialValue: true
			})

	if (isCancel(ciStrictAnswer)) {
		cancel('Cancelled.')
		return
	}
	const ciStrict = Boolean(ciStrictAnswer)

	// 5. Build config object
	const config: DoctorConfig = {
		version: DOCTOR_CONFIG_VERSION,
		installDir,
		env: {
			loadFiles: envFiles,
			databaseUrlEnv
		},
		db: {
			schema,
			tables: {
				documents: documentsTable,
				chunks: chunksTable,
				embeddings: embeddingsTable
			}
		},
		defaults: {
			scope: defaultScope,
			strict: strictDefault
		}
	}

	// 6. Write config file
	const configDir = path.dirname(configFullPath)
	if (!(await exists(configDir))) {
		await ensureDir(configDir)
	}
	await writeJsonFile(configFullPath, config)

	// 7. Build package.json scripts
	const relConfigPath = path.relative(projectRoot, configFullPath)
	const scripts: Record<string, string> = {
		'unrag:doctor': `unrag doctor --config ${relConfigPath}`,
		'unrag:doctor:db': `unrag doctor --config ${relConfigPath} --db`,
		'unrag:doctor:ci': buildCiScript(relConfigPath, ciIncludeDb, ciStrict)
	}

	// 8. Update package.json
	const pkgPath = path.join(projectRoot, 'package.json')
	const pkg = await readJsonFile<PackageJson>(pkgPath)

	if (!pkg) {
		outro(
			[
				`Created ${relConfigPath}`,
				'',
				'Could not find package.json to add scripts.',
				'Add these scripts manually:',
				...Object.entries(scripts).map(([k, v]) => `  "${k}": "${v}"`)
			].join('\n')
		)
		return
	}

	const existingScripts = pkg.scripts ?? {}
	const conflictingScripts = Object.keys(scripts).filter(
		(k) => k in existingScripts
	)

	const scriptsToAdd: Record<string, string> = scripts

	if (conflictingScripts.length > 0 && !nonInteractive) {
		// Ask about each conflicting script
		for (const scriptName of conflictingScripts) {
			const action = await select({
				message: `Script "${scriptName}" already exists. What would you like to do?`,
				options: [
					{
						value: 'keep',
						label: 'Keep existing',
						hint: existingScripts[scriptName]
					},
					{
						value: 'overwrite',
						label: 'Overwrite',
						hint: scripts[scriptName]
					},
					{
						value: 'rename',
						label: 'Add with different name',
						hint: `${scriptName}:new`
					}
				],
				initialValue: 'keep'
			})

			if (isCancel(action)) {
				cancel('Cancelled.')
				return
			}

			if (action === 'keep') {
				delete scriptsToAdd[scriptName]
			} else if (action === 'rename') {
				const newName = await text({
					message: `New script name for ${scriptName}`,
					initialValue: `${scriptName}:new`,
					validate: (v) => {
						if (!v.trim()) {
							return 'Script name is required'
						}
						if (v in existingScripts || v in scriptsToAdd) {
							return 'Script name already exists'
						}
						return
					}
				})

				if (isCancel(newName)) {
					cancel('Cancelled.')
					return
				}

				const value = scriptsToAdd[scriptName]
				if (value === undefined) {
					continue
				}
				delete scriptsToAdd[scriptName]
				scriptsToAdd[String(newName)] = value
			}
			// For "overwrite", keep it in scriptsToAdd
		}
	} else if (conflictingScripts.length > 0 && nonInteractive) {
		// In non-interactive mode, keep existing scripts (non-destructive)
		for (const scriptName of conflictingScripts) {
			delete scriptsToAdd[scriptName]
		}
	}

	// Write updated package.json
	if (Object.keys(scriptsToAdd).length > 0) {
		pkg.scripts = {
			...existingScripts,
			...scriptsToAdd
		}
		await writeJsonFile(pkgPath, pkg)
	}

	// 9. Output summary
	const addedScripts = Object.keys(scriptsToAdd)
	const skippedScripts = conflictingScripts.filter(
		(k) =>
			!(k in scriptsToAdd) &&
			!addedScripts.some((a) => a !== k && scripts[k])
	)

	outro(
		[
			`Created ${relConfigPath}`,
			'',
			addedScripts.length > 0
				? `Added scripts to package.json:\n${addedScripts.map((k) => `  ${k}: ${scriptsToAdd[k]}`).join('\n')}`
				: 'No new scripts added.',
			skippedScripts.length > 0
				? `\nKept existing scripts: ${skippedScripts.join(', ')}`
				: '',
			'',
			'Usage:',
			'  npm run unrag:doctor       # Static checks',
			'  npm run unrag:doctor:db    # Include database checks',
			'  npm run unrag:doctor:ci    # CI mode (JSON output)',
			'',
			'Or run directly:',
			`  unrag doctor --config ${relConfigPath}`
		]
			.filter(Boolean)
			.join('\n')
	)
}

function buildCiScript(
	configPath: string,
	includeDb: boolean,
	strict: boolean
): string {
	const parts = ['unrag doctor', `--config ${configPath}`]
	if (includeDb) {
		parts.push('--db')
	}
	if (strict) {
		parts.push('--strict')
	}
	parts.push('--json')
	return parts.join(' ')
}
