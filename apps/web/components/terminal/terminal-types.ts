/**
 * TypeScript interfaces for the Terminal component.
 */

export type TabId =
	| 'dashboard'
	| 'events'
	| 'traces'
	| 'query'
	| 'docs'
	| 'ingest'

export interface Tab {
	id: TabId
	label: string
	shortcut: number
}

export interface TerminalEvent {
	id: string
	type: string
	time: string
	duration: string
	results?: string
	query?: string
	embed?: string
	db?: string
	total?: string
}

export interface TerminalTrace {
	id: string
	opName: string
	time: string
	label: string
	totalMs: string
	stages: Array<{
		name: string
		ms: number
		color: string
	}>
	events: Array<{
		time: string
		type: string
	}>
}

export interface QueryResult {
	id: string
	sourceId: string
	score: number
	content: string
}

export interface IngestInput {
	sourceId: string
	content: string
	metadata?: string
	chunkSize?: number
	overlap?: number
}

export interface IngestChunk {
	id: string
	sourceId: string
	content: string
	tokens: number
}

export interface IngestDocument {
	id: string
	sourceId: string
	content: string
	metadata: string
	chunkCount: number
	time: string
}

export interface TerminalState {
	activeTab: TabId
	selectedDocIndex: number
	selectedChunkIndex: number
	isAnimating: boolean
	isQuerying: boolean
	isIngesting: boolean
	events: TerminalEvent[]
	traces: TerminalTrace[]
	queryResults: QueryResult[]
	lastQuery: string
	hasUserInteracted: boolean
	ingestedDocuments: IngestDocument[]
	ingestedChunks: IngestChunk[]
}

export interface TerminalActions {
	setActiveTab: (tab: TabId) => void
	setSelectedDocIndex: (index: number) => void
	setSelectedChunkIndex: (index: number) => void
	setIsAnimating: (animating: boolean) => void
	runQuery: (query: string) => void
	stopAllAnimations: () => void
	resetTerminal: () => void
	ingestDocument: (input: IngestInput) => void
}

export interface TerminalContextValue extends TerminalState, TerminalActions {}

export interface DocumentItem {
	sourceId: string
	chunks: number
}

export interface ChunkRange {
	range: string
	count: number
}

export interface ChunkDetail {
	idx: number
	tokens: number
	content: string
}

export interface TerminalStats {
	adapter: string
	vectors: number
	dim: number
	documents: number
	chunks: number
	embeddings: number
}

export interface TerminalProps {
	className?: string
	autoPlay?: boolean
	initialTab?: TabId
}
