'use client'

import {clsx} from 'clsx/lite'
import {useState} from 'react'
import {useTerminal} from './terminal-context'
import {chars, theme} from './terminal-theme'
import type {TerminalTrace} from './terminal-types'

function WaterfallBar({
	stages,
	totalMs
}: {
	stages: TerminalTrace['stages']
	totalMs: number
}) {
	const maxWidth = 200
	return (
		<div className="space-y-1.5">
			{stages.map((stage, idx) => {
				const width = Math.max(20, (stage.ms / totalMs) * maxWidth)
				return (
					<div key={idx} className="flex items-center gap-3">
						<span className="text-[10px] text-white/40 w-20">
							{stage.name}
						</span>
						<span className="text-[10px] text-white tabular-nums w-16">
							{stage.ms}ms
						</span>
						<div
							className="h-3 rounded-sm"
							style={{
								width: `${width}px`,
								backgroundColor: stage.color
							}}
						/>
					</div>
				)
			})}
		</div>
	)
}

export function TerminalTraces() {
	const {traces} = useTerminal()
	const [selectedIndex, setSelectedIndex] = useState(0)
	const selectedTrace = traces[selectedIndex] as TerminalTrace | undefined

	// Empty state
	if (traces.length === 0) {
		return (
			<div className="flex flex-col h-full">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
					<div className="flex items-center gap-2">
						<span className="text-[10px] text-white/40 bg-white/10 px-1.5 py-0.5">
							TRACES
						</span>
						<span className="text-[10px] text-white/30">
							j/k navigate
						</span>
					</div>
					<span className="text-[10px] text-white font-bold">0</span>
				</div>

				{/* Empty state */}
				<div className="flex-1 flex items-center justify-center text-[10px] text-white/30">
					No traces yet. Run a query to see traces.
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
				<div className="flex items-center gap-2">
					<span className="text-[10px] text-white/40 bg-white/10 px-1.5 py-0.5">
						TRACES
					</span>
					<span className="text-[10px] text-white/30">j/k navigate</span>
				</div>
				<span className="text-[10px] text-white font-bold">
					{traces.length}
				</span>
			</div>

			{/* Main content */}
			<div className="flex flex-1 min-h-0">
				{/* Traces list */}
				<div className="flex-1 flex flex-col border-r border-white/10">
					<div className="flex-1 overflow-y-auto">
						{traces.map((trace, idx) => {
							const isSelected = idx === selectedIndex
							return (
								<button
									key={trace.id}
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
											isSelected ? 'text-white' : 'text-white/40'
										}
									>
										{isSelected ? chars.arrow : ' '}
									</span>
									<span className="text-white/40 tabular-nums">
										{trace.time}
									</span>
									<span
										className={
											isSelected
												? 'text-white font-bold'
												: 'text-white/70'
										}
									>
										{trace.opName}
									</span>
									<span className="text-white/40">·</span>
									<span className="text-white/70 flex-1 truncate">
										{trace.label}
									</span>
								</button>
							)
						})}
					</div>
				</div>

				{/* Details panel */}
				<div className="w-[50%] flex flex-col">
					{selectedTrace && (
						<div className="flex-1 p-4 text-[10px]">
							{/* Waterfall header */}
							<div className="flex items-center gap-2 mb-4">
								<span
									className="px-1.5 py-0.5 text-black font-medium"
									style={{backgroundColor: theme.accent}}
								>
									WATERFALL
								</span>
								<span className="text-white/40">{selectedTrace.id}</span>
							</div>

							{/* Stage bars */}
							<WaterfallBar
								stages={selectedTrace.stages}
								totalMs={Number.parseInt(selectedTrace.totalMs)}
							/>

							{/* Events section */}
							<div className="mt-6">
								<div className="flex items-center gap-2 mb-2">
									<span className="text-white/40 bg-white/10 px-1.5 py-0.5">
										EVENTS
									</span>
									<span className="text-white/30">
										{selectedTrace.events.length} shown
									</span>
								</div>
								<div className="space-y-0.5">
									{selectedTrace.events.map((event, idx) => (
										<div
											key={idx}
											className="flex items-center gap-3"
										>
											<span className="text-white/40 tabular-nums">
												{event.time}
											</span>
											<span className="text-white/70">
												{event.type}
											</span>
										</div>
									))}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
