'use client'

import {clsx} from 'clsx/lite'
import {useState, useEffect, useRef} from 'react'
import {useTerminal} from './terminal-context'
import {chars, theme} from './terminal-theme'

const EXAMPLE_QUERY = 'how does unrag ingest work?'
const TYPING_SPEED = 60

export function TerminalQuery() {
	const {queryResults, lastQuery, runQuery, hasUserInteracted, stopAllAnimations} = useTerminal()
	const [query, setQuery] = useState(lastQuery || '')
	const [isTyping, setIsTyping] = useState(!lastQuery && !hasUserInteracted)
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [hasInteracted, setHasInteracted] = useState(!!lastQuery || hasUserInteracted)
	const inputRef = useRef<HTMLInputElement>(null)

	// Stop typing if global interaction happened
	useEffect(() => {
		if (hasUserInteracted) {
			setHasInteracted(true)
			setIsTyping(false)
		}
	}, [hasUserInteracted])

	// Sync query with lastQuery from context when component mounts
	useEffect(() => {
		if (lastQuery && !query) {
			setQuery(lastQuery)
			setHasInteracted(true)
			setIsTyping(false)
		}
	}, [lastQuery, query])

	// Typing animation effect
	useEffect(() => {
		if (!isTyping || hasInteracted || hasUserInteracted) return

		let charIndex = 0
		const typeInterval = setInterval(() => {
			if (charIndex < EXAMPLE_QUERY.length) {
				setQuery(EXAMPLE_QUERY.slice(0, charIndex + 1))
				charIndex++
			} else {
				clearInterval(typeInterval)
				setIsTyping(false)
				// Auto-run query after typing animation
				setTimeout(() => {
					runQuery(EXAMPLE_QUERY)
				}, 500)
			}
		}, TYPING_SPEED)

		return () => {
			clearInterval(typeInterval)
		}
	}, [isTyping, hasInteracted, hasUserInteracted, runQuery])

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
		if (query.trim()) {
			runQuery(query)
		}
	}

	// Show results if we have any in context
	const showResults = queryResults.length > 0
	const selectedResult = queryResults[selectedIndex]

	return (
		<div className="flex flex-col h-full">
			{/* Query input */}
			<div className="px-4 py-3 border-b border-white/10">
				<form onSubmit={handleSubmit} className="flex items-center gap-2">
					<span className="text-[10px] text-white/40">{chars.arrow}</span>
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={handleChange}
						onFocus={handleFocus}
						placeholder="Enter your query..."
						className="flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/30"
					/>
					<span className="text-[10px] text-white/30">k=8</span>
					<button
						type="submit"
						className="text-[10px] px-2 py-0.5 text-black font-medium"
						style={{backgroundColor: theme.accent}}
					>
						SEARCH
					</button>
				</form>
			</div>

			{/* Results area */}
			<div className="flex flex-1 min-h-0">
				{/* Results list */}
				<div className="flex-1 flex flex-col border-r border-white/10">
					<div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-white/40 bg-white/10 px-1.5 py-0.5">
								RESULTS
							</span>
							<span className="text-[10px] text-white/30">
								j/k navigate · enter inspect
							</span>
						</div>
						{showResults && (
							<span className="text-[10px] text-white font-bold">
								{queryResults.length}
							</span>
						)}
					</div>
					<div className="flex-1 overflow-y-auto">
						{showResults ? (
							queryResults.map((result, idx) => {
								const isSelected = idx === selectedIndex
								return (
									<button
										key={result.id}
										type="button"
										onClick={() => setSelectedIndex(idx)}
										className={clsx(
											'w-full text-left px-4 py-1.5 text-[10px] flex items-center gap-3 transition-colors',
											isSelected
												? 'text-white font-medium'
												: 'text-white/50 hover:text-white/70'
										)}
									>
										<span
											className={
												isSelected ? 'text-green-400' : 'text-white/40'
											}
										>
											{chars.check}
										</span>
										<span className="opacity-60 tabular-nums">
											{result.score.toFixed(2)}
										</span>
										<span className="flex-1 truncate">
											{result.sourceId}
										</span>
									</button>
								)
							})
						) : (
							<div className="px-4 py-8 text-center text-[10px] text-white/30">
								{isTyping
									? 'Typing query...'
									: 'Enter a query and press SEARCH'}
							</div>
						)}
					</div>
				</div>

				{/* Details panel */}
				<div className="w-[45%] flex flex-col">
					<div className="px-4 py-2 border-b border-white/10">
						<span
							className="text-[10px] font-medium px-1.5 py-0.5 text-black"
							style={{backgroundColor: theme.accent}}
						>
							PREVIEW
						</span>
					</div>
					{showResults && selectedResult ? (
						<div className="flex-1 p-4 text-[10px]">
							<div className="flex items-center gap-2 mb-3">
								<span
									className="px-1.5 py-0.5 text-black font-medium tabular-nums"
									style={{backgroundColor: theme.accent}}
								>
									{selectedResult.score.toFixed(2)}
								</span>
								<span className="text-white/40">relevance</span>
							</div>
							<div className="space-y-2">
								<div className="flex gap-3">
									<span className="text-white/40 w-12">source</span>
									<span className="text-white truncate">
										{selectedResult.sourceId}
									</span>
								</div>
								<div className="flex gap-3">
									<span className="text-white/40 w-12">chunk</span>
									<span className="text-white/70 leading-relaxed">
										{selectedResult.content}
									</span>
								</div>
							</div>
						</div>
					) : (
						<div className="flex-1 p-4 text-[10px] text-white/30">
							Select a result to view details
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
