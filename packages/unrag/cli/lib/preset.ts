import {UNRAG_SITE_URL, docsUrl} from './constants'

export type PresetPayloadV1 = {
	version: 1
	createdAt?: string
	install: {
		installDir: string
		storeAdapter: 'drizzle' | 'prisma' | 'raw-sql'
		aliasBase: string
	}
	modules: {
		extractors: string[]
		connectors: string[]
		batteries?: string[]
	}
	config?: unknown
}

function isPresetPayloadV1(x: unknown): x is PresetPayloadV1 {
	if (!x || typeof x !== 'object') {
		return false
	}
	const o = x as Record<string, unknown>
	if (o.version !== 1) {
		return false
	}
	const install = o.install
	if (!install || typeof install !== 'object') {
		return false
	}
	const modules = o.modules
	if (!modules || typeof modules !== 'object') {
		return false
	}
	const installObj = install as Record<string, unknown>
	const modulesObj = modules as Record<string, unknown>
	if (typeof installObj.installDir !== 'string') {
		return false
	}
	if (
		!['drizzle', 'prisma', 'raw-sql'].includes(
			String(installObj.storeAdapter)
		)
	) {
		return false
	}
	if (typeof installObj.aliasBase !== 'string') {
		return false
	}
	if (
		!Array.isArray(modulesObj.extractors) ||
		!Array.isArray(modulesObj.connectors)
	) {
		return false
	}
	if ('batteries' in modulesObj) {
		const batteries = modulesObj.batteries
		if (batteries != null && !Array.isArray(batteries)) {
			return false
		}
	}
	return true
}

function toPresetUrl(input: string): string {
	const s = String(input ?? '').trim()
	if (!s) {
		throw new Error('Missing preset id/url')
	}
	if (s.startsWith('http://') || s.startsWith('https://')) {
		return s
	}

	// Treat it as an id.
	// Prefer docsUrl() so UNRAG_SITE_URL overrides work (e.g. staging).
	return docsUrl(`/api/presets/${encodeURIComponent(s)}`)
}

export async function fetchPreset(input: string): Promise<PresetPayloadV1> {
	const url = toPresetUrl(input)

	// Node 18+ has global fetch; bun build targets node. If missing, fail loudly.
	if (typeof fetch !== 'function') {
		throw new Error(
			`Global fetch() is unavailable in this runtime; cannot fetch preset from ${url}. Set UNRAG_SITE_URL="${UNRAG_SITE_URL}" and use a newer Node runtime.`
		)
	}

	const res = await fetch(url, {
		headers: {
			'user-agent': 'unrag-cli',
			accept: 'application/json'
		}
	})

	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(
			`Failed to fetch preset (${res.status}) from ${url}${text ? `: ${text}` : ''}`
		)
	}

	const json = (await res.json()) as unknown
	if (!isPresetPayloadV1(json)) {
		throw new Error(`Invalid preset payload returned from ${url}`)
	}

	return json
}
