/**
 * TypeScript interfaces for the Terminal component.
 */

export type TabId =
	| 'dashboard'
	| 'events'
	| 'traces'
	| 'query'
	| 'docs'
	| 'doctor'
	| 'eval'

export interface Tab {
	id: TabId
	label: string
	shortcut: number
}

export interface TerminalState {
	activeTab: TabId
	selectedDocIndex: number
	selectedChunkIndex: number
	isAnimating: boolean
}

export interface TerminalActions {
	setActiveTab: (tab: TabId) => void
	setSelectedDocIndex: (index: number) => void
	setSelectedChunkIndex: (index: number) => void
	setIsAnimating: (animating: boolean) => void
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
