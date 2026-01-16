'use client'

import {
	AmazonWebServicesDark,
	AmazonWebServicesLight,
	Cohere,
	Discord,
	Dropbox,
	Gemini,
	GitHubDark,
	GitHubLight,
	GitLab,
	GoogleCloud,
	GoogleDrive,
	Linear,
	MicrosoftAzure,
	MicrosoftOneDrive,
	MicrosoftSharePoint,
	MicrosoftTeams,
	MistralAI,
	Notion,
	OllamaDark,
	OllamaLight,
	OpenAIDark,
	OpenAILight,
	OpenRouterDark,
	OpenRouterLight,
	Slack,
	TogetherAIDark,
	TogetherAILight,
	VercelDark,
	VercelLight
} from '@ridemountainpig/svgl-react'
import {
	ArrowLeft,
	Battery,
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	Database,
	ExternalLink,
	FileText,
	Image,
	Mic,
	Package,
	Puzzle,
	RefreshCw,
	Settings2,
	Share2,
	Sparkles,
	Video,
	Zap
} from 'lucide-react'
import Link from 'next/link'
import {parseAsString, useQueryState} from 'nuqs'
import {
	type ComponentType,
	type SVGProps,
	useCallback,
	useEffect,
	useMemo,
	useState
} from 'react'

import {Button, PlainButton, SoftButton} from '@/components/elements'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import {Switch} from '@/components/ui/switch'
import {cn} from '@/lib/utils'
import {NextStepsDialog} from './next-steps-dialog'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
		batteries: string[]
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
}

type RegistryManifest = {
	version: number
	extractors: Array<{
		id: string
		label?: string
		group?: string
		description?: string
		hint?: string
		workerOnly?: boolean
		configComplexity?: string
		docsPath?: string | null
	}>
	connectors: Array<{
		id: string
		displayName?: string
		description?: string
		status?: 'available' | 'coming-soon'
		types?: string[]
		docsPath?: string | null
	}>
	batteries?: Array<{
		id: string
		displayName?: string
		description?: string
		status?: 'available' | 'coming-soon'
		docsPath?: string | null
		defaultModel?: string
	}>
}

type Step = {
	id: string
	label: string
	icon: React.ReactNode
}

type ThemeIconPair = {
	light: ComponentType<SVGProps<SVGSVGElement>>
	dark: ComponentType<SVGProps<SVGSVGElement>>
}

function monoIcon(icon: ComponentType<SVGProps<SVGSVGElement>>): ThemeIconPair {
	return {light: icon, dark: icon}
}

function ThemeIcon({
	icon,
	className,
	...props
}: {icon: ThemeIconPair; className?: string} & SVGProps<SVGSVGElement>) {
	const Light = icon.light
	const Dark = icon.dark

	return (
		<>
			<Light {...props} className={cn(className, 'dark:hidden')} />
			<Dark {...props} className={cn(className, 'hidden dark:block')} />
		</>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Defaults
// ─────────────────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
	{
		id: 'install',
		label: 'Project Setup',
		icon: <Settings2 className="w-4 h-4" />
	},
	{id: 'database', label: 'Database', icon: <Database className="w-4 h-4" />},
	{
		id: 'embedding',
		label: 'Embeddings',
		icon: <Sparkles className="w-4 h-4" />
	},
	{
		id: 'extractors',
		label: 'Extractors',
		icon: <Puzzle className="w-4 h-4" />
	},
	{
		id: 'connectors',
		label: 'Connectors',
		icon: <Package className="w-4 h-4" />
	},
	{
		id: 'batteries',
		label: 'Batteries',
		icon: <Battery className="w-4 h-4" />
	},
	{id: 'review', label: 'Review', icon: <Zap className="w-4 h-4" />}
]

const DEFAULT_STATE: WizardStateV1 = {
	v: 1,
	install: {
		installDir: 'lib/unrag',
		storeAdapter: 'drizzle',
		aliasBase: '@unrag'
	},
	modules: {
		extractors: [],
		connectors: [],
		batteries: []
	},
	defaults: {
		chunkSize: 200,
		chunkOverlap: 40,
		topK: 8
	},
	embedding: {
		type: 'text',
		provider: 'ai',
		model: 'openai/text-embedding-3-small',
		timeoutMs: 15_000
	},
	storage: {
		storeChunkContent: true,
		storeDocumentContent: true
	}
}

const STORE_ADAPTERS: Array<{
	id: StoreAdapter
	name: string
	description: string
}> = [
	{
		id: 'drizzle',
		name: 'Drizzle ORM',
		description:
			'Type-safe SQL with migrations. Recommended for new projects.'
	},
	{
		id: 'prisma',
		name: 'Prisma',
		description: 'Popular ORM with schema-first approach and studio UI.'
	},
	{
		id: 'raw-sql',
		name: 'Raw SQL',
		description:
			'Direct pg Pool queries. Maximum control, minimal abstraction.'
	}
]

const EMBEDDING_TYPES: Array<{
	id: EmbeddingType
	name: string
	description: string
}> = [
	{
		id: 'text',
		name: 'Text Only',
		description:
			'You can still extract text from PDFs/images/audio/video via extractors (next step).'
	},
	{
		id: 'multimodal',
		name: 'Multimodal',
		description: 'Embed text + images into the same vector space (Voyage).'
	}
]

const VoyageLogo = (props: SVGProps<SVGSVGElement>) => (
	<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
		<path
			d="M4.5 6h3.2L12 15.2 16.3 6h3.2L13.3 19h-2.6L4.5 6z"
			fill="currentColor"
		/>
	</svg>
)

type EmbeddingModelOption = {
	id: string
	label: string
	providerLabel: string
	icon: ThemeIconPair
	supports: EmbeddingType[] // what the embedding output can represent
	recommended?: boolean
}

const DEFAULT_MODEL_BY_PROVIDER: Record<EmbeddingProviderName, string> = {
	ai: 'openai/text-embedding-3-small',
	openai: 'text-embedding-3-small',
	google: 'gemini-embedding-001',
	openrouter: 'text-embedding-3-small',
	azure: 'text-embedding-3-small',
	vertex: 'text-embedding-004',
	bedrock: 'amazon.titan-embed-text-v2:0',
	cohere: 'embed-english-v3.0',
	mistral: 'mistral-embed',
	together: 'togethercomputer/m2-bert-80M-2k-retrieval',
	ollama: 'nomic-embed-text',
	voyage: 'voyage-3.5-lite',
	custom: 'openai/text-embedding-3-small'
}

const DEFAULT_MULTIMODAL_MODEL_BY_PROVIDER: Partial<
	Record<EmbeddingProviderName, string>
> = {
	voyage: 'voyage-multimodal-3'
}

const MODEL_PLACEHOLDER_BY_PROVIDER: Partial<
	Record<EmbeddingProviderName, string>
> = {
	ai: 'openai/text-embedding-3-small',
	openai: 'text-embedding-3-small',
	google: 'gemini-embedding-001',
	openrouter: 'text-embedding-3-small',
	azure: 'text-embedding-3-small',
	vertex: 'text-embedding-004',
	bedrock: 'amazon.titan-embed-text-v2:0',
	cohere: 'embed-english-v3.0',
	mistral: 'mistral-embed',
	together: 'togethercomputer/m2-bert-80M-2k-retrieval',
	ollama: 'nomic-embed-text',
	voyage: 'voyage-3.5-lite'
}

const EMBEDDING_PROVIDER_OPTIONS: Array<{
	id: EmbeddingProviderName
	name: string
	description: string
	docsHref: string
	icon: ThemeIconPair
	badge?: string
}> = [
	{
		id: 'ai',
		name: 'Vercel AI Gateway',
		description:
			'Unified gateway for AI SDK models. Great default to start.',
		docsHref: '/docs/providers/ai-gateway',
		icon: {light: VercelLight, dark: VercelDark},
		badge: 'default'
	},
	{
		id: 'voyage',
		name: 'Voyage AI',
		description:
			'Best-in-class embeddings + the only built-in multimodal provider.',
		docsHref: '/docs/providers/voyage',
		icon: monoIcon(VoyageLogo)
	},
	{
		id: 'openai',
		name: 'OpenAI',
		description: 'Direct OpenAI embeddings via the AI SDK provider.',
		docsHref: '/docs/providers/openai',
		icon: {light: OpenAILight, dark: OpenAIDark}
	},
	{
		id: 'google',
		name: 'Google AI (Gemini)',
		description: 'Gemini embeddings via the AI SDK provider.',
		docsHref: '/docs/providers/google',
		icon: monoIcon(Gemini)
	},
	{
		id: 'openrouter',
		name: 'OpenRouter',
		description: 'Route across models/providers behind one API.',
		docsHref: '/docs/providers/openrouter',
		icon: {light: OpenRouterLight, dark: OpenRouterDark}
	},
	{
		id: 'azure',
		name: 'Azure OpenAI',
		description: 'Enterprise-friendly OpenAI deployments on Azure.',
		docsHref: '/docs/providers/azure',
		icon: monoIcon(MicrosoftAzure)
	},
	{
		id: 'vertex',
		name: 'Vertex AI',
		description: 'Google Cloud Vertex AI embeddings.',
		docsHref: '/docs/providers/vertex',
		icon: monoIcon(GoogleCloud)
	},
	{
		id: 'bedrock',
		name: 'AWS Bedrock',
		description: 'AWS-native embeddings (Titan, etc).',
		docsHref: '/docs/providers/bedrock',
		icon: {light: AmazonWebServicesLight, dark: AmazonWebServicesDark}
	},
	{
		id: 'cohere',
		name: 'Cohere',
		description: 'Cohere embeddings via the AI SDK provider.',
		docsHref: '/docs/providers/cohere',
		icon: monoIcon(Cohere)
	},
	{
		id: 'mistral',
		name: 'Mistral',
		description: 'Mistral embeddings via the AI SDK provider.',
		docsHref: '/docs/providers/mistral',
		icon: monoIcon(MistralAI)
	},
	{
		id: 'together',
		name: 'Together.ai',
		description: 'Open models served via Together.',
		docsHref: '/docs/providers/together',
		icon: {light: TogetherAILight, dark: TogetherAIDark}
	},
	{
		id: 'ollama',
		name: 'Ollama (local)',
		description: 'Local embeddings for offline/dev workflows.',
		docsHref: '/docs/providers/ollama',
		icon: {light: OllamaLight, dark: OllamaDark}
	}
]

const EMBEDDING_MODELS_BY_PROVIDER: Partial<
	Record<EmbeddingProviderName, EmbeddingModelOption[]>
> = {
	ai: [
		{
			id: 'openai/text-embedding-3-small',
			label: 'openai/text-embedding-3-small',
			providerLabel: 'OpenAI',
			icon: {light: OpenAILight, dark: OpenAIDark},
			supports: ['text'],
			recommended: true
		},
		{
			id: 'openai/text-embedding-3-large',
			label: 'openai/text-embedding-3-large',
			providerLabel: 'OpenAI',
			icon: {light: OpenAILight, dark: OpenAIDark},
			supports: ['text']
		},
		{
			id: 'google/text-embedding-004',
			label: 'google/text-embedding-004',
			providerLabel: 'Google',
			icon: monoIcon(Gemini),
			supports: ['text']
		},
		{
			id: 'amazon/titan-embed-text-v2',
			label: 'amazon/titan-embed-text-v2',
			providerLabel: 'Amazon Web Services',
			icon: {light: AmazonWebServicesLight, dark: AmazonWebServicesDark},
			supports: ['text']
		}
	],
	openai: [
		{
			id: 'text-embedding-3-small',
			label: 'text-embedding-3-small',
			providerLabel: 'OpenAI',
			icon: {light: OpenAILight, dark: OpenAIDark},
			supports: ['text'],
			recommended: true
		},
		{
			id: 'text-embedding-3-large',
			label: 'text-embedding-3-large',
			providerLabel: 'OpenAI',
			icon: {light: OpenAILight, dark: OpenAIDark},
			supports: ['text']
		}
	],
	google: [
		{
			id: 'gemini-embedding-001',
			label: 'gemini-embedding-001',
			providerLabel: 'Google',
			icon: monoIcon(Gemini),
			supports: ['text'],
			recommended: true
		}
	],
	openrouter: [
		{
			id: 'text-embedding-3-small',
			label: 'text-embedding-3-small',
			providerLabel: 'OpenRouter',
			icon: {light: OpenRouterLight, dark: OpenRouterDark},
			supports: ['text'],
			recommended: true
		}
	],
	azure: [
		{
			id: 'text-embedding-3-small',
			label: 'text-embedding-3-small',
			providerLabel: 'Azure OpenAI',
			icon: monoIcon(MicrosoftAzure),
			supports: ['text'],
			recommended: true
		}
	],
	vertex: [
		{
			id: 'text-embedding-004',
			label: 'text-embedding-004',
			providerLabel: 'Vertex AI',
			icon: monoIcon(GoogleCloud),
			supports: ['text'],
			recommended: true
		}
	],
	bedrock: [
		{
			id: 'amazon.titan-embed-text-v2:0',
			label: 'amazon.titan-embed-text-v2:0',
			providerLabel: 'AWS Bedrock',
			icon: {light: AmazonWebServicesLight, dark: AmazonWebServicesDark},
			supports: ['text'],
			recommended: true
		}
	],
	cohere: [
		{
			id: 'embed-english-v3.0',
			label: 'embed-english-v3.0',
			providerLabel: 'Cohere',
			icon: monoIcon(Cohere),
			supports: ['text'],
			recommended: true
		}
	],
	mistral: [
		{
			id: 'mistral-embed',
			label: 'mistral-embed',
			providerLabel: 'Mistral',
			icon: monoIcon(MistralAI),
			supports: ['text'],
			recommended: true
		}
	],
	together: [
		{
			id: 'togethercomputer/m2-bert-80M-2k-retrieval',
			label: 'togethercomputer/m2-bert-80M-2k-retrieval',
			providerLabel: 'Together.ai',
			icon: {light: TogetherAILight, dark: TogetherAIDark},
			supports: ['text'],
			recommended: true
		}
	],
	ollama: [
		{
			id: 'nomic-embed-text',
			label: 'nomic-embed-text',
			providerLabel: 'Ollama',
			icon: {light: OllamaLight, dark: OllamaDark},
			supports: ['text'],
			recommended: true
		}
	],
	voyage: [
		{
			id: 'voyage-3.5-lite',
			label: 'voyage-3.5-lite',
			providerLabel: 'Voyage',
			icon: monoIcon(VoyageLogo),
			supports: ['text'],
			recommended: true
		},
		{
			id: 'voyage-3',
			label: 'voyage-3',
			providerLabel: 'Voyage',
			icon: monoIcon(VoyageLogo),
			supports: ['text']
		},
		{
			id: 'voyage-code-3',
			label: 'voyage-code-3',
			providerLabel: 'Voyage',
			icon: monoIcon(VoyageLogo),
			supports: ['text']
		},
		{
			id: 'voyage-multimodal-3',
			label: 'voyage-multimodal-3',
			providerLabel: 'Voyage',
			icon: monoIcon(VoyageLogo),
			supports: ['multimodal'],
			recommended: true
		}
	]
}

const CUSTOM_MODEL_VALUE = '__custom__'

const RECOMMENDED_DEFAULTS = {
	chunkSize: 200,
	chunkOverlap: 40,
	topK: 8
} as const

const CHUNK_SIZE_OPTIONS = [
	64, 96, 128, 160, 200, 240, 300, 400, 512, 768, 1024, 1536, 2048
]
const CHUNK_OVERLAP_OPTIONS = [0, 10, 20, 30, 40, 60, 80, 100, 150, 200, 256]
const TOP_K_OPTIONS = [3, 5, 8, 10, 12, 15, 20, 30, 50, 100]

const EXTRACTOR_ICONS: Record<string, React.ReactNode> = {
	pdf: <FileText className="w-4 h-4" />,
	image: <Image className="w-4 h-4" />,
	audio: <Mic className="w-4 h-4" />,
	video: <Video className="w-4 h-4" />,
	file: <FileText className="w-4 h-4" />
}

const connectorLogoById: Record<string, ThemeIconPair> = {
	notion: monoIcon(Notion),
	'google-drive': monoIcon(GoogleDrive),
	github: {light: GitHubLight, dark: GitHubDark},
	gitlab: monoIcon(GitLab),
	slack: monoIcon(Slack),
	discord: monoIcon(Discord),
	linear: monoIcon(Linear),
	dropbox: monoIcon(Dropbox),
	onedrive: monoIcon(MicrosoftOneDrive),
	teams: monoIcon(MicrosoftTeams),
	sharepoint: monoIcon(MicrosoftSharePoint)
}

// ─────────────────────────────────────────────────────────────────────────────
// Encoding / Decoding
// ─────────────────────────────────────────────────────────────────────────────

function toBase64Url(bytes: Uint8Array) {
	let binary = ''
	for (const b of bytes) {
		binary += String.fromCharCode(b)
	}
	const b64 = btoa(binary)
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(b64url: string) {
	const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
	const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
	const binary = atob(padded)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

function encodeWizardState(state: WizardStateV1) {
	const json = JSON.stringify(state)
	const bytes = new TextEncoder().encode(json)
	return toBase64Url(bytes)
}

function decodeWizardState(encoded: string): WizardStateV1 | null {
	if (!encoded) {
		return null
	}
	try {
		const bytes = fromBase64Url(encoded)
		const json = new TextDecoder().decode(bytes)
		const parsed = JSON.parse(json) as Partial<WizardStateV1> | null
		if (!parsed || parsed.v !== 1) {
			return null
		}
		return parsed as WizardStateV1
	} catch {
		return null
	}
}

function normalizeState(s: WizardStateV1): WizardStateV1 {
	const installDir = String(
		s.install?.installDir ?? DEFAULT_STATE.install.installDir
	)
	const storeAdapter = (s.install?.storeAdapter ??
		DEFAULT_STATE.install.storeAdapter) as StoreAdapter
	const aliasBase = String(
		s.install?.aliasBase ?? DEFAULT_STATE.install.aliasBase
	)
	const extractors = Array.isArray(s.modules?.extractors)
		? s.modules.extractors.map(String)
		: []
	const connectors = Array.isArray(s.modules?.connectors)
		? s.modules.connectors.map(String)
		: []
	const batteries = Array.isArray(s.modules?.batteries)
		? s.modules.batteries.map(String)
		: []
	const chunkSize =
		Number(s.defaults?.chunkSize ?? DEFAULT_STATE.defaults.chunkSize) ||
		DEFAULT_STATE.defaults.chunkSize
	const chunkOverlap =
		Number(
			s.defaults?.chunkOverlap ?? DEFAULT_STATE.defaults.chunkOverlap
		) || DEFAULT_STATE.defaults.chunkOverlap
	const topK =
		Number(s.defaults?.topK ?? DEFAULT_STATE.defaults.topK) ||
		DEFAULT_STATE.defaults.topK
	const embeddingType = (s.embedding?.type ??
		DEFAULT_STATE.embedding.type) as EmbeddingType
	const embeddingProvider = (() => {
		const v = (s.embedding as any)?.provider as unknown
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
			: DEFAULT_STATE.embedding.provider
	})()
	const embeddingModel = String(
		s.embedding?.model ?? DEFAULT_STATE.embedding.model
	)
	const embeddingTimeoutMs =
		Number(s.embedding?.timeoutMs ?? DEFAULT_STATE.embedding.timeoutMs) ||
		DEFAULT_STATE.embedding.timeoutMs
	const storeChunkContent = Boolean(
		s.storage?.storeChunkContent ?? DEFAULT_STATE.storage.storeChunkContent
	)
	const storeDocumentContent = Boolean(
		s.storage?.storeDocumentContent ??
			DEFAULT_STATE.storage.storeDocumentContent
	)

	return {
		v: 1,
		install: {installDir, storeAdapter, aliasBase},
		modules: {extractors, connectors, batteries},
		defaults: {chunkSize, chunkOverlap, topK},
		embedding: {
			type: embeddingType,
			provider: embeddingProvider,
			model: embeddingModel,
			timeoutMs: embeddingTimeoutMs
		},
		storage: {storeChunkContent, storeDocumentContent}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function useWizardState() {
	const [encoded, setEncoded] = useQueryState(
		's',
		parseAsString.withDefault('')
	)
	const state = useMemo(() => {
		const decoded = decodeWizardState(encoded)
		return normalizeState(decoded ?? DEFAULT_STATE)
	}, [encoded])

	const setState = useCallback(
		(updater: (prev: WizardStateV1) => WizardStateV1) => {
			const next = normalizeState(updater(state))
			setEncoded(encodeWizardState(next), {
				history: 'replace',
				shallow: true
			})
		},
		[state, setEncoded]
	)

	const reset = useCallback(() => {
		setEncoded(encodeWizardState(DEFAULT_STATE), {
			history: 'replace',
			shallow: true
		})
	}, [setEncoded])

	return {state, setState, reset}
}

function toggleInList(list: string[], value: string) {
	const v = String(value)
	return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort()
}

function DocsIconLink({href, label}: {href: string; label: string}) {
	return (
		<Link
			href={href}
			target="_blank"
			rel="noreferrer"
			onClick={(e) => e.stopPropagation()}
			className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-olive-950/10 bg-white/60 text-olive-700 hover:text-olive-950 hover:bg-white/80 transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-[#757572]/20 dark:bg-white/[0.02] dark:text-white/45 dark:hover:text-white/80 dark:hover:bg-white/[0.05]"
			aria-label={label}
			title={label}
		>
			<ExternalLink className="w-3.5 h-3.5" />
		</Link>
	)
}

function ClickableCard({
	onClick,
	disabled,
	className,
	children
}: {
	onClick: () => void
	disabled?: boolean
	className?: string
	children: React.ReactNode
}) {
	return (
		<div
			role="button"
			tabIndex={disabled ? -1 : 0}
			aria-disabled={disabled ? true : undefined}
			onClick={() => {
				if (!disabled) {
					onClick()
				}
			}}
			onKeyDown={(e) => {
				if (disabled) {
					return
				}
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					onClick()
				}
			}}
			className={cn(
				'group relative w-full text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-950/15 dark:focus-visible:ring-white/20',
				disabled && 'cursor-not-allowed',
				className
			)}
		>
			{children}
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function SelectionCard({
	selected,
	onClick,
	title,
	description,
	disabled,
	badge
}: {
	selected: boolean
	onClick: () => void
	title: string
	description: string
	disabled?: boolean
	badge?: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				'group relative w-full text-left rounded-xl border p-4 transition-all duration-200',
				'hover:border-olive-950/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-950/15 dark:hover:border-[#757572]/30 dark:focus-visible:ring-white/20',
				selected
					? 'border-olive-950/15 bg-white/70 dark:border-white/30 dark:bg-white/[0.04]'
					: 'border-olive-950/10 bg-white/60 hover:bg-white/70 dark:border-[#757572]/15 dark:bg-white/[0.02] dark:hover:bg-white/[0.03]',
				disabled &&
					'opacity-50 cursor-not-allowed hover:border-olive-950/10 hover:bg-white/60 dark:hover:border-[#757572]/15 dark:hover:bg-white/[0.02]'
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-olive-950/90 dark:text-white/90">
							{title}
						</span>
						{badge && (
							<span className="text-[10px] px-2 py-0.5 rounded-full bg-olive-950/[0.04] text-olive-700 border border-olive-950/10 capitalize dark:bg-white/5 dark:text-white/40 dark:border-[#757572]/20">
								{badge}
							</span>
						)}
					</div>
					<p className="mt-1 text-sm text-olive-700 leading-relaxed dark:text-white/50">
						{description}
					</p>
				</div>
				<div
					className={cn(
						'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
						selected
							? 'border-olive-950 bg-olive-950 dark:border-white dark:bg-white'
							: 'border-olive-950/20 group-hover:border-olive-950/30 dark:border-white/20 dark:group-hover:border-white/30'
					)}
				>
					{selected && (
						<div className="w-2 h-2 rounded-full bg-lemon-50 dark:bg-black" />
					)}
				</div>
			</div>
		</button>
	)
}

function ExtractorCard({
	id,
	label,
	description,
	group,
	selected,
	onToggle,
	workerOnly,
	docsHref
}: {
	id: string
	label?: string
	description?: string
	group?: string
	selected: boolean
	onToggle: () => void
	workerOnly?: boolean
	docsHref?: string | null
}) {
	const icon = EXTRACTOR_ICONS[group?.toLowerCase() ?? ''] ?? (
		<FileText className="w-4 h-4" />
	)

	return (
		<ClickableCard
			onClick={onToggle}
			className={cn(
				'rounded-lg border p-3',
				'hover:border-olive-950/20 dark:hover:border-[#757572]/30',
				selected
					? 'border-olive-950/15 bg-white/70 dark:border-white/25 dark:bg-white/[0.05]'
					: 'border-olive-950/10 bg-white/60 hover:bg-white/70 dark:border-[#757572]/15 dark:bg-white/[0.02] dark:hover:bg-white/[0.03]'
			)}
		>
			<div className="flex items-start gap-3">
				<div
					className={cn(
						'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
						selected
							? 'bg-olive-950/[0.05] text-olive-950 dark:bg-white/10 dark:text-white'
							: 'bg-olive-950/[0.04] text-olive-700 dark:bg-white/5 dark:text-white/40'
					)}
				>
					{icon}
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-mono text-sm text-olive-950/90 dark:text-white/90">
							{label || id}
						</span>
						{workerOnly && (
							<span className="text-[9px] px-1.5 py-0.5 rounded capitalize bg-amber-500/10 text-amber-400/80 border border-amber-500/20">
								worker
							</span>
						)}
						{docsHref ? (
							<div className="ml-auto">
								<DocsIconLink
									href={docsHref}
									label={`${label || id} docs`}
								/>
							</div>
						) : null}
					</div>
					{description && (
						<p className="mt-0.5 text-xs text-olive-700/80 line-clamp-2 dark:text-white/40">
							{description}
						</p>
					)}
				</div>
				<div
					className={cn(
						'w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all',
						selected
							? 'border-olive-950/40 bg-olive-950 text-lemon-50 dark:border-white/40 dark:bg-white dark:text-black'
							: 'border-olive-950/20 group-hover:border-olive-950/25 dark:border-[#757572]/20 dark:group-hover:border-white/25'
					)}
				>
					{selected && <Check className="w-3 h-3" strokeWidth={3} />}
				</div>
			</div>
		</ClickableCard>
	)
}

function ConnectorCard({
	id,
	displayName,
	description,
	status,
	docsHref,
	logo,
	selected,
	onToggle
}: {
	id: string
	displayName?: string
	description?: string
	status?: 'available' | 'coming-soon'
	docsHref?: string | null
	logo?: ThemeIconPair
	selected: boolean
	onToggle: () => void
}) {
	const isAvailable = status === 'available'

	return (
		<ClickableCard
			onClick={onToggle}
			disabled={!isAvailable}
			className={cn(
				'rounded-xl border p-4',
				selected
					? 'border-olive-950/15 bg-white/70 dark:border-white/25 dark:bg-white/[0.05]'
					: 'border-olive-950/10 bg-white/60 dark:border-[#757572]/15 dark:bg-white/[0.02]',
				isAvailable
					? 'hover:border-olive-950/20 hover:bg-white/70 dark:hover:border-[#757572]/30 dark:hover:bg-white/[0.03]'
					: 'opacity-50 cursor-not-allowed'
			)}
		>
			<div className="flex items-start gap-3">
				<div
					className={cn(
						'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
						selected
							? 'bg-olive-950/[0.05] text-olive-950 dark:bg-white/10 dark:text-white'
							: 'bg-olive-950/[0.04] text-olive-700 dark:bg-white/5 dark:text-white/40'
					)}
				>
					{logo ? (
						<ThemeIcon
							icon={logo}
							width={18}
							height={18}
							className={cn(
								'text-olive-950/90 dark:text-white/90',
								!selected && 'opacity-70'
							)}
							aria-label={displayName || id}
						/>
					) : (
						<Package className="w-5 h-5" />
					)}
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-olive-950/90 dark:text-white/90">
							{displayName || id}
						</span>
						<span
							className={cn(
								'text-[10px] px-2 py-0.5 rounded-full border capitalize',
								isAvailable
									? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400/80'
									: 'bg-olive-950/[0.04] text-olive-700 border-olive-950/10 dark:bg-white/5 dark:text-white/40 dark:border-[#757572]/20'
							)}
						>
							{isAvailable ? 'available' : 'coming soon'}
						</span>
						{isAvailable && docsHref ? (
							<div className="ml-auto">
								<DocsIconLink
									href={docsHref}
									label={`${displayName || id} docs`}
								/>
							</div>
						) : null}
					</div>
					{description && (
						<p className="mt-1 text-sm text-olive-700 dark:text-white/50">
							{description}
						</p>
					)}
				</div>
				<div
					className={cn(
						'w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all',
						selected
							? 'border-olive-950/40 bg-olive-950 text-lemon-50 dark:border-white/40 dark:bg-white dark:text-black'
							: 'border-olive-950/20 group-hover:border-olive-950/25 dark:border-[#757572]/20 dark:group-hover:border-white/25'
					)}
				>
					{selected && <Check className="w-3 h-3" strokeWidth={3} />}
				</div>
			</div>
		</ClickableCard>
	)
}

function BatteryCard({
	id,
	displayName,
	description,
	status,
	docsHref,
	defaultModel,
	selected,
	onToggle
}: {
	id: string
	displayName?: string
	description?: string
	status?: 'available' | 'coming-soon'
	docsHref?: string | null
	defaultModel?: string
	selected: boolean
	onToggle: () => void
}) {
	const isAvailable = status === 'available'
	const isExperimental = id === 'debug'

	return (
		<ClickableCard
			onClick={onToggle}
			disabled={!isAvailable}
			className={cn(
				'rounded-xl border p-4',
				selected
					? 'border-olive-950/15 bg-white/70 dark:border-white/25 dark:bg-white/[0.05]'
					: 'border-olive-950/10 bg-white/60 dark:border-[#757572]/15 dark:bg-white/[0.02]',
				isAvailable
					? 'hover:border-olive-950/20 hover:bg-white/70 dark:hover:border-[#757572]/30 dark:hover:bg-white/[0.03]'
					: 'opacity-50 cursor-not-allowed'
			)}
		>
			<div className="flex items-start gap-3">
				<div
					className={cn(
						'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
						selected
							? 'bg-olive-950/[0.05] text-olive-950 dark:bg-white/10 dark:text-white'
							: 'bg-olive-950/[0.04] text-olive-700 dark:bg-white/5 dark:text-white/40'
					)}
				>
					<Battery className="w-5 h-5" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-olive-950/90 dark:text-white/90">
							{displayName || id}
						</span>
						<span
							className={cn(
								'text-[10px] px-2 py-0.5 rounded-full border capitalize',
								isAvailable
									? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400/80'
									: 'bg-olive-950/[0.04] text-olive-700 border-olive-950/10 dark:bg-white/5 dark:text-white/40 dark:border-[#757572]/20'
							)}
						>
							{isAvailable ? 'available' : 'coming soon'}
						</span>
						{isExperimental ? (
							<span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400/80 border-amber-500/20">
								experimental
							</span>
						) : null}
						{isAvailable && docsHref ? (
							<div className="ml-auto">
								<DocsIconLink
									href={docsHref}
									label={`${displayName || id} docs`}
								/>
							</div>
						) : null}
					</div>
					{description && (
						<p className="mt-1 text-sm text-olive-700 dark:text-white/50">
							{description}
						</p>
					)}
					{defaultModel && isAvailable && (
						<div className="mt-2 flex items-center gap-2">
							<span className="text-xs text-olive-600 dark:text-white/35">
								Default model:
							</span>
							<code className="text-xs px-1.5 py-0.5 rounded bg-olive-950/[0.04] text-olive-700 font-mono dark:bg-white/5 dark:text-white/60">
								{defaultModel}
							</code>
						</div>
					)}
				</div>
				<div
					className={cn(
						'w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all',
						selected
							? 'border-olive-950/40 bg-olive-950 text-lemon-50 dark:border-white/40 dark:bg-white dark:text-black'
							: 'border-olive-950/20 group-hover:border-olive-950/25 dark:border-[#757572]/20 dark:group-hover:border-white/25'
					)}
				>
					{selected && <Check className="w-3 h-3" strokeWidth={3} />}
				</div>
			</div>
		</ClickableCard>
	)
}

function SectionHeader({
	title,
	description
}: {title: string; description?: string}) {
	return (
		<div className="mb-6">
			<h2 className="font-display text-xl font-normal text-olive-950/90 dark:text-white/90">
				{title}
			</h2>
			{description && (
				<p className="mt-1 text-sm text-olive-700 dark:text-white/50">
					{description}
				</p>
			)}
		</div>
	)
}

function FieldGroup({
	label,
	hint,
	children
}: {label: string; hint?: string; children: React.ReactNode}) {
	return (
		<div className="space-y-2">
			<div className="flex items-baseline justify-between">
				<Label className="text-sm text-olive-900/80 dark:text-white/70">
					{label}
				</Label>
				{hint && (
					<span className="text-xs text-olive-600 dark:text-white/30">
						{hint}
					</span>
				)}
			</div>
			{children}
		</div>
	)
}

function RecommendedBadge({className}: {className?: string}) {
	return (
		<span
			className={cn(
				'text-[10px] px-2 py-0.5 rounded-full bg-olive-950/[0.04] text-olive-700 border border-olive-950/10 dark:bg-white/5 dark:text-white/50 dark:border-[#757572]/20',
				className
			)}
		>
			Recommended
		</span>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function InstallWizardClient() {
	const {state, setState: setStateRaw, reset: resetRaw} = useWizardState()
	const [currentStep, setCurrentStep] = useState(0)
	const [slideDirection, setSlideDirection] = useState<'left' | 'right'>(
		'right'
	)
	const [presetId, setPresetId] = useQueryState(
		'preset',
		parseAsString.withDefault('')
	)
	const [creatingPreset, setCreatingPreset] = useState(false)
	const [copied, setCopied] = useState<'url' | 'command' | null>(null)
	const [pkgManager, setPkgManager] = useState<
		'bun' | 'npm' | 'pnpm' | 'yarn'
	>('bun')
	const [openExtractorGroups, setOpenExtractorGroups] = useState<
		Record<string, boolean>
	>({})
	const [nextStepsOpen, setNextStepsOpen] = useState(false)

	// Clear preset ID whenever state changes (preset becomes stale)
	const setState = useCallback(
		(updater: (prev: WizardStateV1) => WizardStateV1) => {
			if (presetId) {
				setPresetId(null, {history: 'replace', shallow: true})
			}
			setStateRaw(updater)
		},
		[presetId, setPresetId, setStateRaw]
	)

	const reset = useCallback(() => {
		if (presetId) {
			setPresetId(null, {history: 'replace', shallow: true})
		}
		resetRaw()
	}, [presetId, setPresetId, resetRaw])

	const [manifest, setManifest] = useState<RegistryManifest | null>(null)
	const [forceCustomEmbeddingModel, setForceCustomEmbeddingModel] =
		useState(false)

	useEffect(() => {
		let cancelled = false
		async function load() {
			try {
				const res = await fetch('/api/manifest', {cache: 'force-cache'})
				if (!res.ok) {
					return
				}
				const json = (await res.json()) as RegistryManifest
				if (cancelled) {
					return
				}
				setManifest(json)
			} catch {
				// ignore
			}
		}
		void load()
		return () => {
			cancelled = true
		}
	}, [])

	const extractorGroups = useMemo(() => {
		const byGroup = new Map<string, RegistryManifest['extractors']>()
		for (const ex of manifest?.extractors ?? []) {
			const group = String(ex.group ?? 'Other')
			byGroup.set(group, [...(byGroup.get(group) ?? []), ex])
		}
		return Array.from(byGroup.entries()).sort(([a], [b]) =>
			a.localeCompare(b)
		)
	}, [manifest])

	const availableConnectors = useMemo(() => {
		return (manifest?.connectors ?? [])
			.slice()
			.sort((a, b) => String(a.id).localeCompare(String(b.id)))
	}, [manifest])

	const availableBatteries = useMemo(() => {
		return (manifest?.batteries ?? [])
			.slice()
			.sort((a, b) => String(a.id).localeCompare(String(b.id)))
	}, [manifest])

	const extractorDocsById = useMemo(() => {
		const m = new Map<string, string | null>()
		for (const ex of manifest?.extractors ?? []) {
			m.set(String(ex.id), ex.docsPath ?? null)
		}
		return m
	}, [manifest])

	const connectorDocsById = useMemo(() => {
		const m = new Map<string, string | null>()
		for (const c of manifest?.connectors ?? []) {
			m.set(String(c.id), c.docsPath ?? null)
		}
		return m
	}, [manifest])

	const embeddingModelOptionsAll = useMemo(() => {
		return EMBEDDING_MODELS_BY_PROVIDER[state.embedding.provider] ?? []
	}, [state.embedding.provider])

	const embeddingModelOptions = useMemo(() => {
		if (state.embedding.type !== 'multimodal') {
			return embeddingModelOptionsAll
		}
		const filtered = embeddingModelOptionsAll.filter((m) =>
			m.supports.includes('multimodal')
		)
		return filtered.length > 0 ? filtered : embeddingModelOptionsAll
	}, [state.embedding.type, embeddingModelOptionsAll])

	const embeddingModelOptionById = useMemo(() => {
		const m = new Map<string, EmbeddingModelOption>()
		for (const o of embeddingModelOptionsAll) {
			m.set(o.id, o)
		}
		return m
	}, [embeddingModelOptionsAll])

	const selectedEmbeddingModelOption = embeddingModelOptionById.get(
		state.embedding.model
	)
	const isCustomEmbeddingModel =
		forceCustomEmbeddingModel || !selectedEmbeddingModelOption
	const embeddingModelSelectValue = isCustomEmbeddingModel
		? CUSTOM_MODEL_VALUE
		: state.embedding.model

	useEffect(() => {
		if (state.embedding.type !== 'multimodal') {
			return
		}
		const desired =
			DEFAULT_MULTIMODAL_MODEL_BY_PROVIDER[state.embedding.provider]
		if (!desired) {
			return
		}
		if (state.embedding.model === desired) {
			return
		}
		if (selectedEmbeddingModelOption?.supports.includes('multimodal')) {
			return
		}
		setForceCustomEmbeddingModel(false)
		setState((prev) => ({
			...prev,
			embedding: {...prev.embedding, model: desired}
		}))
	}, [
		state.embedding.type,
		state.embedding.provider,
		state.embedding.model,
		selectedEmbeddingModelOption,
		setState
	])

	function pmExecBase(pm: 'bun' | 'npm' | 'pnpm' | 'yarn') {
		return pm === 'bun'
			? 'bunx'
			: pm === 'pnpm'
				? 'pnpm dlx'
				: pm === 'yarn'
					? 'yarn dlx'
					: 'npx'
	}

	const commandPreview = useMemo(() => {
		if (presetId) {
			return `bunx unrag@latest init --yes --preset ${presetId}`
		}

		const args: string[] = ['bunx', 'unrag@latest', 'init', '--yes']
		args.push('--store', state.install.storeAdapter)
		args.push('--dir', state.install.installDir)
		args.push('--alias', state.install.aliasBase)

		if (state.modules.extractors.length > 0) {
			args.push('--extractors', state.modules.extractors.join(','))
		}

		return args.join(' ')
	}, [state, presetId])

	const installCommand = useMemo(() => {
		if (!presetId) {
			return null
		}
		const base = pmExecBase(pkgManager)
		return `${base} unrag@latest init --yes --preset ${presetId}`
	}, [pkgManager, presetId])

	const summary = useMemo(() => {
		return {
			adapter:
				STORE_ADAPTERS.find((a) => a.id === state.install.storeAdapter)
					?.name ?? state.install.storeAdapter,
			embeddingType: state.embedding.type,
			embeddingProvider:
				EMBEDDING_PROVIDER_OPTIONS.find(
					(p) => p.id === state.embedding.provider
				)?.name ?? state.embedding.provider,
			extractorCount: state.modules.extractors.length,
			connectorCount: state.modules.connectors.length,
			batteryCount: state.modules.batteries.length
		}
	}, [state])

	const requiredEmbeddingEnvVars = useMemo(() => {
		const p = state.embedding.provider
		if (p === 'ai') {
			return ['AI_GATEWAY_API_KEY']
		}
		if (p === 'openai') {
			return ['OPENAI_API_KEY']
		}
		if (p === 'google') {
			return ['GOOGLE_GENERATIVE_AI_API_KEY']
		}
		if (p === 'openrouter') {
			return ['OPENROUTER_API_KEY']
		}
		if (p === 'cohere') {
			return ['COHERE_API_KEY']
		}
		if (p === 'mistral') {
			return ['MISTRAL_API_KEY']
		}
		if (p === 'together') {
			return ['TOGETHER_AI_API_KEY']
		}
		if (p === 'voyage') {
			return ['VOYAGE_API_KEY']
		}
		if (p === 'azure') {
			return ['AZURE_OPENAI_API_KEY', 'AZURE_RESOURCE_NAME']
		}
		if (p === 'bedrock') {
			return ['AWS_REGION']
		}
		return []
	}, [state.embedding.provider])

	const handleCopy = async (type: 'url' | 'command') => {
		try {
			const text =
				type === 'url'
					? window.location.href
					: (installCommand ?? commandPreview)
			await navigator.clipboard.writeText(text)
			setCopied(type)
			setTimeout(() => setCopied(null), 2000)
		} catch {
			// ignore
		}
	}

	const handleCreatePreset = async () => {
		setCreatingPreset(true)
		try {
			const res = await fetch('/api/presets', {
				method: 'POST',
				headers: {'content-type': 'application/json'},
				body: JSON.stringify({state})
			})
			if (!res.ok) {
				return
			}
			const json = (await res.json()) as {id?: string}
			if (!json?.id) {
				return
			}
			setPresetId(json.id, {history: 'replace', shallow: true})
		} finally {
			setCreatingPreset(false)
		}
	}

	const goToStep = (index: number) => {
		if (index >= 0 && index < STEPS.length) {
			setSlideDirection(index > currentStep ? 'right' : 'left')
			setCurrentStep(index)
		}
	}

	const currentStepId = STEPS[currentStep]?.id ?? 'install'
	const embeddingProviderIcon =
		EMBEDDING_PROVIDER_OPTIONS.find(
			(p) => p.id === state.embedding.provider
		)?.icon ??
		({light: VercelLight, dark: VercelDark} satisfies ThemeIconPair)
	const embeddingTriggerIcon = isCustomEmbeddingModel
		? embeddingProviderIcon
		: (selectedEmbeddingModelOption?.icon ?? embeddingProviderIcon)
	const embeddingTriggerLabel = isCustomEmbeddingModel
		? state.embedding.model.trim()
			? state.embedding.model
			: 'Custom model'
		: (selectedEmbeddingModelOption?.label ?? state.embedding.model)

	return (
		<div className="min-h-screen bg-transparent">
			{installCommand ? (
				<NextStepsDialog
					open={nextStepsOpen}
					onOpenChange={setNextStepsOpen}
					state={state}
					manifest={manifest}
				/>
			) : null}
			<header className="sticky top-0 z-50 border-b border-olive-950/10 bg-lemon-50/80 backdrop-blur-xl dark:border-[#757572]/20 dark:bg-lemon-950/80">
				<div className="max-w-[1600px] mx-auto px-6 min-h-14 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:py-0">
					<div className="flex flex-wrap items-center gap-4">
						<Link
							href="/"
							className="flex items-center gap-2 text-olive-700 hover:text-olive-950 transition-colors dark:text-white/60 dark:hover:text-white/90"
						>
							<ArrowLeft className="w-4 h-4" />
							<span className="text-sm font-medium">Back</span>
						</Link>
						<div className="w-px h-5 bg-olive-950/10 dark:bg-white/10" />
						<h1 className="font-display text-base font-normal text-olive-950/80 dark:text-white/80">
							Configure Installation
						</h1>
					</div>
					<div className="flex-wrap items-center gap-3 hidden sm:flex">
						<PlainButton
							size="md"
							onClick={() => handleCopy('url')}
						>
							<Share2 className="w-4 h-4" />
							{copied === 'url' ? 'Copied!' : 'Share'}
						</PlainButton>
						<a
							href="/docs/getting-started/quickstart"
							target="_blank"
							className="flex items-center gap-2 text-sm text-olive-700 hover:text-olive-950 transition-colors dark:text-white/60 dark:hover:text-white/90"
							rel="noreferrer"
						>
							<span>Docs</span>
							<ExternalLink className="w-3.5 h-3.5" />
						</a>
					</div>
				</div>
			</header>

			<div className="max-w-[1600px] mx-auto flex flex-col min-h-[calc(100vh-3.5rem)] lg:flex-row">
				<aside className="hidden w-64 shrink-0 border-r border-olive-950/10 p-6 lg:block dark:border-[#757572]/20">
					<div className="sticky top-20">
						<div className="text-xs font-medium uppercase tracking-wider text-olive-500 mb-4">
							Steps
						</div>
						<nav className="space-y-1">
							{STEPS.map((step, index) => {
								const isActive = index === currentStep
								const isCompleted = index < currentStep

								return (
									<button
										key={step.id}
										onClick={() => goToStep(index)}
										className={cn(
											'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
											'focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-500/30',
											isActive
												? 'bg-olive-950/[0.05] text-olive-950 dark:bg-olive-700/20 dark:text-white'
												: isCompleted
													? 'text-olive-700 hover:text-olive-950 hover:bg-olive-950/[0.04] dark:text-olive-300 dark:hover:text-white dark:hover:bg-olive-800/20'
													: 'text-olive-600 hover:text-olive-950 hover:bg-olive-950/[0.03] dark:text-olive-500 dark:hover:text-olive-300 dark:hover:bg-olive-800/15'
										)}
									>
										<div
											className={cn(
												'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
												isActive
													? 'bg-olive-950/[0.06] text-olive-950 dark:bg-olive-600/30 dark:text-white'
													: isCompleted
														? 'bg-olive-950/[0.05] text-olive-700 dark:bg-olive-500/20 dark:text-olive-300'
														: 'bg-olive-950/[0.03] text-olive-600 dark:bg-olive-800/30 dark:text-olive-500'
											)}
										>
											{isCompleted ? (
												<Check className="w-3.5 h-3.5" />
											) : (
												step.icon
											)}
										</div>
										<span className="font-medium">
											{step.label}
										</span>
										{isActive && (
											<ChevronRight className="w-4 h-4 ml-auto text-olive-500 dark:text-white/40" />
										)}
									</button>
								)
							})}
						</nav>

						<div className="mt-8 pt-6 border-t border-olive-950/10 dark:border-[#757572]/20">
							<PlainButton
								size="md"
								onClick={reset}
								className="w-full justify-start"
							>
								<RefreshCw className="w-4 h-4" />
								Reset to defaults
							</PlainButton>
						</div>
					</div>
				</aside>

				<main className="flex-1 px-6 py-8 sm:p-8 overflow-y-auto">
					<div className="max-w-full sm:max-w-2xl">
						<div className="mb-6 lg:hidden">
							<div className="flex items-center justify-between">
								<div className="text-xs font-medium uppercase tracking-wider text-olive-500">
									Steps
								</div>
								<PlainButton size="md" onClick={reset}>
									<RefreshCw className="w-4 h-4" />
									Reset
								</PlainButton>
							</div>
							<div className="mt-3 flex gap-2 overflow-x-auto pb-2">
								{STEPS.map((step, index) => {
									const isActive = index === currentStep
									const isCompleted = index < currentStep

									return (
										<button
											key={step.id}
											onClick={() => goToStep(index)}
											className={cn(
												'shrink-0 inline-flex items-center gap-2 rounded-full border border-olive-950/10 px-3 py-2 text-xs font-medium transition-colors dark:border-[#757572]/20',
												isActive
													? 'bg-olive-950/[0.05] text-olive-950 dark:bg-olive-700/20 dark:text-white'
													: isCompleted
														? 'text-olive-700 hover:text-olive-950 hover:bg-olive-950/[0.04] dark:text-olive-300 dark:hover:text-white dark:hover:bg-olive-800/20'
														: 'text-olive-600 hover:text-olive-950 hover:bg-olive-950/[0.03] dark:text-olive-500 dark:hover:text-olive-300 dark:hover:bg-olive-800/15'
											)}
										>
											<span
												className={cn(
													'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
													isActive
														? 'bg-olive-950/[0.06] text-olive-950 dark:bg-olive-600/30 dark:text-white'
														: isCompleted
															? 'bg-olive-950/[0.05] text-olive-700 dark:bg-olive-500/20 dark:text-olive-300'
															: 'bg-olive-950/[0.03] text-olive-600 dark:bg-olive-800/30 dark:text-olive-500'
												)}
											>
												{isCompleted ? (
													<Check className="w-3 h-3" />
												) : (
													step.icon
												)}
											</span>
											<span>{step.label}</span>
										</button>
									)
								})}
							</div>
						</div>
						{currentStepId === 'install' && (
							<div
								className={cn(
									'animate-in fade-in duration-300',
									slideDirection === 'right'
										? 'slide-in-from-right-4'
										: 'slide-in-from-left-4'
								)}
							>
								{/* Welcome Hero */}
								<div className="mb-8">
									<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-olive-950/[0.06] to-olive-950/[0.03] border border-olive-950/10 mb-4 dark:from-olive-700/20 dark:to-olive-700/10 dark:border-[#757572]/25">
										<Zap className="w-3.5 h-3.5 text-olive-400" />
										<span className="text-xs font-medium text-olive-700 dark:text-olive-300">
											Interactive Setup Wizard
										</span>
									</div>
									<h2 className="font-display text-3xl font-normal text-olive-950 mb-2 dark:text-white/95">
										Configure your RAG pipeline
									</h2>
									<p className="text-olive-700 leading-relaxed dark:text-white/50">
										This wizard will guide you through
										setting up Unrag in your project.
										Configure your database, embeddings,
										extractors, and connectors—then generate
										a single command to install everything.
									</p>
								</div>

								{/* Project Configuration */}
								<div className="rounded-xl border border-olive-950/10 bg-white/70 p-5 dark:border-[#757572]/15 dark:bg-white/[0.02]">
									<div className="flex items-center gap-2 mb-4">
										<Settings2 className="w-4 h-4 text-olive-700 dark:text-white/50" />
										<span className="text-sm font-medium text-olive-900/80 dark:text-white/70">
											Project Configuration
										</span>
									</div>
									<div className="space-y-5">
										<FieldGroup
											label="Install directory"
											hint="Relative to project root"
										>
											<Input
												value={state.install.installDir}
												onChange={(e) =>
													setState((prev) => ({
														...prev,
														install: {
															...prev.install,
															installDir:
																e.target.value
														}
													}))
												}
												className="bg-white border-olive-950/10 text-olive-950 placeholder:text-olive-500 focus:border-olive-950/20 dark:bg-white/[0.03] dark:border-[#757572]/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#757572]/30"
											/>
										</FieldGroup>

										<FieldGroup
											label="Import alias"
											hint="TypeScript path alias"
										>
											<Input
												value={state.install.aliasBase}
												onChange={(e) =>
													setState((prev) => ({
														...prev,
														install: {
															...prev.install,
															aliasBase:
																e.target.value
														}
													}))
												}
												className="bg-white border-olive-950/10 text-olive-950 placeholder:text-olive-500 focus:border-olive-950/20 dark:bg-white/[0.03] dark:border-[#757572]/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#757572]/30"
											/>
										</FieldGroup>
									</div>
								</div>

								{/* Tech Stack badges */}
								<div className="mt-6 flex flex-wrap items-center gap-2">
									<span className="text-xs text-olive-500">
										Built with
									</span>
									{[
										'TypeScript',
										'pgvector',
										'AI SDK',
										'Drizzle / Prisma'
									].map((tech) => (
										<span
											key={tech}
											className="inline-flex items-center px-2.5 py-1 rounded-md bg-olive-950/[0.03] border border-olive-950/10 text-xs font-medium text-olive-700 dark:bg-olive-800/20 dark:border-[#757572]/25 dark:text-olive-400"
										>
											{tech}
										</span>
									))}
								</div>
							</div>
						)}

						{currentStepId === 'database' && (
							<div
								className={cn(
									'animate-in fade-in duration-300',
									slideDirection === 'right'
										? 'slide-in-from-right-4'
										: 'slide-in-from-left-4'
								)}
							>
								<SectionHeader
									title="Database Adapter"
									description="Choose how Unrag will interact with your PostgreSQL database."
								/>
								<div className="space-y-3">
									{STORE_ADAPTERS.map((adapter) => (
										<SelectionCard
											key={adapter.id}
											title={adapter.name}
											description={adapter.description}
											selected={
												state.install.storeAdapter ===
												adapter.id
											}
											onClick={() =>
												setState((prev) => ({
													...prev,
													install: {
														...prev.install,
														storeAdapter: adapter.id
													}
												}))
											}
											badge={
												adapter.id === 'drizzle'
													? 'recommended'
													: undefined
											}
										/>
									))}
								</div>

								<div className="mt-8 pt-6 border-t border-olive-950/10 dark:border-[#757572]/20">
									<SectionHeader
										title="Storage Options"
										description="Control what content is persisted to the database."
									/>
									<div className="space-y-4">
										<div className="flex items-center justify-between gap-4 rounded-xl border border-olive-950/10 bg-white/60 p-4 dark:border-[#757572]/15 dark:bg-white/[0.02]">
											<div>
												<div className="font-medium text-olive-950/90 dark:text-white/90">
													Store chunk content
												</div>
												<div className="text-sm text-olive-700 dark:text-white/50">
													Persist chunk text for
													retrieval results
												</div>
											</div>
											<Switch
												checked={
													state.storage
														.storeChunkContent
												}
												onCheckedChange={(checked) =>
													setState((prev) => ({
														...prev,
														storage: {
															...prev.storage,
															storeChunkContent:
																checked
														}
													}))
												}
											/>
										</div>
										<div className="flex items-center justify-between gap-4 rounded-xl border border-olive-950/10 bg-white/60 p-4 dark:border-[#757572]/15 dark:bg-white/[0.02]">
											<div>
												<div className="font-medium text-olive-950/90 dark:text-white/90">
													Store document content
												</div>
												<div className="text-sm text-olive-700 dark:text-white/50">
													Persist full document text
												</div>
											</div>
											<Switch
												checked={
													state.storage
														.storeDocumentContent
												}
												onCheckedChange={(checked) =>
													setState((prev) => ({
														...prev,
														storage: {
															...prev.storage,
															storeDocumentContent:
																checked
														}
													}))
												}
											/>
										</div>
									</div>
								</div>
							</div>
						)}

						{currentStepId === 'embedding' && (
							<div
								className={cn(
									'animate-in fade-in duration-300',
									slideDirection === 'right'
										? 'slide-in-from-right-4'
										: 'slide-in-from-left-4'
								)}
							>
								<SectionHeader
									title="Embedding Type"
									description="Choose the embedding strategy for your content."
								/>
								<div className="space-y-3">
									{EMBEDDING_TYPES.map((type) => (
										<SelectionCard
											key={type.id}
											title={type.name}
											description={type.description}
											selected={
												state.embedding.type === type.id
											}
											onClick={() => {
												// If switching to multimodal, auto-switch to Voyage (only provider with multimodal support)
												if (
													type.id === 'multimodal' &&
													state.embedding.provider !==
														'voyage'
												) {
													setForceCustomEmbeddingModel(
														false
													)
													setState((prev) => ({
														...prev,
														embedding: {
															...prev.embedding,
															type: type.id,
															provider: 'voyage',
															model:
																DEFAULT_MULTIMODAL_MODEL_BY_PROVIDER.voyage ??
																'voyage-multimodal-3'
														}
													}))
												} else {
													setState((prev) => ({
														...prev,
														embedding: {
															...prev.embedding,
															type: type.id
														}
													}))
												}
											}}
										/>
									))}
								</div>

								<div className="mt-8 pt-6 border-t border-olive-950/10 space-y-6 dark:border-[#757572]/20">
									<FieldGroup
										label="Embedding provider"
										hint="This controls which provider Unrag uses for embeddings (and which env vars you'll need)."
									>
										{(() => {
											const selectedProvider =
												EMBEDDING_PROVIDER_OPTIONS.find(
													(p) =>
														p.id ===
														state.embedding.provider
												)
											const SelectedIcon =
												selectedProvider?.icon ??
												({
													light: VercelLight,
													dark: VercelDark
												} satisfies ThemeIconPair)
											return (
												<div className="space-y-3">
													<Select
														value={
															state.embedding
																.provider
														}
														onValueChange={(v) => {
															const providerId =
																v as EmbeddingProviderName
															setForceCustomEmbeddingModel(
																false
															)
															const nextModel =
																state.embedding
																	.type ===
																'multimodal'
																	? (DEFAULT_MULTIMODAL_MODEL_BY_PROVIDER[
																			providerId
																		] ??
																		DEFAULT_MODEL_BY_PROVIDER[
																			providerId
																		])
																	: DEFAULT_MODEL_BY_PROVIDER[
																			providerId
																		]
															setState(
																(prev) => ({
																	...prev,
																	embedding: {
																		...prev.embedding,
																		provider:
																			providerId,
																		model: nextModel
																	}
																})
															)
														}}
													>
														<SelectTrigger className="h-auto min-h-[72px] bg-white border-olive-950/10 text-olive-950 hover:bg-white/80 focus:ring-olive-950/15 px-4 py-3 dark:bg-white/[0.03] dark:border-[#757572]/20 dark:text-white dark:hover:bg-white/[0.04] dark:focus:ring-white/20">
															<SelectValue>
																<div className="flex items-start gap-3 text-left">
																	<div className="w-10 h-10 rounded-lg bg-olive-950/[0.04] border border-olive-950/10 flex items-center justify-center shrink-0 text-olive-900 dark:bg-white/5 dark:border-[#757572]/20 dark:text-white/80">
																		<ThemeIcon
																			icon={
																				SelectedIcon
																			}
																			width={
																				18
																			}
																			height={
																				18
																			}
																			className="text-olive-950/85 dark:text-white/85"
																			aria-label={
																				selectedProvider?.name ??
																				'Provider'
																			}
																		/>
																	</div>
																	<div className="min-w-0 flex-1">
																		<div className="flex items-center gap-2">
																			<span className="font-medium text-olive-950/90 dark:text-white/90">
																				{selectedProvider?.name ??
																					'Select provider'}
																			</span>
																			{selectedProvider?.badge ? (
																				<span className="text-[10px] px-2 py-0.5 rounded-full bg-olive-950/[0.04] text-olive-700 border border-olive-950/10 capitalize dark:bg-white/5 dark:text-white/40 dark:border-[#757572]/20">
																					{
																						selectedProvider.badge
																					}
																				</span>
																			) : null}
																		</div>
																		<p className="mt-0.5 text-sm text-olive-700 leading-relaxed line-clamp-1 dark:text-white/50">
																			{
																				selectedProvider?.description
																			}
																		</p>
																	</div>
																</div>
															</SelectValue>
														</SelectTrigger>
														<SelectContent className="border-olive-950/10 bg-lemon-50 text-olive-950 max-h-[400px] dark:border-[#757572]/20 dark:bg-lemon-900 dark:text-white">
															{EMBEDDING_PROVIDER_OPTIONS.map(
																(p) => {
																	const Icon =
																		p.icon
																	return (
																		<SelectItem
																			key={
																				p.id
																			}
																			value={
																				p.id
																			}
																			className="focus:bg-olive-950/[0.04] focus:text-olive-950 data-[state=checked]:text-olive-950 py-3 px-3 dark:focus:bg-white/5 dark:focus:text-white dark:data-[state=checked]:text-white"
																		>
																			<div className="flex items-start gap-3">
																				<div className="w-9 h-9 rounded-lg bg-olive-950/[0.04] border border-olive-950/10 flex items-center justify-center shrink-0 text-olive-900 dark:bg-white/5 dark:border-[#757572]/20 dark:text-white/80">
																					<ThemeIcon
																						icon={
																							Icon
																						}
																						width={
																							16
																						}
																						height={
																							16
																						}
																						className="text-olive-950/85 dark:text-white/85"
																						aria-label={
																							p.name
																						}
																					/>
																				</div>
																				<div className="min-w-0 flex-1">
																					<div className="flex items-center gap-2">
																						<span className="font-medium text-olive-950/90 dark:text-white/90">
																							{
																								p.name
																							}
																						</span>
																						{p.badge ? (
																							<span className="text-[10px] px-2 py-0.5 rounded-full bg-olive-950/[0.04] text-olive-700 border border-olive-950/10 capitalize dark:bg-white/5 dark:text-white/40 dark:border-[#757572]/20">
																								{
																									p.badge
																								}
																							</span>
																						) : null}
																					</div>
																					<p className="mt-0.5 text-xs text-olive-700 leading-relaxed dark:text-white/45">
																						{
																							p.description
																						}
																					</p>
																				</div>
																			</div>
																		</SelectItem>
																	)
																}
															)}
														</SelectContent>
													</Select>
													{selectedProvider?.docsHref ? (
														<div className="flex items-center gap-2">
															<Link
																href={
																	selectedProvider.docsHref
																}
																target="_blank"
																rel="noreferrer"
																className="inline-flex items-center gap-1.5 text-xs text-olive-700 hover:text-olive-950 transition-colors dark:text-white/45 dark:hover:text-white/70"
															>
																<ExternalLink className="w-3 h-3" />
																View{' '}
																{
																	selectedProvider.name
																}{' '}
																docs
															</Link>
														</div>
													) : null}
												</div>
											)
										})()}
										{state.embedding.type ===
											'multimodal' &&
										state.embedding.provider !==
											'voyage' ? (
											<div className="mt-3 text-xs text-olive-700 leading-relaxed dark:text-white/45">
												Heads up: true multimodal
												embeddings (image + text in the
												same vector space) are only
												supported by the{' '}
												<Link
													href="/docs/providers/voyage"
													target="_blank"
													rel="noreferrer"
													className="text-olive-950 hover:text-olive-950 dark:text-white/70 dark:hover:text-white"
												>
													Voyage provider
												</Link>
												. With other providers, images
												are typically indexed via
												extractors (captions/OCR) as
												text.
											</div>
										) : null}
									</FieldGroup>

									<FieldGroup
										label="Embedding model"
										hint={
											state.embedding.type ===
											'multimodal'
												? 'Multimodal: pick a provider/model that supports image embeddings (Voyage recommended)'
												: 'Choose a preset or use a custom model id'
										}
									>
										<div className="space-y-3">
											<Select
												value={
													embeddingModelSelectValue
												}
												onValueChange={(v) => {
													if (
														v === CUSTOM_MODEL_VALUE
													) {
														setForceCustomEmbeddingModel(
															true
														)
														return
													}
													setForceCustomEmbeddingModel(
														false
													)
													setState((prev) => ({
														...prev,
														embedding: {
															...prev.embedding,
															model: v
														}
													}))
												}}
											>
												<SelectTrigger className="h-12 bg-white border-olive-950/10 text-olive-950 hover:bg-white/80 focus:ring-olive-950/15 dark:bg-white/[0.03] dark:border-[#757572]/20 dark:text-white dark:hover:bg-white/[0.04] dark:focus:ring-white/20">
													<SelectValue>
														<div className="inline-flex items-center gap-2.5">
															<div className="w-7 h-7 rounded-lg bg-olive-950/[0.04] border border-olive-950/10 flex items-center justify-center shrink-0 dark:bg-white/5 dark:border-[#757572]/20">
																{(() => {
																	return (
																		<ThemeIcon
																			icon={
																				embeddingTriggerIcon
																			}
																			width={
																				16
																			}
																			height={
																				16
																			}
																			className="text-olive-950/90 dark:text-white/90"
																			aria-label="Model provider"
																		/>
																	)
																})()}
															</div>
															<span className="font-mono text-sm text-olive-950/85 dark:text-white/85">
																{
																	embeddingTriggerLabel
																}
															</span>
														</div>
													</SelectValue>
												</SelectTrigger>
												<SelectContent className="border-olive-950/10 bg-lemon-50 text-olive-950 dark:border-[#757572]/20 dark:bg-lemon-900 dark:text-white">
													{embeddingModelOptions.map(
														(opt) => {
															const Icon =
																opt.icon
															return (
																<SelectItem
																	key={opt.id}
																	value={
																		opt.id
																	}
																	className="focus:bg-olive-950/[0.04] focus:text-olive-950 data-[state=checked]:text-olive-950 dark:focus:bg-white/5 dark:focus:text-white dark:data-[state=checked]:text-white"
																>
																	<span className="flex items-center gap-2 w-full">
																		<span className="w-5 h-5 rounded bg-olive-950/[0.04] border border-olive-950/10 flex items-center justify-center dark:bg-white/5 dark:border-[#757572]/20">
																			<ThemeIcon
																				icon={
																					Icon
																				}
																				width={
																					14
																				}
																				height={
																					14
																				}
																				className="text-olive-950/85 dark:text-white/85"
																				aria-label={
																					opt.providerLabel
																				}
																			/>
																		</span>
																		<span className="font-mono text-sm">
																			{
																				opt.label
																			}
																		</span>
																		<span className="ml-auto text-xs text-olive-600 dark:text-white/35">
																			{
																				opt.providerLabel
																			}
																		</span>
																	</span>
																</SelectItem>
															)
														}
													)}
													<SelectSeparator className="bg-olive-950/10 dark:bg-white/10" />
													<SelectItem
														value={
															CUSTOM_MODEL_VALUE
														}
														className="focus:bg-olive-950/[0.04] focus:text-olive-950 data-[state=checked]:text-olive-950 dark:focus:bg-white/5 dark:focus:text-white dark:data-[state=checked]:text-white"
													>
														<span className="flex items-center gap-2 w-full">
															<span className="w-5 h-5 rounded bg-olive-950/[0.04] border border-olive-950/10 flex items-center justify-center dark:bg-white/5 dark:border-[#757572]/20">
																<ThemeIcon
																	icon={{
																		light: VercelLight,
																		dark: VercelDark
																	}}
																	width={14}
																	height={14}
																	className="text-olive-950/85 dark:text-white/85"
																	aria-label="Custom model"
																/>
															</span>
															<span className="text-sm">
																Custom model…
															</span>
														</span>
													</SelectItem>
												</SelectContent>
											</Select>

											{isCustomEmbeddingModel ? (
												<div className="space-y-2">
													<Input
														value={
															state.embedding
																.model
														}
														onChange={(e) => {
															setForceCustomEmbeddingModel(
																true
															)
															setState(
																(prev) => ({
																	...prev,
																	embedding: {
																		...prev.embedding,
																		model: e
																			.target
																			.value
																	}
																})
															)
														}}
														placeholder={
															MODEL_PLACEHOLDER_BY_PROVIDER[
																state.embedding
																	.provider
															] ?? 'model-id'
														}
														className="bg-white border-olive-950/10 text-olive-950 font-mono text-sm placeholder:text-olive-500 focus:border-olive-950/20 dark:bg-white/[0.03] dark:border-[#757572]/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#757572]/30"
													/>
													<div className="text-xs text-olive-700/80 dark:text-white/40">
														{state.embedding
															.type ===
														'multimodal'
															? 'Make sure this model supports image embeddings.'
															: state.embedding
																		.provider ===
																	'ai'
																? 'Tip: for AI Gateway, use the AI SDK model id (e.g. openai/text-embedding-3-small).'
																: 'Tip: use the provider-native model id (see provider docs).'}
													</div>
												</div>
											) : null}
										</div>
									</FieldGroup>

									<div className="grid grid-cols-3 gap-4">
										<FieldGroup label="Chunk size">
											<Select
												value={String(
													state.defaults.chunkSize
												)}
												onValueChange={(v) =>
													setState((prev) => ({
														...prev,
														defaults: {
															...prev.defaults,
															chunkSize: Number(v)
														}
													}))
												}
											>
												<SelectTrigger className="h-11 bg-white border-olive-950/10 text-olive-950 hover:bg-white/80 focus:ring-olive-950/15 dark:bg-white/[0.03] dark:border-[#757572]/20 dark:text-white dark:hover:bg-white/[0.04] dark:focus:ring-white/20">
													<SelectValue>
														<div className="flex items-center gap-2 w-full min-w-0">
															<span className="font-mono text-sm">
																{
																	state
																		.defaults
																		.chunkSize
																}
															</span>
															{state.defaults
																.chunkSize ===
															RECOMMENDED_DEFAULTS.chunkSize ? (
																<RecommendedBadge className="ml-auto shrink-0" />
															) : null}
														</div>
													</SelectValue>
												</SelectTrigger>
												<SelectContent className="border-olive-950/10 bg-lemon-50 text-olive-950 dark:border-[#757572]/20 dark:bg-lemon-900 dark:text-white">
													{CHUNK_SIZE_OPTIONS.map(
														(n) => (
															<SelectItem
																key={n}
																value={String(
																	n
																)}
																className="focus:bg-olive-950/[0.04] focus:text-olive-950 data-[state=checked]:text-olive-950 dark:focus:bg-white/5 dark:focus:text-white dark:data-[state=checked]:text-white"
															>
																<div className="flex items-center gap-2 w-full min-w-0">
																	<span className="font-mono text-sm">
																		{n}
																	</span>
																	{n ===
																	RECOMMENDED_DEFAULTS.chunkSize ? (
																		<RecommendedBadge className="ml-auto shrink-0" />
																	) : null}
																</div>
															</SelectItem>
														)
													)}
												</SelectContent>
											</Select>
										</FieldGroup>
										<FieldGroup label="Overlap">
											<Select
												value={String(
													state.defaults.chunkOverlap
												)}
												onValueChange={(v) =>
													setState((prev) => ({
														...prev,
														defaults: {
															...prev.defaults,
															chunkOverlap:
																Number(v)
														}
													}))
												}
											>
												<SelectTrigger className="h-11 bg-white border-olive-950/10 text-olive-950 hover:bg-white/80 focus:ring-olive-950/15 dark:bg-white/[0.03] dark:border-[#757572]/20 dark:text-white dark:hover:bg-white/[0.04] dark:focus:ring-white/20">
													<SelectValue>
														<div className="flex items-center gap-2 w-full min-w-0">
															<span className="font-mono text-sm">
																{
																	state
																		.defaults
																		.chunkOverlap
																}
															</span>
															{state.defaults
																.chunkOverlap ===
															RECOMMENDED_DEFAULTS.chunkOverlap ? (
																<RecommendedBadge className="ml-auto shrink-0" />
															) : null}
														</div>
													</SelectValue>
												</SelectTrigger>
												<SelectContent className="border-olive-950/10 bg-lemon-50 text-olive-950 dark:border-[#757572]/20 dark:bg-lemon-900 dark:text-white">
													{CHUNK_OVERLAP_OPTIONS.map(
														(n) => (
															<SelectItem
																key={n}
																value={String(
																	n
																)}
																className="focus:bg-olive-950/[0.04] focus:text-olive-950 data-[state=checked]:text-olive-950 dark:focus:bg-white/5 dark:focus:text-white dark:data-[state=checked]:text-white"
															>
																<div className="flex items-center gap-2 w-full min-w-0">
																	<span className="font-mono text-sm">
																		{n}
																	</span>
																	{n ===
																	RECOMMENDED_DEFAULTS.chunkOverlap ? (
																		<RecommendedBadge className="ml-auto shrink-0" />
																	) : null}
																</div>
															</SelectItem>
														)
													)}
												</SelectContent>
											</Select>
										</FieldGroup>
										<FieldGroup label="Top K">
											<Select
												value={String(
													state.defaults.topK
												)}
												onValueChange={(v) =>
													setState((prev) => ({
														...prev,
														defaults: {
															...prev.defaults,
															topK: Number(v)
														}
													}))
												}
											>
												<SelectTrigger className="h-11 bg-white border-olive-950/10 text-olive-950 hover:bg-white/80 focus:ring-olive-950/15 dark:bg-white/[0.03] dark:border-[#757572]/20 dark:text-white dark:hover:bg-white/[0.04] dark:focus:ring-white/20">
													<SelectValue>
														<div className="flex items-center gap-2 w-full min-w-0">
															<span className="font-mono text-sm">
																{
																	state
																		.defaults
																		.topK
																}
															</span>
															{state.defaults
																.topK ===
															RECOMMENDED_DEFAULTS.topK ? (
																<RecommendedBadge className="ml-auto shrink-0" />
															) : null}
														</div>
													</SelectValue>
												</SelectTrigger>
												<SelectContent className="border-olive-950/10 bg-lemon-50 text-olive-950 dark:border-[#757572]/20 dark:bg-lemon-900 dark:text-white">
													{TOP_K_OPTIONS.map((n) => (
														<SelectItem
															key={n}
															value={String(n)}
															className="focus:bg-olive-950/[0.04] focus:text-olive-950 data-[state=checked]:text-olive-950 dark:focus:bg-white/5 dark:focus:text-white dark:data-[state=checked]:text-white"
														>
															<div className="flex items-center gap-2 w-full min-w-0">
																<span className="font-mono text-sm">
																	{n}
																</span>
																{n ===
																RECOMMENDED_DEFAULTS.topK ? (
																	<RecommendedBadge className="ml-auto shrink-0" />
																) : null}
															</div>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FieldGroup>
									</div>

									{requiredEmbeddingEnvVars.length > 0 ? (
										<div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
											<div className="flex items-start gap-3">
												<div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
													<Sparkles className="w-4 h-4 text-amber-400" />
												</div>
												<div>
													<div className="font-medium text-amber-400/90">
														Environment variables
														required
													</div>
													<div className="mt-1 text-sm text-amber-400/60">
														Set{' '}
														{requiredEmbeddingEnvVars.map(
															(k, idx) => (
																<span key={k}>
																	<code className="font-mono text-amber-400/80">
																		{k}
																	</code>
																	{idx <
																	requiredEmbeddingEnvVars.length -
																		1 ? (
																		<span>
																			,{' '}
																		</span>
																	) : null}
																</span>
															)
														)}{' '}
														to enable embeddings.
													</div>
												</div>
											</div>
										</div>
									) : null}
								</div>
							</div>
						)}

						{currentStepId === 'extractors' && (
							<div
								className={cn(
									'animate-in fade-in duration-300',
									slideDirection === 'right'
										? 'slide-in-from-right-4'
										: 'slide-in-from-left-4'
								)}
							>
								<SectionHeader
									title="Rich Media Extractors"
									description="Select extractors to process PDFs, images, audio, and video content."
								/>
								{!manifest ? (
									<div className="flex items-center justify-center h-40 text-white/40">
										Loading extractors...
									</div>
								) : (
									<div className="space-y-8">
										{extractorGroups.map(([group, exs]) => (
											<div key={group}>
												{(() => {
													const isOpen =
														openExtractorGroups[
															group
														] ?? true
													return (
														<>
															<button
																type="button"
																onClick={() =>
																	setOpenExtractorGroups(
																		(
																			prev
																		) => ({
																			...prev,
																			[group]:
																				!(
																					prev[
																						group
																					] ??
																					true
																				)
																		})
																	)
																}
																className="w-full flex items-center gap-2 mb-3 text-left"
																aria-expanded={
																	isOpen
																}
															>
																<div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-white/40">
																	{EXTRACTOR_ICONS[
																		group.toLowerCase()
																	] ?? (
																		<FileText className="w-3.5 h-3.5" />
																	)}
																</div>
																<span className="text-sm font-medium text-white/60">
																	{group}
																</span>
																<span className="text-xs text-white/30">
																	(
																	{exs.length}
																	)
																</span>
																<ChevronDown
																	className={cn(
																		'w-4 h-4 ml-auto text-white/35 transition-transform duration-200',
																		isOpen &&
																			'rotate-180'
																	)}
																/>
															</button>

															<div
																className={cn(
																	'grid transition-all duration-300',
																	isOpen
																		? 'grid-rows-[1fr]'
																		: 'grid-rows-[0fr]'
																)}
															>
																<div className="min-h-0 overflow-hidden">
																	<div className="grid gap-2">
																		{exs.map(
																			(
																				ex
																			) => {
																				const id =
																					String(
																						ex.id
																					)
																				return (
																					<ExtractorCard
																						key={
																							id
																						}
																						id={
																							id
																						}
																						label={
																							ex.label
																						}
																						description={
																							ex.description
																						}
																						group={
																							ex.group
																						}
																						workerOnly={
																							ex.workerOnly
																						}
																						docsHref={
																							ex.docsPath ??
																							null
																						}
																						selected={state.modules.extractors.includes(
																							id
																						)}
																						onToggle={() =>
																							setState(
																								(
																									prev
																								) => ({
																									...prev,
																									modules:
																										{
																											...prev.modules,
																											extractors:
																												toggleInList(
																													prev
																														.modules
																														.extractors,
																													id
																												)
																										}
																								})
																							)
																						}
																					/>
																				)
																			}
																		)}
																	</div>
																</div>
															</div>
														</>
													)
												})()}
											</div>
										))}
									</div>
								)}
							</div>
						)}

						{currentStepId === 'connectors' && (
							<div
								className={cn(
									'animate-in fade-in duration-300',
									slideDirection === 'right'
										? 'slide-in-from-right-4'
										: 'slide-in-from-left-4'
								)}
							>
								<SectionHeader
									title="Data Connectors"
									description="Install connectors to sync data from external sources."
								/>
								{!manifest ? (
									<div className="flex items-center justify-center h-40 text-white/40">
										Loading connectors...
									</div>
								) : (
									<div className="space-y-3">
										{availableConnectors.map((c) => {
											const id = String(c.id)
											return (
												<ConnectorCard
													key={id}
													id={id}
													displayName={c.displayName}
													description={c.description}
													status={c.status}
													docsHref={
														c.docsPath ?? null
													}
													logo={connectorLogoById[id]}
													selected={state.modules.connectors.includes(
														id
													)}
													onToggle={() =>
														setState((prev) => ({
															...prev,
															modules: {
																...prev.modules,
																connectors:
																	toggleInList(
																		prev
																			.modules
																			.connectors,
																		id
																	)
															}
														}))
													}
												/>
											)
										})}
									</div>
								)}
							</div>
						)}

						{currentStepId === 'batteries' && (
							<div
								className={cn(
									'animate-in fade-in duration-300',
									slideDirection === 'right'
										? 'slide-in-from-right-4'
										: 'slide-in-from-left-4'
								)}
							>
								<SectionHeader
									title="Optional Batteries"
									description="Add optional modules for improved retrieval quality and evaluation. These are vendored into your codebase for full control."
								/>
								{!manifest ? (
									<div className="flex items-center justify-center h-40 text-white/40">
										Loading batteries...
									</div>
								) : availableBatteries.length === 0 ? (
									<div className="rounded-xl border border-[#757572]/15 bg-white/[0.02] p-6 text-center">
										<Battery className="w-8 h-8 mx-auto mb-3 text-white/20" />
										<div className="text-sm text-white/50">
											No batteries available yet.
										</div>
										<div className="mt-1 text-xs text-white/30">
											Batteries like rerankers and eval
											harnesses will appear here when
											available.
										</div>
									</div>
								) : (
									<div className="space-y-3">
										{availableBatteries.map((b) => {
											const id = String(b.id)
											return (
												<BatteryCard
													key={id}
													id={id}
													displayName={b.displayName}
													description={b.description}
													status={b.status}
													docsHref={
														b.docsPath ?? null
													}
													defaultModel={
														b.defaultModel
													}
													selected={state.modules.batteries.includes(
														id
													)}
													onToggle={() =>
														setState((prev) => ({
															...prev,
															modules: {
																...prev.modules,
																batteries:
																	toggleInList(
																		prev
																			.modules
																			.batteries,
																		id
																	)
															}
														}))
													}
												/>
											)
										})}
									</div>
								)}

								{state.modules.batteries.includes(
									'reranker'
								) && (
									<div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
										<div className="flex items-start gap-3">
											<div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
												<Sparkles className="w-4 h-4 text-amber-400" />
											</div>
											<div>
												<div className="font-medium text-amber-400/90">
													Environment variable
													required
												</div>
												<div className="mt-1 text-sm text-amber-400/60">
													Set{' '}
													<code className="font-mono text-amber-400/80">
														COHERE_API_KEY
													</code>{' '}
													to enable the reranker (uses
													Cohere rerank-v3.5).
												</div>
											</div>
										</div>
									</div>
								)}
							</div>
						)}

						{currentStepId === 'review' && (
							<div
								className={cn(
									'animate-in fade-in duration-300',
									slideDirection === 'right'
										? 'slide-in-from-right-4'
										: 'slide-in-from-left-4'
								)}
							>
								<SectionHeader
									title="Review & Install"
									description="Review your configuration and generate the install command."
								/>

								<div className="space-y-6">
									<div className="grid grid-cols-2 gap-4">
										<div className="rounded-xl border border-olive-950/10 bg-white/70 p-4 dark:border-[#757572]/15 dark:bg-olive-800/10">
											<div className="text-xs font-medium uppercase tracking-wider text-olive-500 mb-2">
												Database
											</div>
											<div className="text-lg font-medium text-olive-950 dark:text-olive-100">
												{summary.adapter}
											</div>
										</div>
										<div className="rounded-xl border border-olive-950/10 bg-white/70 p-4 dark:border-[#757572]/15 dark:bg-olive-800/10">
											<div className="text-xs font-medium uppercase tracking-wider text-olive-500 mb-2">
												Embeddings
											</div>
											<div className="text-lg font-medium text-olive-950 capitalize dark:text-olive-100">
												{summary.embeddingType}
											</div>
											<div className="mt-1 text-xs text-olive-600 dark:text-olive-400">
												{summary.embeddingProvider}
											</div>
										</div>
										<div className="rounded-xl border border-olive-950/10 bg-white/70 p-4 dark:border-[#757572]/15 dark:bg-olive-800/10">
											<div className="text-xs font-medium uppercase tracking-wider text-olive-500 mb-2">
												Extractors
											</div>
											<div className="text-lg font-medium text-olive-950 dark:text-olive-100">
												{summary.extractorCount}{' '}
												selected
											</div>
										</div>
										<div className="rounded-xl border border-olive-950/10 bg-white/70 p-4 dark:border-[#757572]/15 dark:bg-olive-800/10">
											<div className="text-xs font-medium uppercase tracking-wider text-olive-500 mb-2">
												Connectors
											</div>
											<div className="text-lg font-medium text-olive-950 dark:text-olive-100">
												{summary.connectorCount}{' '}
												selected
											</div>
										</div>
										{summary.batteryCount > 0 && (
											<div className="rounded-xl border border-olive-950/10 bg-white/70 p-4 col-span-2 dark:border-[#757572]/15 dark:bg-olive-800/10">
												<div className="text-xs font-medium uppercase tracking-wider text-olive-500 mb-2">
													Batteries
												</div>
												<div className="text-lg font-medium text-olive-950 dark:text-olive-100">
													{summary.batteryCount}{' '}
													selected
												</div>
												<div className="mt-1 text-xs text-olive-600 dark:text-olive-400">
													{state.modules.batteries.join(
														', '
													)}
												</div>
											</div>
										)}
									</div>

									<div className="rounded-xl border border-olive-950/10 bg-white/70 overflow-hidden dark:border-[#757572]/15 dark:bg-lemon-950/80">
										<div className="flex items-center justify-between px-4 py-2.5 border-b border-olive-950/10 bg-olive-950/[0.03] dark:border-[#757572]/20 dark:bg-olive-800/10">
											<div className="flex items-center gap-2">
												<span className="text-xs font-medium text-olive-700 dark:text-olive-400">
													Install Command
												</span>
												<div className="w-px h-4 bg-olive-950/10 dark:bg-olive-700/30" />
												<div className="flex items-center gap-1.5">
													{(
														[
															'bun',
															'pnpm',
															'npm',
															'yarn'
														] as const
													).map((pm) => (
														<button
															key={pm}
															type="button"
															onClick={() =>
																setPkgManager(
																	pm
																)
															}
															className={cn(
																'px-2 py-1 text-xs font-medium rounded-md transition-colors',
																pkgManager ===
																	pm
																	? 'bg-olive-950 text-lemon-50 dark:bg-olive-600/30 dark:text-white'
																	: 'text-olive-700 hover:text-olive-950 hover:bg-olive-950/[0.03] dark:text-olive-400 dark:hover:text-olive-200 dark:hover:bg-olive-700/20'
															)}
														>
															{pm}
														</button>
													))}
												</div>
											</div>
											<PlainButton
												size="md"
												onClick={() =>
													handleCopy('command')
												}
												disabled={!installCommand}
												className="disabled:opacity-30"
											>
												<Copy className="w-3.5 h-3.5" />
												{copied === 'command'
													? 'Copied!'
													: 'Copy'}
											</PlainButton>
										</div>
										<div className="p-4">
											{installCommand ? (
												<code className="block font-mono text-sm text-lime-700 break-all dark:text-lime-400">
													{installCommand}
												</code>
											) : (
												<div className="text-sm text-olive-700 leading-relaxed dark:text-olive-400">
													Create a preset to generate
													the installation command.
													This keeps the command fully
													deterministic and includes
													all configuration.
												</div>
											)}
										</div>
									</div>

									<div className="flex items-center gap-3">
										{!presetId && (
											<Button
												onClick={handleCreatePreset}
												disabled={creatingPreset}
												size="lg"
											>
												{creatingPreset ? (
													<>
														<RefreshCw className="w-4 h-4 animate-spin" />
														Creating...
													</>
												) : (
													<>
														<Zap className="w-4 h-4" />
														Create Preset
													</>
												)}
											</Button>
										)}
										<PlainButton
											size="lg"
											onClick={() => handleCopy('url')}
										>
											<Share2 className="w-4 h-4" />
											{copied === 'url'
												? 'Copied!'
												: 'Share URL'}
										</PlainButton>
									</div>

									{presetId && (
										<div className="rounded-xl border border-olive-950/15 bg-white/70 p-5 shadow-[0_0_24px_-6px_rgba(200,200,150,0.08)] dark:border-[#757572]/30 dark:bg-olive-800/15">
											<div className="flex items-start gap-4">
												<div className="w-10 h-10 rounded-lg bg-olive-950/[0.05] border border-olive-950/15 flex items-center justify-center shrink-0 dark:bg-olive-600/20 dark:border-[#757572]/30">
													<Check className="w-5 h-5 text-olive-800 dark:text-olive-300" />
												</div>
												<div className="flex-1 min-w-0">
													<div className="font-display text-xl font-normal text-olive-950 dark:text-olive-100">
														Preset created
													</div>
													<div className="mt-1 text-sm text-olive-700 dark:text-olive-400">
														Your configuration is
														saved as preset{' '}
														<code className="px-1.5 py-0.5 rounded bg-olive-950/[0.04] font-mono text-olive-800 dark:bg-olive-700/30 dark:text-olive-200">
															{presetId}
														</code>
														. The command above
														includes this preset ID.
													</div>
													{installCommand ? (
														<div className="mt-4">
															<SoftButton
																size="lg"
																onClick={() =>
																	setNextStepsOpen(
																		true
																	)
																}
															>
																Open next steps
																<ChevronRight className="w-4 h-4" />
															</SoftButton>
														</div>
													) : null}
												</div>
											</div>
										</div>
									)}
								</div>
							</div>
						)}

						<div className="flex items-center justify-between mt-12 pt-6 border-t border-olive-950/10 dark:border-[#757572]/20">
							<PlainButton
								size="lg"
								onClick={() => goToStep(currentStep - 1)}
								disabled={currentStep === 0}
								className={cn(
									'disabled:opacity-30',
									currentStep === 0 && 'invisible'
								)}
							>
								<ArrowLeft className="w-4 h-4" />
								Previous
							</PlainButton>
							<div className="flex items-center gap-1.5">
								{STEPS.map((_, index) => (
									<button
										key={index}
										onClick={() => goToStep(index)}
										className={cn(
											'w-2 h-2 rounded-full transition-all',
											index === currentStep
												? 'bg-olive-300 w-6'
												: index < currentStep
													? 'bg-olive-400/50 hover:bg-olive-400/70'
													: 'bg-olive-700/50 hover:bg-olive-600/50'
										)}
									/>
								))}
							</div>
							<Button
								onClick={() => goToStep(currentStep + 1)}
								className={cn(
									currentStep === STEPS.length - 1 &&
										'invisible'
								)}
								size="lg"
							>
								Next
								<ChevronRight className="w-4 h-4" />
							</Button>
						</div>
					</div>
				</main>

				<aside className="w-96 shrink-0 border-l border-olive-950/10 p-6 hidden xl:block dark:border-[#757572]/20">
					<div className="sticky top-20">
						<div className="text-xs font-medium uppercase tracking-wider text-olive-500 mb-4">
							Live Preview
						</div>

						<div className="space-y-3 mb-6">
							<div className="flex items-center justify-between text-sm">
								<span className="text-olive-400">
									Directory
								</span>
								<span className="font-mono text-olive-800 dark:text-olive-200">
									{state.install.installDir}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-olive-400">Adapter</span>
								<span className="text-olive-800 dark:text-olive-200">
									{state.install.storeAdapter}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-olive-400">
									Embedding
								</span>
								<span className="text-olive-800 capitalize dark:text-olive-200">
									{state.embedding.type}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-olive-400">
									Extractors
								</span>
								<span className="text-olive-800 dark:text-olive-200">
									{state.modules.extractors.length}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-olive-400">
									Connectors
								</span>
								<span className="text-olive-800 dark:text-olive-200">
									{state.modules.connectors.length}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-olive-400">
									Batteries
								</span>
								<span className="text-olive-800 dark:text-olive-200">
									{state.modules.batteries.length}
								</span>
							</div>
						</div>

						<div className="rounded-xl border border-olive-950/10 bg-white/70 overflow-hidden dark:border-[#757572]/15 dark:bg-lemon-950/80">
							<div className="flex items-center justify-between px-3 py-2.5 border-b border-olive-950/10 bg-olive-950/[0.03] dark:border-[#757572]/20 dark:bg-olive-800/10">
								<div className="flex items-center gap-1.5">
									{(
										['bun', 'pnpm', 'npm', 'yarn'] as const
									).map((pm) => (
										<button
											key={pm}
											type="button"
											onClick={() => setPkgManager(pm)}
											className={cn(
												'px-2 py-1 text-xs font-medium rounded-md transition-colors',
												pkgManager === pm
													? 'bg-olive-950 text-lemon-50 dark:bg-olive-600/30 dark:text-white'
													: 'text-olive-700 hover:text-olive-950 hover:bg-olive-950/[0.03] dark:text-olive-400 dark:hover:text-olive-200 dark:hover:bg-olive-700/20'
											)}
										>
											{pm}
										</button>
									))}
								</div>
								<button
									type="button"
									onClick={() => handleCopy('command')}
									disabled={!installCommand}
									className={cn(
										'inline-flex items-center gap-2 px-2 py-1 rounded-md transition-colors',
										installCommand
											? 'text-olive-700 hover:text-olive-950 hover:bg-olive-950/[0.03] dark:text-white/55 dark:hover:text-white dark:hover:bg-white/[0.04]'
											: 'text-olive-400 cursor-not-allowed dark:text-white/25'
									)}
								>
									<Copy className="w-4 h-4" />
									<span className="text-xs font-medium">
										{copied === 'command'
											? 'Copied'
											: 'Copy'}
									</span>
								</button>
							</div>
							<div className="p-3">
								{installCommand ? (
									<div className="space-y-3">
										<code className="block font-mono text-xs text-lime-700 break-all leading-relaxed dark:text-lime-400">
											{installCommand}
										</code>
										<SoftButton
											size="md"
											onClick={() =>
												setNextStepsOpen(true)
											}
											className="w-full"
										>
											Next steps
											<ChevronRight className="w-4 h-4" />
										</SoftButton>
									</div>
								) : (
									<div className="space-y-2">
										<div className="text-xs text-olive-700 leading-relaxed dark:text-white/45">
											Create a preset to generate the
											installation command. Creating a
											preset saves the config so you can
											come back to it later.
										</div>
										<Button
											size="md"
											disabled={creatingPreset}
											onClick={handleCreatePreset}
											className="w-full"
										>
											{creatingPreset
												? 'Creating…'
												: 'Create preset'}
										</Button>
									</div>
								)}
							</div>
						</div>

						{(state.modules.extractors.length > 0 ||
							state.modules.connectors.length > 0 ||
							state.modules.batteries.length > 0) && (
							<div className="mt-6 pt-6 border-t border-olive-950/10 dark:border-[#757572]/20">
								{state.modules.extractors.length > 0 && (
									<div className="mb-4">
										<div className="text-xs text-olive-500 mb-2">
											Extractors
										</div>
										<div className="flex flex-wrap gap-1.5">
											{state.modules.extractors.map(
												(id) => {
													const href =
														extractorDocsById.get(
															id
														) ?? '/docs/extractors'
													return (
														<Link
															key={id}
															href={href}
															target="_blank"
															rel="noreferrer"
															className="text-xs px-2 py-1 rounded bg-olive-950/[0.04] text-olive-800 font-mono transition-colors hover:bg-olive-950/[0.06] hover:text-olive-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-500/30 dark:bg-olive-700/20 dark:text-olive-300 dark:hover:bg-olive-600/30 dark:hover:text-olive-200"
															title="Open docs"
															aria-label={`Open docs for ${id}`}
														>
															{id
																.split('-')
																.join(':')}
														</Link>
													)
												}
											)}
										</div>
									</div>
								)}
								{state.modules.connectors.length > 0 && (
									<div className="mb-4">
										<div className="text-xs text-olive-500 mb-2">
											Connectors
										</div>
										<div className="flex flex-wrap gap-1.5">
											{state.modules.connectors.map(
												(id) => {
													const href =
														connectorDocsById.get(
															id
														) ?? '/docs/connectors'
													return (
														<Link
															key={id}
															href={href}
															target="_blank"
															rel="noreferrer"
															className="text-xs px-2 py-1 rounded bg-olive-950/[0.04] text-olive-800 font-mono capitalize transition-colors hover:bg-olive-950/[0.06] hover:text-olive-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-500/30 dark:bg-olive-700/20 dark:text-olive-300 dark:hover:bg-olive-600/30 dark:hover:text-olive-200"
															title="Open docs"
															aria-label={`Open docs for ${id}`}
														>
															{id
																.split('-')
																.join(' ')}
														</Link>
													)
												}
											)}
										</div>
									</div>
								)}
								{state.modules.batteries.length > 0 && (
									<div>
										<div className="text-xs text-olive-500 mb-2">
											Batteries
										</div>
										<div className="flex flex-wrap gap-1.5">
											{state.modules.batteries.map(
												(id) => (
													<span
														key={id}
														className="text-xs px-2 py-1 rounded bg-olive-950/[0.04] text-olive-800 font-mono capitalize border border-olive-950/10 dark:bg-olive-600/20 dark:text-olive-300 dark:border-[#757572]/25"
													>
														{id}
													</span>
												)
											)}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</aside>
			</div>
		</div>
	)
}
