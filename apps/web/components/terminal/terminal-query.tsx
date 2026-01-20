'use client'

import {cn} from '@/lib/utils'
import {useHotkeys} from '@mantine/hooks'
import {motion, useReducedMotion} from 'motion/react'
import {useEffect, useRef, useState} from 'react'
import {useTerminal} from './terminal-context'
import {chars, theme} from './terminal-theme'

const EXAMPLE_QUERY = 'how does unrag ingest work?'
const TYPING_SPEED = 60

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

export function TerminalQuery() {
	const {
		activeTab,
		queryResults,
		lastQuery,
		runQuery,
		hasUserInteracted,
		stopAllAnimations,
		isQuerying
	} = useTerminal()
	const [query, setQuery] = useState(lastQuery || '')
	const [isTyping, setIsTyping] = useState(!lastQuery && !hasUserInteracted)
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [hasInteracted, setHasInteracted] = useState(
		!!lastQuery || hasUserInteracted
	)
	const inputRef = useRef<HTMLInputElement>(null)
	const cycleCountRef = useRef(0)
	const lastQueryRef = useRef(lastQuery)
	const shouldReduceMotion = useReducedMotion()

	// Stop typing if global interaction happened
	useEffect(() => {
		if (hasUserInteracted) {
			setHasInteracted(true)
			setIsTyping(false)
		}
	}, [hasUserInteracted])

	// Sync query with lastQuery from context when component mounts
	useEffect(() => {
		if (lastQuery && !query && !hasInteracted && !hasUserInteracted) {
			setQuery(lastQuery)
			setHasInteracted(true)
			setIsTyping(false)
		}
	}, [lastQuery, query, hasInteracted, hasUserInteracted])

	useEffect(() => {
		if (activeTab !== 'query') {
			return
		}
		if (hasUserInteracted || hasInteracted || lastQuery) {
			return
		}
		setQuery('')
		setIsTyping(true)
	}, [activeTab, hasUserInteracted, hasInteracted, lastQuery])

	// Typing animation effect
	useEffect(() => {
		if (!isTyping || hasInteracted || hasUserInteracted) {
			return
		}

		if (shouldReduceMotion) {
			setQuery(EXAMPLE_QUERY)
			setIsTyping(false)
			runQuery(EXAMPLE_QUERY)
			return
		}

		let charIndex = 0
		const typeInterval = setInterval(() => {
			if (charIndex < EXAMPLE_QUERY.length) {
				setQuery(EXAMPLE_QUERY.slice(0, charIndex + 1))
				charIndex++
			} else {
				clearInterval(typeInterval)
				setIsTyping(false)
				runQuery(EXAMPLE_QUERY)
			}
		}, TYPING_SPEED)

		return () => {
			clearInterval(typeInterval)
		}
	}, [
		isTyping,
		hasInteracted,
		hasUserInteracted,
		runQuery,
		shouldReduceMotion
	])

	const handleFocus = () => {
		setHasInteracted(true)
		setIsTyping(false)
		stopAllAnimations()
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setHasInteracted(true)
		setIsTyping(false)
		stopAllAnimations()
		setQuery(e.target.value)
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		setHasInteracted(true)
		setIsTyping(false)
		stopAllAnimations()
		if (query.trim()) {
			runQuery(query)
		}
	}

	useHotkeys([
		[
			'j',
			() => {
				if (activeTab !== 'query' || !hasUserInteracted) {
					return
				}
				if (isEditableTarget()) {
					return
				}
				if (queryResults.length === 0) {
					return
				}
				stopAllAnimations()
				setHasInteracted(true)
				setIsTyping(false)
				setSelectedIndex((prev) =>
					Math.min(prev + 1, queryResults.length - 1)
				)
			},
			{preventDefault: true}
		],
		[
			'k',
			() => {
				if (activeTab !== 'query' || !hasUserInteracted) {
					return
				}
				if (isEditableTarget()) {
					return
				}
				if (queryResults.length === 0) {
					return
				}
				stopAllAnimations()
				setHasInteracted(true)
				setIsTyping(false)
				setSelectedIndex((prev) => Math.max(prev - 1, 0))
			},
			{preventDefault: true}
		]
	])

	// Show results if we have any in context
	const showResults = !isQuerying && queryResults.length > 0
	const selectedResult = queryResults[selectedIndex]
	const emptyMessage = isQuerying
		? 'Querying...'
		: isTyping
			? 'Typing query...'
			: lastQuery
				? 'No results for query'
				: 'Enter a query and press SEARCH'
	const listVariants = {
		hidden: {},
		show: {
			transition: {
				staggerChildren: shouldReduceMotion ? 0 : 0.06,
				delayChildren: shouldReduceMotion ? 0 : 0.05
			}
		}
	}
	const itemVariants = {
		hidden: {opacity: 0, y: shouldReduceMotion ? 0 : 6},
		show: {
			opacity: 1,
			y: 0,
			transition: {
				duration: shouldReduceMotion ? 0 : 0.18
			}
		}
	}

	useEffect(() => {
		if (lastQueryRef.current === lastQuery) {
			return
		}
		lastQueryRef.current = lastQuery
		setSelectedIndex(0)
		cycleCountRef.current = 0
	}, [lastQuery])

	useEffect(() => {
		if (!showResults || hasInteracted || hasUserInteracted) {
			return
		}
		if (queryResults.length < 2) {
			return
		}

		cycleCountRef.current = 0

		const interval = setInterval(() => {
			setSelectedIndex((prev) => (prev + 1) % queryResults.length)
			cycleCountRef.current += 1
			if (cycleCountRef.current >= 4) {
				clearInterval(interval)
			}
		}, 1200)

		return () => clearInterval(interval)
	}, [showResults, hasInteracted, hasUserInteracted, queryResults.length])

	return (
		<div className="flex flex-col h-full">
			{/* Query input */}
			<div className="border-b border-white/10 px-3 py-2 sm:px-4 sm:py-3">
				<form
					onSubmit={handleSubmit}
					className="flex items-center gap-2"
				>
					<span className="text-[9px] text-white/40 sm:text-[10px]">
						{chars.arrow}
					</span>
					<div className="relative flex-1">
						<input
							ref={inputRef}
							type="text"
							value={query}
							onChange={handleChange}
							onFocus={handleFocus}
							placeholder="Enter your query..."
							className="w-full bg-transparent text-[10px] text-white outline-none placeholder:text-white/30 sm:text-[11px]"
						/>
						{isTyping && !hasInteracted && !hasUserInteracted && (
							<motion.span
								className="absolute top-1/2 h-3 w-1 -translate-y-1/2 bg-white/70"
								style={{
									left: `calc(${Math.max(query.length, 0)}ch + 1px)`
								}}
								animate={{opacity: [1, 0]}}
								transition={{
									duration: 0.6,
									repeat: Number.POSITIVE_INFINITY
								}}
							/>
						)}
					</div>
					<span className="text-[9px] text-white/30 sm:text-[10px]">
						k=8
					</span>
					<button
						type="submit"
						className="px-2 py-0.5 text-[9px] font-medium text-black sm:text-[10px]"
						style={{backgroundColor: theme.accent}}
					>
						SEARCH
					</button>
				</form>
			</div>

			{/* Results area */}
			<div className="flex flex-1 min-h-0 flex-col sm:flex-row">
				{/* Results list */}
				<div className="flex flex-1 flex-col border-b border-white/10 sm:border-b-0 sm:border-r">
					<div className="flex items-center justify-between border-b border-white/10 px-3 py-2 sm:px-4">
						<div className="flex items-center gap-2">
							<span className="bg-white/10 px-1.5 py-0.5 text-[9px] text-white/40 sm:text-[10px]">
								RESULTS
							</span>
							<span className="text-[9px] text-white/30 sm:text-[10px]">
								j/k navigate · enter inspect
							</span>
						</div>
						{isQuerying ? (
							<span className="text-[9px] text-white/40 sm:text-[10px]">
								QUERYING...
							</span>
						) : showResults ? (
							<span className="text-[9px] font-bold text-white sm:text-[10px]">
								{queryResults.length}
							</span>
						) : null}
					</div>
					<div className="flex-1 overflow-y-auto no-scrollbar">
						{showResults ? (
							<motion.div
								key={`${lastQuery || 'results'}-${queryResults[0]?.id ?? 'empty'}`}
								variants={listVariants}
								initial="hidden"
								animate="show"
							>
								{queryResults.map((result, idx) => {
									const isSelected = idx === selectedIndex
									return (
										<motion.button
											key={result.id}
											type="button"
											variants={itemVariants}
											onClick={() =>
												setSelectedIndex(idx)
											}
											className={cn(
												'w-full text-left px-3 py-1.5 text-[9px] flex items-center gap-3 transition-colors sm:px-4 sm:text-[10px]',
												isSelected
													? 'text-white font-medium'
													: 'text-white/50 hover:text-white/70'
											)}
										>
											<span
												className={cn(
													isSelected
														? 'text-green-400'
														: 'text-white/40'
												)}
											>
												{chars.check}
											</span>
											<span className="opacity-60 tabular-nums">
												{result.score.toFixed(2)}
											</span>
											<span className="flex-1 truncate">
												{result.sourceId}
											</span>
										</motion.button>
									)
								})}
							</motion.div>
						) : (
							<div className="px-4 py-6 text-center text-[9px] text-white/30 text-pretty sm:text-[10px]">
								{emptyMessage}
							</div>
						)}
					</div>
				</div>

				{/* Details panel */}
				<div className="flex w-full flex-col border-t border-white/10 sm:w-[45%] sm:border-t-0">
					<div className="border-b border-white/10 px-3 py-2 sm:px-4">
						<span
							className="px-1.5 py-0.5 text-[9px] font-medium text-black sm:text-[10px]"
							style={{backgroundColor: theme.accent}}
						>
							PREVIEW
						</span>
					</div>
					{showResults && selectedResult ? (
						<div className="flex-1 p-3 text-[9px] sm:p-4 sm:text-[10px]">
							<div className="flex items-center gap-2 mb-3">
								<span className="text-white/70 font-medium tabular-nums">
									{selectedResult.score.toFixed(2)}
								</span>
								<span className="text-white/40">relevance</span>
							</div>
							<div className="space-y-2">
								<div className="flex gap-3">
									<span className="text-white/40 w-12">
										source
									</span>
									<span className="text-white truncate">
										{selectedResult.sourceId}
									</span>
								</div>
								<div className="flex gap-3">
									<span className="text-white/40 w-12">
										chunk
									</span>
									<span className="text-white/70 leading-relaxed">
										{selectedResult.content}
									</span>
								</div>
							</div>
						</div>
					) : (
						<div className="flex-1 p-3 text-[9px] text-white/30 sm:p-4 sm:text-[10px]">
							{isQuerying
								? 'Querying...'
								: 'Select a result to view details'}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
