'use client'

import {cn} from '@/lib/utils'
import {useHotkeys} from '@mantine/hooks'
import {AnimatePresence, motion} from 'motion/react'
import type {PointerEventHandler} from 'react'
import {useCallback, useEffect, useRef, useState} from 'react'
import {TerminalContent} from './terminal-content'
import {TerminalProvider, useTerminal} from './terminal-context'
import {TerminalHeader} from './terminal-header'
import {TerminalLogo} from './terminal-logo'
import {TerminalStatusBar} from './terminal-status-bar'
import {TerminalTabBar} from './terminal-tab-bar'
import {TABS} from './terminal-theme'
import type {TabId, TerminalProps} from './terminal-types'

const COMMAND = 'bunx unrag debug'
const TYPING_SPEED = 50
const TUI_REVEAL_DELAY = 300
const AUTO_INGEST = {
	sourceId: 'debug:hello-world',
	content:
		'Hello from Unrag Debug TUI. Ingesting content creates chunks so queries can retrieve matching passages.',
	metadata: '{"source":"debug"}',
	chunkSize: 120,
	overlap: 20
}

function isEditableTarget() {
	const active = document.activeElement
	if (!active) {
		return false
	}
	if (active instanceof HTMLInputElement) {
		return true
	}
	if (active instanceof HTMLTextAreaElement) {
		return true
	}
	if (active instanceof HTMLElement && active.isContentEditable) {
		return true
	}
	return false
}

function TerminalTitleBar({
	onPointerDown
}: {
	onPointerDown?: PointerEventHandler<HTMLDivElement>
}) {
	return (
		<div
			onPointerDown={onPointerDown}
			className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5 sm:px-4 sm:py-3"
		>
			<div className="flex items-center gap-1.5">
				<span className="size-3 rounded-full bg-[#ff5f57]" />
				<span className="size-3 rounded-full bg-[#febc2e]" />
				<span className="size-3 rounded-full bg-[#28c840]" />
			</div>
			<span className="flex-1 text-center text-[10px] text-white/40 -ml-12 sm:text-[11px]">
				Terminal
			</span>
		</div>
	)
}

function TerminalPrompt({
	command,
	isTyping,
	showCursor = true
}: {
	command: string
	isTyping: boolean
	showCursor?: boolean
}) {
	return (
		<div className="flex items-center gap-2 px-3 py-2 text-[10px] sm:px-5 sm:py-4 sm:text-[13px]">
			<span className="text-white/60">vercel</span>
			<span className="text-white/40">$</span>
			<span className="text-white">{command}</span>
			{isTyping && showCursor && (
				<motion.span
					className="inline-block w-2 h-4 bg-white"
					animate={{opacity: [1, 0]}}
					transition={{
						duration: 0.5,
						repeat: Number.POSITIVE_INFINITY
					}}
				/>
			)}
		</div>
	)
}

function TerminalTUI({onInteraction}: {onInteraction: () => void}) {
	const {
		setSelectedDocIndex,
		setActiveTab,
		stopAllAnimations,
		hasUserInteracted,
		resetTerminal,
		ingestDocument
	} = useTerminal()
	const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [isAutoPlaying, setIsAutoPlaying] = useState(true)

	const stopAutoPlay = useCallback(() => {
		if (autoPlayRef.current) {
			clearTimeout(autoPlayRef.current)
			autoPlayRef.current = null
		}
		setIsAutoPlaying(false)
		stopAllAnimations()
		onInteraction()
	}, [onInteraction, stopAllAnimations])

	useHotkeys(
		TABS.map((tab) => [
			String(tab.shortcut),
			() => {
				if (!hasUserInteracted || isEditableTarget()) {
					return
				}
				stopAllAnimations()
				setActiveTab(tab.id as TabId)
			},
			{preventDefault: true}
		])
	)

	// Also stop if user interacted elsewhere
	useEffect(() => {
		if (hasUserInteracted && isAutoPlaying) {
			if (autoPlayRef.current) {
				clearTimeout(autoPlayRef.current)
				autoPlayRef.current = null
			}
			setIsAutoPlaying(false)
		}
	}, [hasUserInteracted, isAutoPlaying])

	useEffect(() => {
		if (!isAutoPlaying) {
			return
		}

		resetTerminal()
		setActiveTab('dashboard' as TabId)

		const sequence: Array<{action: () => void; delay: number}> = [
			// Show ingest and run a sample document
			{action: () => setActiveTab('ingest' as TabId), delay: 1400},
			{action: () => ingestDocument(AUTO_INGEST), delay: 1000},
			// Let ingest logs show before moving on
			{action: () => setActiveTab('ingest' as TabId), delay: 3200},
			// Show query and let it type + run
			{action: () => setActiveTab('query' as TabId), delay: 1400},
			// Wait for query loading + results before switching
			{action: () => setActiveTab('query' as TabId), delay: 10000},
			// Show traces with waterfall
			{action: () => setActiveTab('traces' as TabId), delay: 2000},
			// Show events
			{action: () => setActiveTab('events' as TabId), delay: 2200},
			// Go to docs
			{action: () => setActiveTab('docs' as TabId), delay: 2000},
			{action: () => setSelectedDocIndex(1), delay: 1600},
			{action: () => setSelectedDocIndex(2), delay: 1200},
			{action: () => setSelectedDocIndex(0), delay: 1200},
			// Reset data, back to dashboard
			{
				action: () => {
					resetTerminal()
					setActiveTab('dashboard' as TabId)
				},
				delay: 2200
			}
		]

		let currentIndex = 0

		const runNext = () => {
			if (!isAutoPlaying) {
				return
			}
			if (currentIndex >= sequence.length) {
				currentIndex = 0
			}
			const item = sequence[currentIndex]
			if (item) {
				autoPlayRef.current = setTimeout(() => {
					item.action()
					currentIndex++
					runNext()
				}, item.delay)
			}
		}

		runNext()

		return () => {
			if (autoPlayRef.current) {
				clearTimeout(autoPlayRef.current)
			}
		}
	}, [
		ingestDocument,
		isAutoPlaying,
		resetTerminal,
		setActiveTab,
		setSelectedDocIndex
	])

	return (
		<motion.div
			initial={{opacity: 0}}
			animate={{opacity: 1}}
			transition={{duration: 0.4, ease: 'easeOut'}}
			onClick={stopAutoPlay}
			onTouchStart={stopAutoPlay}
			className="cursor-default"
		>
			<TerminalLogo />
			<TerminalHeader />
			<TerminalTabBar />
			<TerminalContent />
			<TerminalStatusBar />
		</motion.div>
	)
}

function TerminalInner({
	autoPlay = false,
	className,
	onTitleBarPointerDown,
	style,
	resizable
}: TerminalProps) {
	const [isTyping, setIsTyping] = useState(autoPlay)
	const [typedCommand, setTypedCommand] = useState(autoPlay ? '' : COMMAND)
	const [showTUI, setShowTUI] = useState(!autoPlay)

	useEffect(() => {
		if (!autoPlay || !isTyping) {
			return
		}

		let charIndex = 0
		const typeInterval = setInterval(() => {
			if (charIndex < COMMAND.length) {
				setTypedCommand(COMMAND.slice(0, charIndex + 1))
				charIndex++
			} else {
				clearInterval(typeInterval)
				setIsTyping(false)
				setTimeout(() => {
					setShowTUI(true)
				}, TUI_REVEAL_DELAY)
			}
		}, TYPING_SPEED)

		return () => {
			clearInterval(typeInterval)
		}
	}, [autoPlay, isTyping])

	const handleInteraction = useCallback(() => {}, [])

	return (
		<div
			className={cn(
				'font-mono text-[9px] leading-tight bg-[#141411]/90 text-white select-none backdrop-blur-lg sm:text-[11px]',
				resizable
					? 'h-full max-h-none overflow-y-auto no-scrollbar'
					: 'h-[560px] max-h-[560px] overflow-hidden sm:h-[700px] sm:max-h-[700px]',
				className
			)}
			style={style}
		>
			{/* macOS-style title bar - always visible */}
			<TerminalTitleBar onPointerDown={onTitleBarPointerDown} />

			{/* Command line - always visible once typing starts */}
			<TerminalPrompt
				command={typedCommand}
				isTyping={isTyping}
				showCursor={isTyping}
			/>

			{/* TUI content - appears after typing completes */}
			<AnimatePresence>
				{showTUI && <TerminalTUI onInteraction={handleInteraction} />}
			</AnimatePresence>
		</div>
	)
}

export function Terminal({
	className,
	autoPlay = false,
	initialTab = 'dashboard',
	onTitleBarPointerDown,
	style,
	resizable
}: TerminalProps) {
	return (
		<TerminalProvider initialTab={initialTab}>
			<TerminalInner
				autoPlay={autoPlay}
				className={className}
				onTitleBarPointerDown={onTitleBarPointerDown}
				style={style}
				resizable={resizable}
			/>
		</TerminalProvider>
	)
}
