import {readFile} from 'node:fs/promises'
import path from 'node:path'

export type RegistryManifestV1 = {
	version: 1
	extractors: Array<{
		id: string // module name, e.g. "pdf-llm"
		extractorName: string // runtime extractor name, e.g. "pdf:llm"
		group: string
		label: string
		description?: string
		hint?: string
		defaultSelected?: boolean
		workerOnly?: boolean
		configComplexity?:
			| 'zero-config'
			| 'needs-dep'
			| 'needs-api-key'
			| 'advanced'
		fileTypes?: string[]
		inputModes?: string[]
		output?: string
		docsPath?: string | null
		deps?: Record<string, string>
		devDeps?: Record<string, string>
		factory?: string
		assetProcessingFlagKeys?: string[]
	}>
	connectors: Array<{
		id: string // e.g. "notion"
		displayName: string
		types?: string[]
		description?: string
		status?: 'available' | 'coming-soon'
		docsPath?: string | null
		deps?: Record<string, string>
		devDeps?: Record<string, string>
		envVars?: Array<{name: string; required?: boolean; notes?: string}>
	}>
	/** Optional batteries (reranker, eval, etc.) */
	batteries?: Array<{
		id: string // e.g. "reranker"
		displayName: string
		description?: string
		status?: 'available' | 'coming-soon'
		docsPath?: string | null
		deps?: Record<string, string>
		devDeps?: Record<string, string>
		factory?: string
		defaultModel?: string
		envVars?: Array<{name: string; required?: boolean; notes?: string}>
	}>
}

export async function readRegistryManifest(
	registryRoot: string
): Promise<RegistryManifestV1> {
	const abs = path.join(registryRoot, 'manifest.json')
	const raw = await readFile(abs, 'utf8')
	const parsed = JSON.parse(raw) as RegistryManifestV1
	if (!parsed || parsed.version !== 1) {
		throw new Error(`Unsupported registry manifest version in ${abs}`)
	}
	if (
		!Array.isArray(parsed.extractors) ||
		!Array.isArray(parsed.connectors)
	) {
		throw new Error(`Invalid registry manifest shape in ${abs}`)
	}
	return parsed
}
