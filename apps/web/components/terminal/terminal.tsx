'use client'

import {clsx} from 'clsx/lite'
import {AnimatePresence, motion} from 'motion/react'
import {useCallback, useEffect, useRef, useState} from 'react'
import {TerminalContent} from './terminal-content'
import {TerminalProvider, useTerminal} from './terminal-context'
import {TerminalHeader} from './terminal-header'
import {TerminalLogo} from './terminal-logo'
import {TerminalStatusBar} from './terminal-status-bar'
import {TerminalTabBar} from './terminal-tab-bar'
import type {TabId, TerminalProps} from './terminal-types'

const COMMAND = 'bunx unrag debug'
const TYPING_SPEED = 50
const TUI_REVEAL_DELAY = 300

function TerminalTitleBar() {
	return (
		<div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
			<div className="flex items-center gap-1.5">
				<span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
				<span className="w-3 h-3 rounded-full bg-[#febc2e]" />
				<span className="w-3 h-3 rounded-full bg-[#28c840]" />
			</div>
			<span className="flex-1 text-center text-[11px] text-white/40 -ml-12">
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
		<div className="px-5 py-4 flex items-center gap-2 text-[13px]">
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
	const {setSelectedDocIndex, setActiveTab, runQuery, stopAllAnimations, hasUserInteracted} = useTerminal()
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

		const sequence: Array<{action: () => void; delay: number}> = [
			// Run initial query to populate events/traces
			{action: () => runQuery('how does unrag ingest work?'), delay: 1500},
			// Show events
			{action: () => setActiveTab('events' as TabId), delay: 2000},
			// Show traces with waterfall
			{action: () => setActiveTab('traces' as TabId), delay: 2500},
			// Go to query and run another query
			{action: () => setActiveTab('query' as TabId), delay: 2500},
			// Go to docs
			{action: () => setActiveTab('docs' as TabId), delay: 3500},
			{action: () => setSelectedDocIndex(1), delay: 2000},
			{action: () => setSelectedDocIndex(2), delay: 1500},
			{action: () => setSelectedDocIndex(0), delay: 1500},
			// Back to dashboard
			{action: () => setActiveTab('dashboard' as TabId), delay: 2500}
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
	}, [isAutoPlaying, setSelectedDocIndex, setActiveTab, runQuery])

	return (
		<motion.div
			initial={{opacity: 0}}
			animate={{opacity: 1}}
			transition={{duration: 0.4, ease: 'easeOut'}}
			onMouseEnter={stopAutoPlay}
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

function TerminalInner({autoPlay, className}: TerminalProps) {
	const [isTyping, setIsTyping] = useState(autoPlay)
	const [typedCommand, setTypedCommand] = useState(autoPlay ? '' : COMMAND)
	const [showTUI, setShowTUI] = useState(!autoPlay)
	const [hasInteracted, setHasInteracted] = useState(false)

	useEffect(() => {
		if (!autoPlay || !isTyping) return

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

	const handleInteraction = useCallback(() => {
		setHasInteracted(true)
	}, [])

	return (
		<div
			className={clsx(
				'font-mono text-[11px] leading-tight bg-[#1A1A1A] text-white overflow-hidden select-none min-h-[600px]',
				className
			)}
		>
			{/* macOS-style title bar - always visible */}
			<TerminalTitleBar />

			{/* Command line - always visible once typing starts */}
			<TerminalPrompt
				command={typedCommand}
				isTyping={isTyping}
				showCursor={isTyping}
			/>

			{/* TUI content - appears after typing completes */}
			<AnimatePresence>
				{showTUI && (
					<TerminalTUI
						onInteraction={handleInteraction}
					/>
				)}
			</AnimatePresence>
		</div>
	)
}

export function Terminal({
	className,
	autoPlay = false,
	initialTab = 'dashboard'
}: TerminalProps) {
	return (
		<TerminalProvider initialTab={initialTab}>
			<TerminalInner autoPlay={autoPlay} className={className} />
		</TerminalProvider>
	)
}
