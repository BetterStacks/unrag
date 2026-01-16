import {type NextRequest, NextResponse} from 'next/server'
import {redis} from '../_lib/redis'
import {loadRegistryManifest} from '../_lib/registry-manifest'

type StoreAdapter = 'drizzle' | 'prisma' | 'raw-sql'
type EmbeddingType = 'text' | 'multimodal'
type EmbeddingProviderName =
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
	| 'custom'

type WizardStateV1 = {
	v: 1
	install: {
		installDir: string
		storeAdapter: StoreAdapter
		aliasBase: string
	}
	modules: {
		extractors: string[]
		connectors: string[]
		batteries?: string[]
	}
	defaults: {
		chunkSize: number
		chunkOverlap: number
		topK: number
	}
	embedding: {
		type: EmbeddingType
		provider: EmbeddingProviderName
		model: string
		timeoutMs: number
	}
	storage: {
		storeChunkContent: boolean
		storeDocumentContent: boolean
	}
	engine?: {
		assetProcessing?: unknown
	}
}

type PresetPayloadV1 = {
	version: 1
	createdAt: string
	install: {
		installDir: string
		storeAdapter: StoreAdapter
		aliasBase: string
	}
	modules: {
		extractors: string[]
		connectors: string[]
		batteries: string[]
	}
	config: {
		defaults: {
			chunking: {chunkSize: number; chunkOverlap: number}
			retrieval: {topK: number}
		}
		embedding: {
			provider: EmbeddingProviderName
			config: {type: EmbeddingType; model: string; timeoutMs: number}
		}
		engine: {
			storage: {storeChunkContent: boolean; storeDocumentContent: boolean}
			assetProcessing?: unknown
		}
	}
}

const PRESET_TTL_SECONDS = 60 * 60 * 24 * 60 // 60 days
const MAX_BODY_BYTES = 64 * 1024 // 64KB
const RATE_LIMIT_PER_HOUR = 50

function getIp(req: NextRequest): string {
	const xf = req.headers.get('x-forwarded-for')
	const ip = xf ? xf.split(',')[0]?.trim() : ''
	return ip || 'unknown'
}

function isWizardStateV1(x: unknown): x is WizardStateV1 {
	if (!x || typeof x !== 'object') {
		return false
	}
	const o = x as Record<string, unknown>
	if (o.v !== 1) {
		return false
	}
	if (!o.install || !o.modules || !o.defaults || !o.embedding || !o.storage) {
		return false
	}
	if (
		o.modules &&
		typeof o.modules === 'object' &&
		'batteries' in o.modules &&
		(o.modules as Record<string, unknown>).batteries != null &&
		!Array.isArray((o.modules as Record<string, unknown>).batteries)
	) {
		return false
	}
	return true
}

function normalizeWizardState(input: WizardStateV1): WizardStateV1 {
	const installDir = String(input.install.installDir ?? 'lib/unrag')
	const storeAdapter = input.install.storeAdapter as StoreAdapter
	const aliasBase = String(input.install.aliasBase ?? '@unrag')

	const extractors = Array.isArray(input.modules.extractors)
		? input.modules.extractors.map(String).filter(Boolean)
		: []
	const connectors = Array.isArray(input.modules.connectors)
		? input.modules.connectors.map(String).filter(Boolean)
		: []
	const batteries = Array.isArray(input.modules.batteries)
		? input.modules.batteries.map(String).filter(Boolean)
		: []

	const chunkSize = Number(input.defaults.chunkSize) || 200
	const chunkOverlap = Number(input.defaults.chunkOverlap) || 40
	const topK = Number(input.defaults.topK) || 8

	const embeddingType = (input.embedding.type ?? 'text') as EmbeddingType
	const embeddingProvider = (() => {
		const v = (input.embedding as unknown as {provider?: unknown})?.provider
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
			? (v as EmbeddingProviderName)
			: ('ai' as const)
	})()
	const model = String(input.embedding.model ?? '')
	const timeoutMs = Number(input.embedding.timeoutMs) || 15_000

	const storeChunkContent = Boolean(input.storage.storeChunkContent)
	const storeDocumentContent = Boolean(input.storage.storeDocumentContent)

	return {
		v: 1,
		install: {installDir, storeAdapter, aliasBase},
		modules: {extractors, connectors, batteries},
		defaults: {chunkSize, chunkOverlap, topK},
		embedding: {
			type: embeddingType,
			provider: embeddingProvider,
			model,
			timeoutMs
		},
		storage: {storeChunkContent, storeDocumentContent}
	}
}

function makePresetFromWizard(state: WizardStateV1): PresetPayloadV1 {
	const assetProcessing = state.engine?.assetProcessing
	return {
		version: 1,
		createdAt: new Date().toISOString(),
		install: {
			installDir: state.install.installDir,
			storeAdapter: state.install.storeAdapter,
			aliasBase: state.install.aliasBase
		},
		modules: {
			extractors: state.modules.extractors,
			connectors: state.modules.connectors,
			batteries: (state.modules.batteries ?? [])
				.map(String)
				.filter(Boolean)
		},
		config: {
			defaults: {
				chunking: {
					chunkSize: state.defaults.chunkSize,
					chunkOverlap: state.defaults.chunkOverlap
				},
				retrieval: {
					topK: state.defaults.topK
				}
			},
			embedding: {
				provider: state.embedding.provider,
				config: {
					type: state.embedding.type,
					model: state.embedding.model,
					timeoutMs: state.embedding.timeoutMs
				}
			},
			engine: {
				storage: {
					storeChunkContent: state.storage.storeChunkContent,
					storeDocumentContent: state.storage.storeDocumentContent
				},
				...(assetProcessing && typeof assetProcessing === 'object'
					? {assetProcessing}
					: {})
			}
		}
	}
}

async function rateLimit(req: NextRequest) {
	const ip = getIp(req)
	const key = `unrag:rl:preset_create:${ip}`
	const count = await redis.incr(key)
	if (count === 1) {
		await redis.expire(key, 60 * 60)
	}
	return {ok: count <= RATE_LIMIT_PER_HOUR, count}
}

function newPresetId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

export async function POST(req: NextRequest) {
	// Guard: size
	const contentLength = Number(req.headers.get('content-length') ?? 0)
	if (contentLength && contentLength > MAX_BODY_BYTES) {
		return NextResponse.json({error: 'Payload too large'}, {status: 413})
	}

	const rl = await rateLimit(req)
	if (!rl.ok) {
		return NextResponse.json({error: 'Rate limited'}, {status: 429})
	}

	let body: unknown
	try {
		body = (await req.json()) as unknown
	} catch {
		return NextResponse.json({error: 'Invalid JSON'}, {status: 400})
	}

	const rawState = (() => {
		if (body && typeof body === 'object') {
			const state = (body as Record<string, unknown>).state
			return state ?? body
		}
		return body
	})()
	if (!isWizardStateV1(rawState)) {
		return NextResponse.json({error: 'Invalid wizard state'}, {status: 400})
	}

	const state = normalizeWizardState(rawState)

	// Validate against manifest (no unknown modules; only available connectors).
	const manifest = await loadRegistryManifest()
	const allowedExtractors = new Set(
		(manifest.extractors ?? []).map((e) => e.id)
	)
	const allowedConnectors = new Set(
		(manifest.connectors ?? [])
			.filter((c) => c.status === 'available')
			.map((c) => c.id)
	)
	const allowedBatteries = new Set(
		(manifest.batteries ?? [])
			.filter((b) => b.status === 'available')
			.map((b) => b.id)
	)

	const unknownExtractors = state.modules.extractors.filter(
		(x) => !allowedExtractors.has(x)
	)
	if (unknownExtractors.length > 0) {
		return NextResponse.json(
			{error: 'Unknown extractors', unknownExtractors},
			{status: 400}
		)
	}

	const unknownConnectors = state.modules.connectors.filter(
		(x) => !allowedConnectors.has(x)
	)
	if (unknownConnectors.length > 0) {
		return NextResponse.json(
			{error: 'Unknown or unavailable connectors', unknownConnectors},
			{status: 400}
		)
	}

	const batteryIds = (state.modules.batteries ?? [])
		.map(String)
		.filter(Boolean)
	const unknownBatteries = batteryIds.filter((x) => !allowedBatteries.has(x))
	if (unknownBatteries.length > 0) {
		return NextResponse.json(
			{error: 'Unknown or unavailable batteries', unknownBatteries},
			{status: 400}
		)
	}

	const preset = makePresetFromWizard(state)
	const id = newPresetId()
	const key = `unrag:preset:${id}`

	// Guard: final payload size
	const serialized = JSON.stringify(preset)
	if (serialized.length > MAX_BODY_BYTES) {
		return NextResponse.json({error: 'Preset too large'}, {status: 413})
	}

	await redis.set(key, preset, {ex: PRESET_TTL_SECONDS})

	return NextResponse.json({id}, {status: 201})
}
