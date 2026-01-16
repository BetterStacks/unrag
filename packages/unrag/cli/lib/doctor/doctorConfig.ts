/**
 * Doctor config file schema and utilities.
 *
 * The config file `.unrag/doctor.json` stores project-specific doctor settings
 * (no secrets) so users can run `unrag doctor --config .unrag/doctor.json`
 * consistently across their team and CI.
 */

import path from 'node:path'
import {exists} from '../fs'
import {readJsonFile} from '../json'
import type {ParsedDoctorArgs} from './types'

/**
 * Doctor config file schema (JSON).
 * No secrets should be stored here.
 */
export type DoctorConfig = {
	/** Version of the config schema (for future migrations). */
	version?: number

	/** Relative path to the Unrag install directory (e.g. "lib/unrag"). */
	installDir?: string

	/** Environment variable loading settings. */
	env?: {
		/**
		 * List of .env files to load (relative to project root).
		 * Supports ${NODE_ENV} interpolation.
		 * Default: [".env", ".env.local", ".env.${NODE_ENV}", ".env.${NODE_ENV}.local"]
		 */
		loadFiles?: string[]

		/** Name of the env var containing the database URL (default: DATABASE_URL). */
		databaseUrlEnv?: string
	}

	/** Database settings for --db checks. */
	db?: {
		/** Database schema name (default: "public"). */
		schema?: string

		/** Table name overrides. */
		tables?: {
			documents?: string
			chunks?: string
			embeddings?: string
		}
	}

	/** Default values for flags. */
	defaults?: {
		/** Default scope prefix for dimension checks. */
		scope?: string | null

		/** Whether to treat warnings as failures. */
		strict?: boolean
	}
}

export const DOCTOR_CONFIG_VERSION = 1

export const DEFAULT_ENV_LOAD_FILES = [
	'.env',
	'.env.local',
	'.env.${NODE_ENV}',
	'.env.${NODE_ENV}.local'
]

/**
 * Read and validate a doctor config file.
 */
export async function readDoctorConfig(
	configPath: string
): Promise<DoctorConfig | null> {
	if (!(await exists(configPath))) {
		return null
	}

	const raw = await readJsonFile<DoctorConfig>(configPath)
	if (!raw || typeof raw !== 'object') {
		return null
	}

	// Basic validation
	if (raw.version !== undefined && typeof raw.version !== 'number') {
		return null
	}

	return raw
}

/**
 * Merge CLI args with config file values.
 * CLI args always take precedence.
 */
export function mergeDoctorArgsWithConfig(
	args: ParsedDoctorArgs,
	config: DoctorConfig | null,
	projectRoot: string
): ParsedDoctorArgs {
	if (!config) return args

	const merged: ParsedDoctorArgs = {...args}

	// installDir: CLI > config
	if (!merged.installDir && config.installDir) {
		merged.installDir = config.installDir
	}

	// schema: CLI > config > default
	if (!merged.schema && config.db?.schema) {
		merged.schema = config.db.schema
	}

	// scope: CLI > config
	if (merged.scope === undefined && config.defaults?.scope !== undefined) {
		merged.scope = config.defaults.scope ?? undefined
	}

	// strict: CLI > config
	if (merged.strict === undefined && config.defaults?.strict !== undefined) {
		merged.strict = config.defaults.strict
	}

	// databaseUrlEnv: CLI > config
	if (!merged.databaseUrlEnv && config.env?.databaseUrlEnv) {
		merged.databaseUrlEnv = config.env.databaseUrlEnv
	}

	return merged
}

/**
 * Get env files to load from config.
 */
export function getEnvFilesToLoad(
	config: DoctorConfig | null,
	extraEnvFile?: string
): string[] {
	const files = config?.env?.loadFiles ?? DEFAULT_ENV_LOAD_FILES

	// Interpolate ${NODE_ENV}
	const nodeEnv = (process.env.NODE_ENV ?? '').trim()
	const interpolated = files.map((f) => f.replace(/\$\{NODE_ENV\}/g, nodeEnv))

	// Add extra env file at the beginning if provided
	if (extraEnvFile) {
		return [extraEnvFile, ...interpolated.filter((f) => f !== extraEnvFile)]
	}

	return interpolated
}

/**
 * Resolve config path relative to project root.
 */
export function resolveConfigPath(
	projectRoot: string,
	configPath: string
): string {
	if (path.isAbsolute(configPath)) {
		return configPath
	}
	return path.join(projectRoot, configPath)
}
