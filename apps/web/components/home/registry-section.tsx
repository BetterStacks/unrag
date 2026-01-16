'use client'

import {ArrowSquareOut} from '@phosphor-icons/react'
import {
	AmazonWebServicesDark,
	CloudflareWorkers,
	Cohere,
	Discord,
	Dropbox,
	Gemini,
	GitHubDark,
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
	OpenAIDark,
	OpenRouterDark,
	PerplexityAI,
	Slack,
	TogetherAIDark,
	VercelDark,
	XAIDark
} from '@ridemountainpig/svgl-react'
import {
	type ColumnFiltersState,
	type FilterFn,
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable
} from '@tanstack/react-table'
import {clsx} from 'clsx/lite'
import Link from 'next/link'
import {
	type ComponentProps,
	type ComponentType,
	type SVGProps,
	useEffect,
	useMemo,
	useState
} from 'react'
import {CopyButton} from '../copy-button'

// ─────────────────────────────────────────────────────────────────────────────
// Shared Element Components (matching landing page styles)
// ─────────────────────────────────────────────────────────────────────────────

function Container({children, className, ...props}: ComponentProps<'div'>) {
	return (
		<div
			className={clsx(
				'mx-auto w-full max-w-2xl px-6 md:max-w-3xl lg:max-w-7xl lg:px-10',
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

function Eyebrow({children, className, ...props}: ComponentProps<'div'>) {
	return (
		<div
			className={clsx(
				'text-sm/7 font-semibold text-olive-700 dark:text-olive-400',
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

function Subheading({children, className, ...props}: ComponentProps<'h2'>) {
	return (
		<h2
			className={clsx(
				'font-display text-[2rem]/10 tracking-tight text-pretty text-olive-950 sm:text-5xl/14 dark:text-white',
				className
			)}
			{...props}
		>
			{children}
		</h2>
	)
}

function Text({children, className, ...props}: ComponentProps<'div'>) {
	return (
		<div
			className={clsx(
				'text-base/7 text-olive-700 dark:text-olive-400',
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

const buttonSizes = {
	md: 'px-3 py-1',
	lg: 'px-4 py-2'
}

function ButtonLink({
	size = 'md',
	className,
	href,
	children,
	...props
}: {
	href: string
	size?: keyof typeof buttonSizes
} & Omit<ComponentProps<'a'>, 'href'>) {
	return (
		<a
			href={href}
			className={clsx(
				'inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm/7 font-medium',
				'bg-olive-950 text-white hover:bg-olive-800 dark:bg-olive-300 dark:text-olive-950 dark:hover:bg-olive-200',
				buttonSizes[size],
				className
			)}
			{...props}
		>
			{children}
		</a>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Extractor = {
	name: string
	fileTypes: string[]
	inputMode: string[]
	output: string
	configComplexity: 'zero-config' | 'needs-dep' | 'needs-api-key' | 'advanced'
	installCmd: string
	docUrl?: string
}

type Connector = {
	id: string
	displayName: string
	types: string[]
	description: string
	installCmd?: string
	status: 'available' | 'coming-soon'
	logo: ComponentType<SVGProps<SVGSVGElement>>
	docUrl?: string
}

type Provider = {
	name: string
	status: 'available' | 'coming-soon'
	description?: string
	logo: ComponentType<SVGProps<SVGSVGElement>>
	installCmd?: string
	docUrl?: string
}

const VoyageLogo = (props: SVGProps<SVGSVGElement>) => (
	<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
		<path
			d="M4.5 6h3.2L12 15.2 16.3 6h3.2L13.3 19h-2.6L4.5 6z"
			fill="currentColor"
		/>
	</svg>
)

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

type RegistryManifest = {
	version: number
	extractors: Array<{
		id: string
		extractorName?: string
		fileTypes?: string[]
		inputModes?: string[]
		output?: string
		configComplexity?: Extractor['configComplexity']
		docsPath?: string | null
	}>
	connectors: Array<{
		id: string
		displayName: string
		types?: string[]
		description?: string
		status?: Connector['status']
		docsPath?: string | null
	}>
}

const connectorLogoById: Record<
	string,
	ComponentType<SVGProps<SVGSVGElement>>
> = {
	notion: Notion,
	'google-drive': GoogleDrive,
	github: GitHubDark,
	gitlab: GitLab,
	slack: Slack,
	discord: Discord,
	linear: Linear,
	dropbox: Dropbox,
	onedrive: MicrosoftOneDrive,
	teams: MicrosoftTeams,
	sharepoint: MicrosoftSharePoint
}

const providers: Provider[] = [
	{
		name: 'Vercel AI Gateway',
		status: 'available',
		description: 'Unified gateway for LLM and embedding providers.',
		logo: VercelDark,
		installCmd: 'bun add ai',
		docUrl: '/docs/providers/ai-gateway'
	},
	{
		name: 'Voyage',
		status: 'available',
		description: 'Multimodal embeddings via Voyage AI.',
		logo: VoyageLogo,
		installCmd: 'bun add voyage-ai-provider',
		docUrl: '/docs/providers/voyage'
	},
	{
		name: 'OpenAI',
		status: 'available',
		description: 'Embeddings + LLM calls via OpenAI models.',
		logo: OpenAIDark,
		installCmd: 'bun add @ai-sdk/openai',
		docUrl: '/docs/providers/openai'
	},
	{
		name: 'Google Gemini',
		status: 'available',
		description: 'Embeddings + LLM calls via Gemini.',
		logo: Gemini,
		installCmd: 'bun add @ai-sdk/google',
		docUrl: '/docs/providers/google'
	},
	{
		name: 'OpenRouter',
		status: 'available',
		description:
			'Unified API for multiple LLM providers and model routing.',
		logo: OpenRouterDark,
		installCmd: 'bun add @openrouter/sdk',
		docUrl: '/docs/providers/openrouter'
	},
	{
		name: 'Azure OpenAI',
		status: 'available',
		description: 'Use OpenAI models through Azure deployments.',
		logo: MicrosoftAzure,
		installCmd: 'bun add @ai-sdk/azure',
		docUrl: '/docs/providers/azure'
	},
	{
		name: 'AWS Bedrock',
		status: 'available',
		description: 'Enterprise LLM + embedding access via Bedrock.',
		logo: AmazonWebServicesDark,
		installCmd: 'bun add @ai-sdk/amazon-bedrock',
		docUrl: '/docs/providers/bedrock'
	},
	{
		name: 'Google Vertex AI',
		status: 'available',
		description:
			'Enterprise access to Gemini + embeddings via Google Cloud Vertex AI.',
		logo: GoogleCloud,
		installCmd: 'bun add @ai-sdk/google-vertex',
		docUrl: '/docs/providers/vertex'
	},
	{
		name: 'Ollama',
		status: 'available',
		description: 'Local models for dev and private deployments.',
		logo: OllamaDark,
		installCmd: 'bun add ollama-ai-provider-v2',
		docUrl: '/docs/providers/ollama'
	},
	{
		name: 'Mistral',
		status: 'available',
		description: 'Fast LLM calls via Mistral models.',
		logo: MistralAI,
		installCmd: 'bun add @ai-sdk/mistral',
		docUrl: '/docs/providers/mistral'
	},
	{
		name: 'Together AI',
		status: 'available',
		description: 'Broad model catalog for LLM calls and embeddings.',
		logo: TogetherAIDark,
		installCmd: 'bun add @ai-sdk/togetherai',
		docUrl: '/docs/providers/together'
	},
	{
		name: 'Cohere',
		status: 'available',
		description: 'Embeddings and rerankers for retrieval.',
		logo: Cohere,
		installCmd: 'bun add @ai-sdk/cohere',
		docUrl: '/docs/providers/cohere'
	},
	{
		name: 'Cloudflare Workers AI',
		status: 'coming-soon',
		description: 'Edge inference for embeddings and LLM calls.',
		logo: CloudflareWorkers
	},
	{
		name: 'Perplexity',
		status: 'coming-soon',
		description: 'LLM calls with web-enabled models (where applicable).',
		logo: PerplexityAI
	},
	{
		name: 'xAI',
		status: 'coming-soon',
		description: 'LLM calls via Grok models.',
		logo: XAIDark
	}
]

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

function toSearchableText(
	value: unknown,
	{withDotPrefixes}: {withDotPrefixes?: boolean} = {}
) {
	if (value === null || value === undefined) {
		return ''
	}

	if (Array.isArray(value)) {
		const parts = value
			.flatMap((v) => {
				if (v === null || v === undefined) {
					return []
				}
				const s = String(v)
				if (!s) {
					return []
				}
				return withDotPrefixes
					? [s, s.startsWith('.') ? s : `.${s}`]
					: [s]
			})
			.filter(Boolean)
		return parts.join(' ')
	}

	if (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		const s = String(value)
		if (!withDotPrefixes) {
			return s
		}
		return [s, s.startsWith('.') ? s : `.${s}`].join(' ')
	}

	try {
		return JSON.stringify(value)
	} catch {
		return String(value)
	}
}

function normalizeSearchTerms(filterValue: unknown) {
	const rawSearch = String(filterValue ?? '')
		.trim()
		.toLowerCase()
	if (!rawSearch) {
		return []
	}
	return rawSearch.split(/\s+/).filter(Boolean)
}

const extractorGlobalFilter: FilterFn<Extractor> = (
	row,
	_columnId,
	filterValue
) => {
	const terms = normalizeSearchTerms(filterValue)
	if (terms.length === 0) {
		return true
	}

	const e = row.original
	const haystack = [
		e.name,
		toSearchableText(e.fileTypes, {withDotPrefixes: true}),
		toSearchableText(e.inputMode),
		e.output,
		e.configComplexity
	]
		.join(' ')
		.toLowerCase()
		.trim()

	return terms.every((t) => haystack.includes(t))
}

const connectorGlobalFilter: FilterFn<Connector> = (
	row,
	_columnId,
	filterValue
) => {
	const terms = normalizeSearchTerms(filterValue)
	if (terms.length === 0) {
		return true
	}

	const c = row.original
	const haystack = [
		c.id,
		c.displayName,
		toSearchableText(c.types),
		c.status,
		c.description
	]
		.join(' ')
		.toLowerCase()
		.trim()

	return terms.every((t) => haystack.includes(t))
}

const providerGlobalFilter: FilterFn<Provider> = (
	row,
	_columnId,
	filterValue
) => {
	const terms = normalizeSearchTerms(filterValue)
	if (terms.length === 0) {
		return true
	}

	const p = row.original
	const haystack = [p.name, p.status, p.description ?? '']
		.join(' ')
		.toLowerCase()
		.trim()

	return terms.every((t) => haystack.includes(t))
}

function ConfigBadge({
	complexity
}: {complexity: Extractor['configComplexity']}) {
	const config: Record<typeof complexity, {label: string; color: string}> = {
		'zero-config': {
			label: 'Zero config',
			color: 'bg-olive-500/15 text-olive-700 border-olive-500/25 dark:bg-olive-400/15 dark:text-olive-300 dark:border-olive-400/25'
		},
		'needs-dep': {
			label: 'Needs dep',
			color: 'bg-olive-600/10 text-olive-600 border-olive-600/20 dark:bg-olive-500/10 dark:text-olive-400 dark:border-olive-500/20'
		},
		'needs-api-key': {
			label: 'API key',
			color: 'bg-olive-700/10 text-olive-700 border-olive-700/15 dark:bg-olive-500/10 dark:text-olive-400 dark:border-olive-500/15'
		},
		advanced: {
			label: 'Advanced',
			color: 'bg-olive-800/10 text-olive-800 border-olive-800/15 dark:bg-olive-600/10 dark:text-olive-500 dark:border-olive-600/15'
		}
	}

	const {label, color} = config[complexity]

	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border ${color}`}
		>
			{label}
		</span>
	)
}

function FileTypeBadge({type}: {type: string}) {
	return (
		<span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-olive-950/5 text-olive-700 border border-olive-950/10 dark:bg-white/5 dark:text-olive-400 dark:border-white/10">
			.{type}
		</span>
	)
}

function InputModeBadge({mode}: {mode: string}) {
	return (
		<span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-olive-950/5 text-olive-600 dark:bg-white/5 dark:text-olive-500">
			{mode}
		</span>
	)
}

function RowActions({
	copyText,
	docHref,
	docLabel
}: {copyText?: string; docHref?: string; docLabel?: string}) {
	if (!copyText && !docHref) {
		return null
	}

	return (
		<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
			{copyText ? <CopyButton text={copyText} /> : null}
			{docHref ? (
				<DocsLinkButton href={docHref} label={docLabel} />
			) : null}
		</div>
	)
}

function DocsLinkButton({href, label}: {href: string; label?: string}) {
	return (
		<Link
			href={href}
			target="_blank"
			rel="noreferrer"
			className="p-1.5 rounded hover:bg-olive-950/10 dark:hover:bg-white/10 transition-colors text-olive-600 hover:text-olive-950 dark:text-olive-400 dark:hover:text-white"
			aria-label={label ?? 'View documentation'}
		>
			<ArrowSquareOut size={16} weight="regular" />
		</Link>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Extractors Table
// ─────────────────────────────────────────────────────────────────────────────

const extractorColumnHelper = createColumnHelper<Extractor>()

const extractorColumns = [
	extractorColumnHelper.accessor('name', {
		header: 'Extractor',
		cell: (info) => (
			<div className="flex items-center gap-3">
				<span className="font-mono text-sm text-olive-950 dark:text-white">
					{info.getValue()}
				</span>
				<RowActions
					copyText={info.row.original.installCmd}
					docHref={info.row.original.docUrl}
					docLabel={`${info.getValue()} docs`}
				/>
			</div>
		)
	}),
	extractorColumnHelper.accessor('fileTypes', {
		header: 'File Types',
		cell: (info) => (
			<div className="flex flex-wrap gap-1">
				{info.getValue().map((type) => (
					<FileTypeBadge key={type} type={type} />
				))}
			</div>
		),
		filterFn: (row, columnId, filterValue) => {
			if (!filterValue) {
				return true
			}
			const fileTypes = row.getValue(columnId) as string[]
			return fileTypes.some((type) => type === filterValue)
		}
	}),
	extractorColumnHelper.accessor('inputMode', {
		header: 'Input Mode',
		cell: (info) => (
			<div className="flex flex-wrap gap-1">
				{info.getValue().map((mode) => (
					<InputModeBadge key={mode} mode={mode} />
				))}
			</div>
		)
	}),
	extractorColumnHelper.accessor('output', {
		header: 'Output',
		cell: (info) => (
			<span className="text-sm text-olive-700 dark:text-olive-400">
				{info.getValue()}
			</span>
		)
	}),
	extractorColumnHelper.accessor('configComplexity', {
		header: 'Config',
		cell: (info) => <ConfigBadge complexity={info.getValue()} />
	})
]

function ExtractorsTable({data}: {data: Extractor[]}) {
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [globalFilter, setGlobalFilter] = useState('')

	const table = useReactTable({
		data,
		columns: extractorColumns,
		state: {columnFilters, globalFilter},
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		globalFilterFn: extractorGlobalFilter,
		getColumnCanGlobalFilter: (column) => column.id === 'name'
	})

	const allFileTypes = useMemo(() => {
		const types = new Set<string>()
		for (const e of data) {
			for (const t of e.fileTypes) {
				types.add(t)
			}
		}
		return Array.from(types).sort()
	}, [data])

	const currentFileTypeFilter = columnFilters.find(
		(f) => f.id === 'fileTypes'
	)?.value as string | undefined

	return (
		<div className="space-y-4">
			{/* Filters */}
			<div className="flex flex-col sm:flex-row gap-3">
				<div className="relative flex-1">
					<svg
						className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-olive-500 dark:text-olive-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<title>Search</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						placeholder="Search extractors..."
						value={globalFilter}
						onChange={(e) => setGlobalFilter(e.target.value)}
						className="w-full pl-10 pr-4 py-2.5 bg-olive-950/[0.03] border border-olive-950/10 rounded-lg text-sm text-olive-950 placeholder:text-olive-500 focus:outline-none focus:border-olive-950/20 focus:bg-olive-950/[0.05] transition-colors dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder:text-olive-500 dark:focus:border-white/20 dark:focus:bg-white/[0.05]"
					/>
				</div>
				<select
					value={currentFileTypeFilter || ''}
					onChange={(e) => {
						const value = e.target.value
						setColumnFilters(
							value ? [{id: 'fileTypes', value}] : []
						)
					}}
					className="px-4 py-2.5 bg-olive-950/[0.03] border border-olive-950/10 rounded-lg text-sm text-olive-950 focus:outline-none focus:border-olive-950/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_8px_center] bg-no-repeat pr-10 dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:focus:border-white/20 dark:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.5)%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]"
				>
					<option value="">All file types</option>
					{allFileTypes.map((type) => (
						<option key={type} value={type}>
							.{type}
						</option>
					))}
				</select>
			</div>

			{/* Table */}
			<div className="border border-olive-950/10 rounded-xl overflow-hidden dark:border-white/10">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							{table.getHeaderGroups().map((headerGroup) => (
								<tr
									key={headerGroup.id}
									className="border-b border-olive-950/10 bg-olive-950/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
								>
									{headerGroup.headers.map((header) => (
										<th
											key={header.id}
											className="px-4 py-3 text-left text-xs font-medium text-olive-600 uppercase tracking-wider dark:text-olive-500"
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef
															.header,
														header.getContext()
													)}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody className="divide-y divide-olive-950/[0.05] dark:divide-white/[0.05]">
							{table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className="group hover:bg-olive-950/[0.02] transition-colors dark:hover:bg-white/[0.02]"
								>
									{row.getVisibleCells().map((cell) => (
										<td
											key={cell.id}
											className="px-4 py-3.5"
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Row count */}
			<div className="text-xs text-olive-600 text-right dark:text-olive-500">
				{table.getFilteredRowModel().rows.length} of {data.length}{' '}
				extractors
			</div>
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Connectors Table
// ─────────────────────────────────────────────────────────────────────────────

const connectorColumnHelper = createColumnHelper<Connector>()

const connectorColumns = [
	connectorColumnHelper.accessor('displayName', {
		header: 'Connector',
		cell: (info) => (
			<div className="flex items-center gap-3">
				<div className="w-8 h-8 rounded-lg bg-olive-950/5 border border-olive-950/10 flex items-center justify-center dark:bg-white/5 dark:border-white/10">
					<info.row.original.logo
						width={16}
						height={16}
						className="text-olive-800 dark:text-white/90"
						aria-label={info.row.original.displayName}
					/>
				</div>
				<span className="font-mono text-sm text-olive-950 dark:text-white">
					{info.getValue()}
				</span>
				<RowActions
					copyText={info.row.original.installCmd}
					docHref={
						info.row.original.status === 'available'
							? info.row.original.docUrl
							: undefined
					}
					docLabel={`${info.getValue()} docs`}
				/>
			</div>
		)
	}),
	connectorColumnHelper.accessor('types', {
		header: 'Types',
		cell: (info) => (
			<div className="flex flex-wrap gap-1">
				{(info.getValue() as string[]).map((type) => (
					<InputModeBadge key={type} mode={type} />
				))}
			</div>
		),
		filterFn: (row, columnId, filterValue) => {
			if (!filterValue) {
				return true
			}
			const types = row.getValue(columnId) as string[]
			return types.some((t) => t === filterValue)
		}
	}),
	connectorColumnHelper.accessor('status', {
		header: 'Status',
		cell: (info) => {
			const status = info.getValue()
			if (status === 'available') {
				return (
					<span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border bg-olive-500/15 text-olive-700 border-olive-500/25 dark:bg-olive-400/15 dark:text-olive-300 dark:border-olive-400/25">
						Available
					</span>
				)
			}
			return (
				<span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border bg-olive-950/5 text-olive-600 border-olive-950/10 dark:bg-white/5 dark:text-olive-500 dark:border-white/10">
					Coming soon
				</span>
			)
		}
	}),
	connectorColumnHelper.accessor('description', {
		header: 'Description',
		cell: (info) => (
			<span className="text-sm text-olive-600 dark:text-olive-500">
				{info.getValue()}
			</span>
		)
	})
]

function ConnectorsTable({data}: {data: Connector[]}) {
	const [globalFilter, setGlobalFilter] = useState('')
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const table = useReactTable({
		data,
		columns: connectorColumns,
		state: {globalFilter, columnFilters},
		onGlobalFilterChange: setGlobalFilter,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		globalFilterFn: connectorGlobalFilter,
		getColumnCanGlobalFilter: (column) => column.id === 'displayName'
	})

	const allConnectorTypes = useMemo(() => {
		const types = new Set<string>()
		for (const c of data) {
			for (const t of c.types) {
				types.add(t)
			}
		}
		return Array.from(types).sort()
	}, [data])

	const currentTypeFilter = columnFilters.find((f) => f.id === 'types')
		?.value as string | undefined

	return (
		<div className="space-y-4">
			{/* Search + Type filter */}
			<div className="flex flex-col sm:flex-row gap-3">
				<div className="relative flex-1">
					<svg
						className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-olive-500 dark:text-olive-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<title>Search</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						placeholder="Search connectors..."
						value={globalFilter}
						onChange={(e) => setGlobalFilter(e.target.value)}
						className="w-full pl-10 pr-4 py-2.5 bg-olive-950/[0.03] border border-olive-950/10 rounded-lg text-sm text-olive-950 placeholder:text-olive-500 focus:outline-none focus:border-olive-950/20 focus:bg-olive-950/[0.05] transition-colors dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder:text-olive-500 dark:focus:border-white/20 dark:focus:bg-white/[0.05]"
					/>
				</div>
				<select
					value={currentTypeFilter || ''}
					onChange={(e) => {
						const value = e.target.value
						setColumnFilters(value ? [{id: 'types', value}] : [])
					}}
					className="px-4 py-2.5 bg-olive-950/[0.03] border border-olive-950/10 rounded-lg text-sm text-olive-950 focus:outline-none focus:border-olive-950/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(0%2C0%2C0%2C0.4)%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_8px_center] bg-no-repeat pr-10 dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:focus:border-white/20 dark:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.5)%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]"
				>
					<option value="">All types</option>
					{allConnectorTypes.map((type) => (
						<option key={type} value={type}>
							{type}
						</option>
					))}
				</select>
			</div>

			{/* Table */}
			<div className="border border-olive-950/10 rounded-xl overflow-hidden dark:border-white/10">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							{table.getHeaderGroups().map((headerGroup) => (
								<tr
									key={headerGroup.id}
									className="border-b border-olive-950/10 bg-olive-950/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
								>
									{headerGroup.headers.map((header) => (
										<th
											key={header.id}
											className="px-4 py-3 text-left text-xs font-medium text-olive-600 uppercase tracking-wider dark:text-olive-500"
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef
															.header,
														header.getContext()
													)}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody className="divide-y divide-olive-950/[0.05] dark:divide-white/[0.05]">
							{table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className="group hover:bg-olive-950/[0.02] transition-colors dark:hover:bg-white/[0.02]"
								>
									{row.getVisibleCells().map((cell) => (
										<td
											key={cell.id}
											className="px-4 py-3.5"
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Row count */}
			<div className="text-xs text-olive-600 text-right dark:text-olive-500">
				{table.getFilteredRowModel().rows.length} of {data.length}{' '}
				connectors
			</div>
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Providers Tab
// ─────────────────────────────────────────────────────────────────────────────

const providerColumnHelper = createColumnHelper<Provider>()

const providerColumns = [
	providerColumnHelper.accessor('name', {
		header: 'Provider',
		cell: (info) => (
			<div className="flex items-center gap-3">
				<div className="w-8 h-8 rounded-lg bg-olive-950/5 border border-olive-950/10 flex items-center justify-center dark:bg-white/5 dark:border-white/10">
					<info.row.original.logo
						width={16}
						height={16}
						className="text-olive-800 dark:text-white/90"
						aria-label={info.getValue()}
					/>
				</div>
				<span className="font-mono text-sm text-olive-950 dark:text-white">
					{info.getValue()}
				</span>
				<RowActions
					copyText={info.row.original.installCmd}
					docHref={info.row.original.docUrl}
					docLabel={`${info.getValue()} docs`}
				/>
			</div>
		)
	}),
	providerColumnHelper.accessor('status', {
		header: 'Status',
		cell: (info) => {
			const status = info.getValue()
			if (status === 'available') {
				return (
					<span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border bg-olive-500/15 text-olive-700 border-olive-500/25 dark:bg-olive-400/15 dark:text-olive-300 dark:border-olive-400/25">
						Available
					</span>
				)
			}
			return (
				<span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border bg-olive-950/5 text-olive-600 border-olive-950/10 dark:bg-white/5 dark:text-olive-500 dark:border-white/10">
					Coming soon
				</span>
			)
		}
	}),
	providerColumnHelper.accessor('description', {
		header: 'Description',
		cell: (info) => (
			<span className="text-sm text-olive-600 dark:text-olive-500">
				{info.getValue() ?? ''}
			</span>
		)
	})
]

function ProvidersTab() {
	const [globalFilter, setGlobalFilter] = useState('')
	const table = useReactTable({
		data: providers,
		columns: providerColumns,
		state: {globalFilter},
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		globalFilterFn: providerGlobalFilter,
		getColumnCanGlobalFilter: (column) => column.id === 'name'
	})

	return (
		<div className="space-y-4">
			{/* Search */}
			<div className="flex flex-col sm:flex-row gap-3">
				<div className="relative flex-1">
					<svg
						className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-olive-500 dark:text-olive-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<title>Search</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						placeholder="Search providers..."
						value={globalFilter}
						onChange={(e) => setGlobalFilter(e.target.value)}
						className="w-full pl-10 pr-4 py-2.5 bg-olive-950/[0.03] border border-olive-950/10 rounded-lg text-sm text-olive-950 placeholder:text-olive-500 focus:outline-none focus:border-olive-950/20 focus:bg-olive-950/[0.05] transition-colors dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder:text-olive-500 dark:focus:border-white/20 dark:focus:bg-white/[0.05]"
					/>
				</div>
			</div>

			{/* Table */}
			<div className="border border-olive-950/10 rounded-xl overflow-hidden dark:border-white/10">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							{table.getHeaderGroups().map((headerGroup) => (
								<tr
									key={headerGroup.id}
									className="border-b border-olive-950/10 bg-olive-950/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
								>
									{headerGroup.headers.map((header) => (
										<th
											key={header.id}
											className="px-4 py-3 text-left text-xs font-medium text-olive-600 uppercase tracking-wider dark:text-olive-500"
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef
															.header,
														header.getContext()
													)}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody className="divide-y divide-olive-950/[0.05] dark:divide-white/[0.05]">
							{table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className="group hover:bg-olive-950/[0.02] transition-colors dark:hover:bg-white/[0.02]"
								>
									{row.getVisibleCells().map((cell) => (
										<td
											key={cell.id}
											className="px-4 py-3.5"
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Row count */}
			<div className="text-xs text-olive-600 text-right dark:text-olive-500">
				{table.getFilteredRowModel().rows.length} of {providers.length}{' '}
				providers
			</div>
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'extractors' | 'connectors' | 'providers'

export function RegistrySection() {
	const [activeTab, setActiveTab] = useState<Tab>('extractors')
	const [extractors, setExtractors] = useState<Extractor[]>([])
	const [connectors, setConnectors] = useState<Connector[]>([])

	useEffect(() => {
		let cancelled = false

		async function load() {
			try {
				const res = await fetch('/api/manifest', {cache: 'force-cache'})
				if (!res.ok) {
					return
				}
				const json = (await res.json()) as RegistryManifest

				const nextExtractors: Extractor[] = (json.extractors ?? []).map(
					(ex) => {
						const moduleId = String(ex.id)
						const name = String(ex.extractorName ?? moduleId)
						const fileTypes = Array.isArray(ex.fileTypes)
							? ex.fileTypes.map(String)
							: []
						const inputMode = Array.isArray(ex.inputModes)
							? ex.inputModes.map(String)
							: []
						const output = String(ex.output ?? '')
						const configComplexity =
							(ex.configComplexity as
								| Extractor['configComplexity']
								| undefined) ?? 'advanced'
						const docUrl =
							typeof ex.docsPath === 'string'
								? ex.docsPath
								: undefined

						return {
							name,
							fileTypes,
							inputMode,
							output,
							configComplexity,
							installCmd: `bunx unrag@latest add extractor ${moduleId}`,
							...(docUrl ? {docUrl} : {})
						}
					}
				)

				const nextConnectors: Connector[] = (json.connectors ?? []).map(
					(c) => {
						const id = String(c.id)
						const status: Connector['status'] =
							c.status === 'available'
								? 'available'
								: 'coming-soon'
						const docUrl =
							status === 'available' &&
							typeof c.docsPath === 'string'
								? c.docsPath
								: undefined

						return {
							id,
							displayName: String(c.displayName ?? id),
							types: Array.isArray(c.types)
								? c.types.map(String)
								: [],
							description: String(c.description ?? ''),
							status,
							logo: connectorLogoById[id] ?? GitHubDark,
							...(status === 'available'
								? {installCmd: `bunx unrag@latest add ${id}`}
								: {}),
							...(docUrl ? {docUrl} : {})
						}
					}
				)

				if (cancelled) {
					return
				}
				setExtractors(nextExtractors)
				setConnectors(nextConnectors)
			} catch {
				// ignore
			}
		}

		void load()
		return () => {
			cancelled = true
		}
	}, [])

	const tabs: {id: Tab; label: string; count?: number}[] = [
		{id: 'extractors', label: 'Extractors', count: extractors.length},
		{id: 'connectors', label: 'Connectors', count: connectors.length},
		{id: 'providers', label: 'Providers', count: providers.length}
	]

	const header = (() => {
		if (activeTab === 'extractors') {
			return {
				eyebrow: 'File processing',
				title: 'Extract text from anything',
				description:
					'PDFs, images, audio, video, Office docs — turn any file into searchable, embeddable text with a single line of code.',
				docLink: '/docs/extractors',
				ctaLabel: 'Explore extractors'
			}
		}
		if (activeTab === 'connectors') {
			return {
				eyebrow: 'Data sources',
				title: 'Ingest from where your data lives',
				description:
					'Pull documents straight from Notion, GitHub, Slack, and more. Keep your knowledge base fresh without manual uploads.',
				docLink: '/docs/connectors',
				ctaLabel: 'Explore connectors'
			}
		}
		return {
			eyebrow: 'Model providers',
			title: 'Bring your own model',
			description:
				'Swap embedding and LLM providers without changing your code. OpenAI today, local models tomorrow — your choice.',
			docLink: '/docs/providers',
			ctaLabel: 'Explore providers'
		}
	})()

	return (
		<section className="py-16">
			<Container className="flex flex-col gap-10 sm:gap-16">
				{/* Header */}
				<div className="flex max-w-2xl flex-col gap-6">
					<div className="flex flex-col gap-2">
						<Eyebrow>{header.eyebrow}</Eyebrow>
						<Subheading>{header.title}</Subheading>
					</div>
					<Text className="text-pretty">{header.description}</Text>
					{header.docLink && header.ctaLabel ? (
						<div>
							<ButtonLink href={header.docLink} size="lg">
								<svg
									className="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
									aria-hidden="true"
								>
									<title>Arrow right</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M13 7l5 5m0 0l-5 5m5-5H6"
									/>
								</svg>
								{header.ctaLabel}
							</ButtonLink>
						</div>
					) : null}
				</div>

				<div>
					{/* Tabs */}
					<div className="mb-6 flex items-center gap-1 p-1 bg-olive-950/[0.03] border border-olive-950/10 rounded-xl w-fit dark:bg-white/[0.03] dark:border-white/10">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className={clsx(
									'relative px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200',
									activeTab === tab.id
										? 'text-olive-950 bg-olive-950/10 dark:text-white dark:bg-white/10'
										: 'text-olive-600 hover:text-olive-800 hover:bg-olive-950/[0.03] dark:text-olive-500 dark:hover:text-olive-300 dark:hover:bg-white/[0.03]'
								)}
							>
								{tab.label}
								{tab.count !== undefined && (
									<span
										className={clsx(
											'ml-2 text-xs px-1.5 py-0.5 rounded-full',
											activeTab === tab.id
												? 'bg-olive-950/10 text-olive-700 dark:bg-white/10 dark:text-olive-300'
												: 'bg-olive-950/5 text-olive-500 dark:bg-white/5 dark:text-olive-500'
										)}
									>
										{tab.count}
									</span>
								)}
							</button>
						))}
					</div>

					{/* Tab Content */}
					<div className="min-h-[400px]">
						{activeTab === 'extractors' && (
							<ExtractorsTable data={extractors} />
						)}
						{activeTab === 'connectors' && (
							<ConnectorsTable data={connectors} />
						)}
						{activeTab === 'providers' && <ProvidersTab />}
					</div>
				</div>
			</Container>
		</section>
	)
}
