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
const TYPING_SPEED = 80
const COMMAND_DELAY = 500
const TUI_REVEAL_DELAY = 400

function TerminalPrompt({
	command,
	isTyping
}: {
	command: string
	isTyping: boolean
}) {
	return (
		<div className="px-4 py-6 flex items-center gap-2 text-[13px]">
			<span className="text-white/50">$</span>
			<span className="text-white">{command}</span>
			{isTyping && (
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
	const {setSelectedDocIndex, setActiveTab} = useTerminal()
	const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [isAutoPlaying, setIsAutoPlaying] = useState(true)

	const stopAutoPlay = useCallback(() => {
		if (autoPlayRef.current) {
			clearTimeout(autoPlayRef.current)
			autoPlayRef.current = null
		}
		setIsAutoPlaying(false)
		onInteraction()
	}, [onInteraction])

	useEffect(() => {
		if (!isAutoPlaying) {
			return
		}

		const sequence: Array<{action: () => void; delay: number}> = [
			{action: () => setSelectedDocIndex(1), delay: 2500},
			{action: () => setSelectedDocIndex(2), delay: 1800},
			{action: () => setSelectedDocIndex(0), delay: 1800},
			{action: () => setActiveTab('dashboard' as TabId), delay: 3000},
			{action: () => setActiveTab('docs' as TabId), delay: 2500}
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
	}, [isAutoPlaying, setSelectedDocIndex, setActiveTab])

	return (
		<motion.div
			initial={{opacity: 0, y: 10}}
			animate={{opacity: 1, y: 0}}
			transition={{duration: 0.3}}
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
	const [phase, setPhase] = useState<'typing' | 'tui'>(
		autoPlay ? 'typing' : 'tui'
	)
	const [typedCommand, setTypedCommand] = useState('')
	const [_hasInteracted, setHasInteracted] = useState(false)

	useEffect(() => {
		if (!autoPlay || phase !== 'typing') {
			return
		}

		let charIndex = 0
		const typeInterval = setInterval(() => {
			if (charIndex < COMMAND.length) {
				setTypedCommand(COMMAND.slice(0, charIndex + 1))
				charIndex++
			} else {
				clearInterval(typeInterval)
				setTimeout(() => {
					setPhase('tui')
				}, TUI_REVEAL_DELAY)
			}
		}, TYPING_SPEED)

		const initialDelay = setTimeout(() => {}, COMMAND_DELAY)

		return () => {
			clearInterval(typeInterval)
			clearTimeout(initialDelay)
		}
	}, [autoPlay, phase])

	const handleInteraction = useCallback(() => {
		setHasInteracted(true)
	}, [])

	return (
		<div
			className={clsx(
				'font-mono text-[11px] leading-tight bg-[#1A1A1A] text-white overflow-hidden select-none',
				className
			)}
		>
			<AnimatePresence mode="wait">
				{phase === 'typing' ? (
					<motion.div
						key="typing"
						exit={{opacity: 0}}
						transition={{duration: 0.2}}
					>
						<TerminalPrompt
							command={typedCommand}
							isTyping={true}
						/>
					</motion.div>
				) : (
					<TerminalTUI key="tui" onInteraction={handleInteraction} />
				)}
			</AnimatePresence>
		</div>
	)
}

export function Terminal({
	className,
	autoPlay = false,
	initialTab = 'docs'
}: TerminalProps) {
	return (
		<TerminalProvider initialTab={initialTab}>
			<TerminalInner autoPlay={autoPlay} className={className} />
		</TerminalProvider>
	)
}
