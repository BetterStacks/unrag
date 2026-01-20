'use client'

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState
} from 'react'
import {theme} from './terminal-theme'
import type {
	IngestChunk,
	IngestDocument,
	IngestInput,
	QueryResult,
	TabId,
	TerminalContextValue,
	TerminalEvent,
	TerminalTrace
} from './terminal-types'

const TerminalContext = createContext<TerminalContextValue | null>(null)

export function useTerminal() {
	const context = useContext(TerminalContext)
	if (!context) {
		throw new Error('useTerminal must be used within a TerminalProvider')
	}
	return context
}

interface TerminalProviderProps {
	children: ReactNode
	initialTab?: TabId
}

const seedDocuments = [
	{
		sourceId: 'blog:resend:how-to-send-emails-using-bun',
		content:
			'Unrag ingest works by chunking documents into smaller pieces, generating embeddings for each chunk.'
	},
	{
		sourceId: 'docs:unrag:getting-started',
		content:
			'The ingest process involves document parsing, chunking, and embedding generation before storage.'
	},
	{
		sourceId: 'docs:unrag:api-reference',
		content:
			'Use the ingest() function to add documents to your vector store with a source identifier.'
	},
	{
		sourceId: 'blog:resend:improving-time-to-inbox',
		content:
			'Chunking strategy can be customized through chunkSize and overlap parameters for better retrieval.'
	},
	{
		sourceId: 'docs:unrag:debug-events',
		content:
			'Ingest events include ingest:start and ingest:complete with timing and chunk counts.'
	},
	{
		sourceId: 'docs:unrag:chunking-guide',
		content:
			'Smaller chunks improve precision while larger chunks preserve context for retrieval.'
	},
	{
		sourceId: 'blog:resend:deliverability-best-practices',
		content:
			'Monitor inbox placement, tune sending domains, and verify authentication to improve deliverability.'
	},
	{
		sourceId: 'docs:unrag:ingest-panel',
		content:
			'The ingest panel lets you add test content quickly and see how chunking affects search.'
	}
]

function generateId() {
	return Math.random().toString(36).substring(2, 15)
}

function getCurrentTime() {
	const now = new Date()
	return now.toTimeString().slice(0, 8)
}

function tokenize(text: string) {
	return (
		text
			.toLowerCase()
			.match(/[a-z0-9]+/g)
			?.filter((token) => token.length > 1) ?? []
	)
}

function chunkByWords(content: string, chunkSize: number, overlap: number) {
	const words = content.split(/\s+/).filter(Boolean)
	const chunks: string[] = []
	const step = Math.max(1, chunkSize - overlap)

	for (let i = 0; i < words.length; i += step) {
		const chunkWords = words.slice(i, i + chunkSize)
		if (chunkWords.length === 0) {
			break
		}
		chunks.push(chunkWords.join(' '))
		if (i + chunkSize >= words.length) {
			break
		}
	}

	return chunks
}

const seedChunks: IngestChunk[] = seedDocuments.map((doc) => ({
	id: generateId(),
	sourceId: doc.sourceId,
	content: doc.content,
	tokens: tokenize(doc.content).length
}))

export function TerminalProvider({
	children,
	initialTab = 'dashboard'
}: TerminalProviderProps) {
	const [activeTab, setActiveTab] = useState<TabId>(initialTab)
	const [selectedDocIndex, setSelectedDocIndex] = useState(0)
	const [selectedChunkIndex, setSelectedChunkIndex] = useState(0)
	const [isAnimating, setIsAnimating] = useState(false)
	const [isQuerying, setIsQuerying] = useState(false)
	const [isIngesting, setIsIngesting] = useState(false)
	const [events, setEvents] = useState<TerminalEvent[]>([])
	const [traces, setTraces] = useState<TerminalTrace[]>([])
	const [queryResults, setQueryResults] = useState<QueryResult[]>([])
	const [lastQuery, setLastQuery] = useState('')
	const [hasUserInteracted, setHasUserInteracted] = useState(false)
	const [ingestedDocuments, setIngestedDocuments] = useState<
		IngestDocument[]
	>([])
	const [ingestedChunks, setIngestedChunks] = useState<IngestChunk[]>([])

	const handleSetActiveTab = useCallback((tab: TabId) => {
		setActiveTab(tab)
	}, [])

	const handleSetSelectedDocIndex = useCallback((index: number) => {
		setSelectedDocIndex(index)
		setSelectedChunkIndex(0)
	}, [])

	const handleSetSelectedChunkIndex = useCallback((index: number) => {
		setSelectedChunkIndex(index)
	}, [])

	const handleSetIsAnimating = useCallback((animating: boolean) => {
		setIsAnimating(animating)
	}, [])

	const stopAllAnimations = useCallback(() => {
		setHasUserInteracted(true)
	}, [])

	const resetTerminal = useCallback(() => {
		setSelectedDocIndex(0)
		setSelectedChunkIndex(0)
		setEvents([])
		setTraces([])
		setQueryResults([])
		setLastQuery('')
		setIngestedDocuments([])
		setIngestedChunks([])
		setIsAnimating(false)
		setIsQuerying(false)
		setIsIngesting(false)
	}, [])

	const ingestDocument = useCallback((input: IngestInput) => {
		const content = input.content.trim()
		if (!content) {
			return
		}

		const traceId = generateId()
		const sourceId = input.sourceId.trim() || `debug:${generateId()}`
		const chunkSize = Math.max(40, input.chunkSize ?? 120)
		const overlap = Math.min(
			Math.max(0, input.overlap ?? 20),
			chunkSize - 1
		)
		const chunkContents = chunkByWords(content, chunkSize, overlap)
		const chunks: IngestChunk[] = chunkContents.map((chunk) => ({
			id: generateId(),
			sourceId,
			content: chunk,
			tokens: tokenize(chunk).length
		}))
		const time = getCurrentTime()
		const document: IngestDocument = {
			id: generateId(),
			sourceId,
			content,
			metadata: input.metadata?.trim() ?? '',
			chunkCount: chunks.length,
			time
		}
		const embedMs = 120 + Math.floor(Math.random() * 180)
		const chunkMs = 80 + Math.floor(Math.random() * 120)
		const totalMs = embedMs + chunkMs
		setIsIngesting(true)
		setTimeout(() => setIsIngesting(false), Math.max(totalMs, 3000))
		const newEvents: TerminalEvent[] = [
			{
				id: generateId(),
				type: 'ingest:complete',
				time,
				duration: `${totalMs}ms`,
				results: `${chunks.length} chunks`,
				query: sourceId
			},
			{
				id: generateId(),
				type: 'ingest:start',
				time,
				duration: '',
				query: sourceId
			}
		]

		const newTrace: TerminalTrace = {
			id: traceId,
			opName: 'INGEST',
			time,
			label: `source ${sourceId.slice(0, 28)}${sourceId.length > 28 ? '...' : ''} [${(totalMs / 1000).toFixed(1)}s]`,
			totalMs: totalMs.toString(),
			stages: [
				{name: 'CHUNK', ms: chunkMs, color: '#ffffff'},
				{name: 'EMBED', ms: embedMs, color: theme.accent}
			],
			events: [
				{time, type: 'ingest:start'},
				{time, type: 'ingest:chunk-complete'},
				{time, type: 'ingest:embedding-complete'},
				{time, type: 'ingest:complete'}
			]
		}

		setIngestedDocuments((prev) => [document, ...prev])
		setIngestedChunks((prev) => [...chunks, ...prev])
		setEvents((prev) => [...newEvents, ...prev])
		setTraces((prev) => [newTrace, ...prev])
	}, [])

	const runQuery = useCallback(
		(query: string) => {
			if (!query.trim()) {
				return
			}

			const traceId = generateId()
			const startTime = getCurrentTime()

			// Simulate timing values
			const embedMs = 200 + Math.floor(Math.random() * 300)
			const dbMs = 300 + Math.floor(Math.random() * 500)
			const totalMs = embedMs + dbMs
			setIsQuerying(true)
			setTimeout(() => setIsQuerying(false), Math.max(totalMs, 3000))

			const queryTokens = new Set(tokenize(query))
			const queryLower = query.toLowerCase()
			const corpus = ingestedChunks.length
				? [...ingestedChunks, ...seedChunks]
				: seedChunks
			const scoredResults = corpus
				.map((chunk) => {
					const chunkTokens = new Set(tokenize(chunk.content))
					let matches = 0
					for (const token of queryTokens) {
						if (chunkTokens.has(token)) {
							matches += 1
						}
					}
					const ratio = matches / Math.max(queryTokens.size, 1)
					const containsQuery =
						queryLower.length > 1 &&
						chunk.content.toLowerCase().includes(queryLower)
					const normalized = Math.min(
						1,
						ratio + (containsQuery ? 0.2 : 0)
					)
					return {
						chunk,
						score: 0.55 + normalized * 0.4
					}
				})
				.sort((a, b) => b.score - a.score)
				.slice(0, 8)
				.map((result) => ({
					id: result.chunk.id,
					sourceId: result.chunk.sourceId,
					score: Number(result.score.toFixed(2)),
					content: result.chunk.content
				}))
			const resultCount = scoredResults.length

			// Create events for this query
			const newEvents: TerminalEvent[] = [
				{
					id: generateId(),
					type: 'retrieve:complete',
					time: startTime,
					duration: `${totalMs}ms`,
					results: `${resultCount}/8`,
					query: query,
					embed: `${embedMs}ms`,
					db: `${(dbMs / 1000).toFixed(1)}s`,
					total: `${(totalMs / 1000).toFixed(1)}s`
				},
				{
					id: generateId(),
					type: 'retrieve:database-complete',
					time: startTime,
					duration: `${dbMs}ms`,
					results: `${resultCount} results`
				},
				{
					id: generateId(),
					type: 'retrieve:embedding-complete',
					time: startTime,
					duration: `${embedMs}ms`,
					results: 'dim=1536'
				},
				{
					id: generateId(),
					type: 'retrieve:start',
					time: startTime,
					duration: '',
					query: `"${query.slice(0, 25)}${query.length > 25 ? '...' : ''}" k=8`
				}
			]

			// Create trace for this query
			const newTrace: TerminalTrace = {
				id: traceId,
				opName: 'RETRIEVE',
				time: startTime,
				label: `q ${query.slice(0, 30)}${query.length > 30 ? '...' : ''} [${(totalMs / 1000).toFixed(1)}s]`,
				totalMs: totalMs.toString(),
				stages: [
					{name: 'EMBEDDING', ms: embedMs, color: theme.accent},
					{name: 'DB', ms: dbMs, color: '#ffffff'}
				],
				events: [
					{time: startTime, type: 'retrieve:start'},
					{time: startTime, type: 'retrieve:embedding-complete'},
					{time: startTime, type: 'retrieve:database-complete'},
					{time: startTime, type: 'retrieve:complete'}
				]
			}

			// Update state
			setLastQuery(query)
			setQueryResults(scoredResults)
			setEvents((prev) => [...newEvents, ...prev])
			setTraces((prev) => [newTrace, ...prev])
		},
		[ingestedChunks]
	)

	const value = useMemo<TerminalContextValue>(
		() => ({
			activeTab,
			selectedDocIndex,
			selectedChunkIndex,
			isAnimating,
			isQuerying,
			isIngesting,
			events,
			traces,
			queryResults,
			lastQuery,
			hasUserInteracted,
			ingestedDocuments,
			ingestedChunks,
			setActiveTab: handleSetActiveTab,
			setSelectedDocIndex: handleSetSelectedDocIndex,
			setSelectedChunkIndex: handleSetSelectedChunkIndex,
			setIsAnimating: handleSetIsAnimating,
			runQuery,
			stopAllAnimations,
			resetTerminal,
			ingestDocument
		}),
		[
			activeTab,
			selectedDocIndex,
			selectedChunkIndex,
			isAnimating,
			isQuerying,
			isIngesting,
			events,
			traces,
			queryResults,
			lastQuery,
			hasUserInteracted,
			ingestedDocuments,
			ingestedChunks,
			handleSetActiveTab,
			handleSetSelectedDocIndex,
			handleSetSelectedChunkIndex,
			handleSetIsAnimating,
			runQuery,
			stopAllAnimations,
			resetTerminal,
			ingestDocument
		]
	)

	return (
		<TerminalContext.Provider value={value}>
			{children}
		</TerminalContext.Provider>
	)
}
