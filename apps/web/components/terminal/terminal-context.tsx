'use client'

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState
} from 'react'
import type {TabId, TerminalContextValue} from './terminal-types'

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

export function TerminalProvider({
	children,
	initialTab = 'docs'
}: TerminalProviderProps) {
	const [activeTab, setActiveTab] = useState<TabId>(initialTab)
	const [selectedDocIndex, setSelectedDocIndex] = useState(0)
	const [selectedChunkIndex, setSelectedChunkIndex] = useState(0)
	const [isAnimating, setIsAnimating] = useState(false)

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

	const value = useMemo<TerminalContextValue>(
		() => ({
			activeTab,
			selectedDocIndex,
			selectedChunkIndex,
			isAnimating,
			setActiveTab: handleSetActiveTab,
			setSelectedDocIndex: handleSetSelectedDocIndex,
			setSelectedChunkIndex: handleSetSelectedChunkIndex,
			setIsAnimating: handleSetIsAnimating
		}),
		[
			activeTab,
			selectedDocIndex,
			selectedChunkIndex,
			isAnimating,
			handleSetActiveTab,
			handleSetSelectedDocIndex,
			handleSetSelectedChunkIndex,
			handleSetIsAnimating
		]
	)

	return (
		<TerminalContext.Provider value={value}>
			{children}
		</TerminalContext.Provider>
	)
}
