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

// Mock results that simulate real retrieval
const mockResultsPool: QueryResult[] = [
	{
		id: '1',
		sourceId: 'blog:resend:how-to-send-emails-using-bun',
		score: 0.89,
		content:
			'Unrag ingest works by chunking documents into smaller pieces, generating embeddings for each chunk...'
	},
	{
		id: '2',
		sourceId: 'docs:unrag:getting-started',
		score: 0.85,
		content:
			'The ingest process involves three main steps: document parsing, chunking, and embedding generation...'
	},
	{
		id: '3',
		sourceId: 'docs:unrag:api-reference',
		score: 0.82,
		content:
			'Use the ingest() function to add documents to your vector store. It accepts a source identifier...'
	},
	{
		id: '4',
		sourceId: 'blog:resend:improving-time-to-inbox',
		score: 0.78,
		content:
			'The chunking strategy can be customized through the chunkSize and overlap parameters...'
	}
]

function generateId() {
	return Math.random().toString(36).substring(2, 15)
}

function getCurrentTime() {
	const now = new Date()
	return now.toTimeString().slice(0, 8)
}

export function TerminalProvider({
	children,
	initialTab = 'dashboard'
}: TerminalProviderProps) {
	const [activeTab, setActiveTab] = useState<TabId>(initialTab)
	const [selectedDocIndex, setSelectedDocIndex] = useState(0)
	const [selectedChunkIndex, setSelectedChunkIndex] = useState(0)
	const [isAnimating, setIsAnimating] = useState(false)
	const [events, setEvents] = useState<TerminalEvent[]>([])
	const [traces, setTraces] = useState<TerminalTrace[]>([])
	const [queryResults, setQueryResults] = useState<QueryResult[]>([])
	const [lastQuery, setLastQuery] = useState('')
	const [hasUserInteracted, setHasUserInteracted] = useState(false)

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

	const runQuery = useCallback((query: string) => {
		if (!query.trim()) return

		const traceId = generateId()
		const startTime = getCurrentTime()

		// Simulate timing values
		const embedMs = 200 + Math.floor(Math.random() * 300)
		const dbMs = 300 + Math.floor(Math.random() * 500)
		const totalMs = embedMs + dbMs

		// Create events for this query
		const newEvents: TerminalEvent[] = [
			{
				id: generateId(),
				type: 'retrieve:complete',
				time: startTime,
				duration: `${totalMs}ms`,
				results: '8/8',
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
				results: '8 results'
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
		setQueryResults(mockResultsPool)
		setEvents((prev) => [...newEvents, ...prev])
		setTraces((prev) => [newTrace, ...prev])
	}, [])

	const value = useMemo<TerminalContextValue>(
		() => ({
			activeTab,
			selectedDocIndex,
			selectedChunkIndex,
			isAnimating,
			events,
			traces,
			queryResults,
			lastQuery,
			hasUserInteracted,
			setActiveTab: handleSetActiveTab,
			setSelectedDocIndex: handleSetSelectedDocIndex,
			setSelectedChunkIndex: handleSetSelectedChunkIndex,
			setIsAnimating: handleSetIsAnimating,
			runQuery,
			stopAllAnimations
		}),
		[
			activeTab,
			selectedDocIndex,
			selectedChunkIndex,
			isAnimating,
			events,
			traces,
			queryResults,
			lastQuery,
			hasUserInteracted,
			handleSetActiveTab,
			handleSetSelectedDocIndex,
			handleSetSelectedChunkIndex,
			handleSetIsAnimating,
			runQuery,
			stopAllAnimations
		]
	)

	return (
		<TerminalContext.Provider value={value}>
			{children}
		</TerminalContext.Provider>
	)
}
