'use client'

import {cn} from '@/lib/utils'
import {useHotkeys} from '@mantine/hooks'
import {useState} from 'react'
import {useTerminal} from './terminal-context'
import {chars} from './terminal-theme'
import type {TerminalTrace} from './terminal-types'

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
			{stages.map((stage) => {
				const width = Math.max(20, (stage.ms / totalMs) * maxWidth)
				return (
					<div
						key={`${stage.name}-${stage.ms}`}
						className="flex items-center gap-3"
					>
						<span className="text-[9px] text-white/40 w-16 sm:text-[10px] sm:w-20">
							{stage.name}
						</span>
						<span className="text-[9px] text-white tabular-nums w-14 sm:text-[10px] sm:w-16">
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
	const {traces, activeTab, hasUserInteracted, stopAllAnimations} =
		useTerminal()
	const [selectedIndex, setSelectedIndex] = useState(0)
	const selectedTrace = traces[selectedIndex] as TerminalTrace | undefined

	useHotkeys([
		[
			'j',
			() => {
				if (activeTab !== 'traces' || !hasUserInteracted) {
					return
				}
				if (isEditableTarget() || traces.length === 0) {
					return
				}
				stopAllAnimations()
				setSelectedIndex((prev) =>
					Math.min(prev + 1, traces.length - 1)
				)
			},
			{preventDefault: true}
		],
		[
			'k',
			() => {
				if (activeTab !== 'traces' || !hasUserInteracted) {
					return
				}
				if (isEditableTarget() || traces.length === 0) {
					return
				}
				stopAllAnimations()
				setSelectedIndex((prev) => Math.max(prev - 1, 0))
			},
			{preventDefault: true}
		]
	])

	// Empty state
	if (traces.length === 0) {
		return (
			<div className="flex flex-col h-full">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-white/10 px-3 py-2 sm:px-4">
					<div className="flex items-center gap-2">
						<span className="text-[9px] text-white/40 bg-white/10 px-1.5 py-0.5 sm:text-[10px]">
							TRACES
						</span>
						<span className="text-[9px] text-white/30 sm:text-[10px]">
							j/k navigate
						</span>
					</div>
					<span className="text-[9px] font-bold text-white sm:text-[10px]">
						0
					</span>
				</div>

				{/* Empty state */}
				<div className="flex flex-1 items-center justify-center text-[9px] text-white/30 text-pretty sm:text-[10px]">
					No traces yet. Run a query to see traces.
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-white/10 px-3 py-2 sm:px-4">
				<div className="flex items-center gap-2">
					<span className="bg-white/10 px-1.5 py-0.5 text-[9px] text-white/40 sm:text-[10px]">
						TRACES
					</span>
					<span className="text-[9px] text-white/30 sm:text-[10px]">
						j/k navigate
					</span>
				</div>
				<span className="text-[9px] font-bold text-white sm:text-[10px]">
					{traces.length}
				</span>
			</div>

			{/* Main content */}
			<div className="flex flex-1 min-h-0 flex-col sm:flex-row">
				{/* Traces list */}
				<div className="flex flex-1 flex-col border-b border-white/10 sm:border-b-0 sm:border-r">
					<div className="flex-1 overflow-y-auto no-scrollbar">
						{traces.map((trace, idx) => {
							const isSelected = idx === selectedIndex
							return (
								<button
									key={trace.id}
									type="button"
									onClick={() => setSelectedIndex(idx)}
									className={cn(
										'w-full text-left px-3 py-1.5 text-[9px] flex items-center gap-3 transition-colors sm:px-4 sm:text-[10px]',
										isSelected
											? 'text-white font-medium'
											: 'text-white/50 hover:text-white/70'
									)}
								>
									<span
										className={cn(
											'w-3 text-center',
											isSelected
												? 'text-white'
												: 'text-transparent'
										)}
									>
										{chars.arrow}
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
				<div className="flex w-full flex-col border-t border-white/10 sm:w-[50%] sm:border-t-0">
					{selectedTrace && (
						<div className="flex-1 p-3 text-[9px] sm:p-4 sm:text-[10px]">
							{/* Waterfall header */}
							<div className="flex items-center gap-2 mb-4">
								<span className="text-neutral-500 font-medium text-[9px] sm:text-[10px]">
									WATERFALL
								</span>
								<span className="text-white/40 text-[9px] sm:text-[10px]">
									{selectedTrace.id}
								</span>
							</div>

							{/* Stage bars */}
							<WaterfallBar
								stages={selectedTrace.stages}
								totalMs={Number.parseInt(selectedTrace.totalMs)}
							/>

							{/* Events section */}
							<div className="mt-6">
								<div className="flex items-center gap-2 mb-2">
									<span className="text-white/40 bg-white/10 px-1.5 py-0.5 text-[9px] sm:text-[10px]">
										EVENTS
									</span>
									<span className="text-white/30 text-[9px] sm:text-[10px]">
										{selectedTrace.events.length} shown
									</span>
								</div>
								<div className="space-y-0.5">
									{selectedTrace.events.map((event) => (
										<div
											key={`${event.time}-${event.type}`}
											className="flex items-center gap-3"
										>
											<span className="text-white/40 tabular-nums text-[9px] sm:text-[10px]">
												{event.time}
											</span>
											<span className="text-white/70 text-[9px] sm:text-[10px]">
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
