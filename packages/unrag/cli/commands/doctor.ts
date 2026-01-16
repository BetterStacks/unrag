/**
 * `unrag doctor` command
 *
 * Validates Unrag installations with static checks (default) and optional
 * database checks (--db flag).
 */

import path from 'node:path'
import {outro, spinner} from '@clack/prompts'
import type {
	CheckGroup,
	CheckResult,
	DoctorReport,
	ParsedDoctorArgs
} from '../lib/doctor/types'
import {inferInstallState} from '../lib/doctor/infer'
import {runStaticChecks} from '../lib/doctor/staticChecks'
import {runConfigCoherenceChecks} from '../lib/doctor/configScan'
import {runDbChecks} from '../lib/doctor/dbChecks'
import {formatReport, formatJson} from '../lib/doctor/output'
import {loadEnvFilesFromList} from '../lib/doctor/env'
import {docsUrl} from '../lib/constants'
import {tryFindProjectRoot} from '../lib/fs'
import {
	readDoctorConfig,
	mergeDoctorArgsWithConfig,
	getEnvFilesToLoad,
	resolveConfigPath
} from '../lib/doctor/doctorConfig'
import {doctorSetupCommand} from './doctor-setup'

type ParsedDoctorArgsWithConfig = ParsedDoctorArgs & {
	config?: string
}

/**
 * Parse doctor command arguments.
 */
function parseDoctorArgs(args: string[]): ParsedDoctorArgsWithConfig {
	const out: ParsedDoctorArgsWithConfig = {}

	for (let i = 0; i < args.length; i++) {
		const a = args[i]

		if (a === '--db') {
			out.db = true
			continue
		}

		if (a === '--json') {
			out.json = true
			continue
		}

		if (a === '--strict') {
			out.strict = true
			continue
		}

		if (a === '--config') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.config = v
				i++
			}
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

		if (a === '--install-dir' || a === '--dir') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.installDir = v
				i++
			}
			continue
		}

		if (a === '--schema') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.schema = v
				i++
			}
			continue
		}

		if (a === '--scope') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.scope = v
				i++
			}
			continue
		}

		if (a === '--database-url') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.databaseUrl = v
				i++
			}
			continue
		}

		if (a === '--database-url-env') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.databaseUrlEnv = v
				i++
			}
			continue
		}

		if (a === '--env-file') {
			const v = args[i + 1]
			if (v && !v.startsWith('-')) {
				out.envFile = v
				i++
			}
			continue
		}
	}

	return out
}

/**
 * Render help for doctor command.
 */
function renderDoctorHelp(): string {
	return [
		'unrag doctor — validate your Unrag installation',
		'',
		'Usage:',
		'  unrag doctor [options]',
		'  unrag doctor setup [options]',
		'',
		'Subcommands:',
		'  setup                   Generate project-specific doctor config and package.json scripts',
		'',
		'Options:',
		'  --config <path>         Load settings from a doctor config file',
		'  --db                    Run database checks (connectivity, pgvector, schema, indexes)',
		'  --json                  Output results as JSON (for CI)',
		'  --strict                Treat warnings as failures',
		'  --project-root <path>   Override project root directory',
		'  --install-dir <path>    Override Unrag install directory',
		'  --schema <name>         Database schema name (default: public)',
		'  --scope <prefix>        Limit dimension checks to sourceId prefix',
		'  --database-url <url>    Database connection string (overrides env)',
		'  --database-url-env <name>  Env var name for database URL',
		'  --env-file <path>       Load env vars from a specific .env file (optional)',
		'',
		'Static checks (default):',
		'  - Project/install integrity (unrag.json, config, install dir)',
		'  - Environment variables (DATABASE_URL, provider keys)',
		'  - Dependencies (pg, drizzle-orm, etc.)',
		'  - Module presence (extractors, connectors)',
		'  - Config coherence (extractors wired and enabled)',
		'',
		'Database checks (--db):',
		'  - PostgreSQL connectivity',
		'  - pgvector extension installed',
		'  - Schema/table validation',
		'  - Index recommendations',
		'  - Embedding dimension consistency',
		'',
		'Exit codes:',
		'  0  All checks passed (warnings allowed unless --strict)',
		'  1  One or more checks failed',
		'  2  Doctor could not run (internal error)',
		'',
		'Examples:',
		'  unrag doctor                    Run static checks',
		'  unrag doctor --db               Include database checks',
		'  unrag doctor --db --strict      Fail on warnings too',
		'  unrag doctor --json             Output JSON for CI',
		'  unrag doctor --config .unrag/doctor.json   Use project config',
		'  unrag doctor setup              Generate config and scripts',
		'',
		'Docs:',
		`  ${docsUrl('/docs/reference/cli')}`
	].join('\n')
}

/**
 * Main doctor command handler.
 */
export async function doctorCommand(args: string[]): Promise<void> {
	// Check for help flag
	if (args.includes('--help') || args.includes('-h')) {
		outro(renderDoctorHelp())
		return
	}

	// Check for setup subcommand
	if (args[0] === 'setup') {
		await doctorSetupCommand(args.slice(1))
		return
	}

	const parsed = parseDoctorArgs(args)

	const s = spinner()
	s.start('Running doctor checks...')

	try {
		// 0. Determine project root early for config loading
		const projectRoot =
			parsed.projectRoot ??
			(await tryFindProjectRoot(process.cwd())) ??
			process.cwd()

		// 0.1 Load doctor config file if specified
		let doctorConfig = null
		if (parsed.config) {
			const configPath = resolveConfigPath(projectRoot, parsed.config)
			doctorConfig = await readDoctorConfig(configPath)
			if (!doctorConfig) {
				s.stop('Doctor failed.')
				outro(`Error: Could not read config file: ${parsed.config}`)
				process.exitCode = 2
				return
			}
		}

		// 0.2 Merge CLI args with config (CLI takes precedence)
		const mergedArgs = mergeDoctorArgsWithConfig(
			parsed,
			doctorConfig,
			projectRoot
		)

		// 1. Infer install state
		const state = await inferInstallState({
			projectRootOverride: projectRoot,
			installDirOverride: mergedArgs.installDir
		})

		// 1.1 Load env files (best-effort) so `doctor` sees .env / .env.local values.
		// This does NOT override already-set process.env keys.
		const envFilesToLoad = getEnvFilesToLoad(
			doctorConfig,
			mergedArgs.envFile
		)
		await loadEnvFilesFromList({
			projectRoot: state.projectRoot,
			files: envFilesToLoad
		})

		// 2. Run static checks
		const staticResults = await runStaticChecks(state)

		// 3. Run config coherence checks
		const coherenceResults = await runConfigCoherenceChecks(state)

		// 4. Run DB checks if requested
		let dbResults: CheckResult[] = []
		if (mergedArgs.db) {
			dbResults = await runDbChecks(state, {
				databaseUrl: mergedArgs.databaseUrl,
				databaseUrlEnv:
					mergedArgs.databaseUrlEnv ??
					doctorConfig?.env?.databaseUrlEnv,
				schema:
					mergedArgs.schema ?? doctorConfig?.db?.schema ?? 'public',
				scope: mergedArgs.scope
			})
		}

		s.stop('Doctor checks complete.')

		// 5. Build report
		const groups: CheckGroup[] = [
			{
				id: 'install',
				title: 'Installation',
				results: staticResults.install
			},
			{
				id: 'env',
				title: 'Environment',
				results: staticResults.env
			},
			{
				id: 'modules',
				title: 'Modules',
				results: staticResults.modules
			},
			{
				id: 'config',
				title: 'Configuration',
				results: coherenceResults
			}
		]

		if (mergedArgs.db) {
			groups.push({
				id: 'database',
				title: 'Database',
				results: dbResults
			})
		}

		const allResults = groups.flatMap((g) => g.results)
		const summary = {
			total: allResults.length,
			pass: allResults.filter((r) => r.status === 'pass').length,
			warn: allResults.filter((r) => r.status === 'warn').length,
			fail: allResults.filter((r) => r.status === 'fail').length,
			skip: allResults.filter((r) => r.status === 'skip').length
		}

		const report: DoctorReport = {groups, summary}

		// 6. Output
		if (mergedArgs.json) {
			console.log(formatJson(report))
		} else {
			outro(formatReport(report, {showDbHint: !mergedArgs.db}))
		}

		// 7. Exit code
		const hasFails = summary.fail > 0
		const hasWarns = summary.warn > 0

		if (hasFails) {
			process.exitCode = 1
		} else if (mergedArgs.strict && hasWarns) {
			process.exitCode = 1
		}
	} catch (err) {
		s.stop('Doctor failed.')
		const message = err instanceof Error ? err.message : String(err)
		outro(`Error: ${message}`)
		process.exitCode = 2
	}
}
