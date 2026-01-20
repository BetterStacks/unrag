'use client'

import {cn} from '@/lib/utils'
import {useHotkeys} from '@mantine/hooks'
import {useState} from 'react'
import {useTerminal} from './terminal-context'
import {chars, theme} from './terminal-theme'
import type {TerminalEvent} from './terminal-types'

const filters = [
	{id: 'all', label: 'ALL', shortcut: 'a'},
	{id: 'ingest', label: 'ingest', shortcut: 'i'},
	{id: 'retrieve', label: 'retrieve', shortcut: 'r'},
	{id: 'rerank', label: 'rerank', shortcut: 'k'},
	{id: 'delete', label: 'delete', shortcut: 'd'}
]

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

export function TerminalEvents() {
	const {events, activeTab, hasUserInteracted, stopAllAnimations} =
		useTerminal()
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [activeFilter, setActiveFilter] = useState('all')

	// Filter events based on active filter
	const filteredEvents =
		activeFilter === 'all'
			? events
			: events.filter((e) => e.type.startsWith(activeFilter))

	const selectedEvent = filteredEvents[selectedIndex] as
		| TerminalEvent
		| undefined
	const queryLabel = selectedEvent?.type.startsWith('ingest')
		? 'source'
		: 'query'

	useHotkeys([
		[
			'j',
			() => {
				if (activeTab !== 'events' || !hasUserInteracted) {
					return
				}
				if (isEditableTarget() || filteredEvents.length === 0) {
					return
				}
				stopAllAnimations()
				setSelectedIndex((prev) =>
					Math.min(prev + 1, filteredEvents.length - 1)
				)
			},
			{preventDefault: true}
		],
		[
			'k',
			() => {
				if (activeTab !== 'events' || !hasUserInteracted) {
					return
				}
				if (isEditableTarget() || filteredEvents.length === 0) {
					return
				}
				stopAllAnimations()
				setSelectedIndex((prev) => Math.max(prev - 1, 0))
			},
			{preventDefault: true}
		]
	])

	// Empty state
	if (events.length === 0) {
		return (
			<div className="flex flex-col h-full">
				{/* Filter bar */}
				<div className="flex items-center justify-between border-b border-white/10 px-3 py-2 sm:px-4">
					<div className="flex items-center gap-2">
						{filters.map((filter) => {
							const isActive = activeFilter === filter.id
							return (
								<button
									key={filter.id}
									type="button"
									onClick={() => setActiveFilter(filter.id)}
									className={cn(
										'px-2 py-0.5 text-[9px] transition-colors sm:text-[10px]',
										isActive
											? 'text-black font-medium'
											: 'text-white/50 hover:text-white/70'
									)}
									style={
										isActive
											? {backgroundColor: theme.accent}
											: undefined
									}
								>
									{filter.shortcut} {filter.label}
								</button>
							)
						})}
					</div>
					<span className="text-[9px] font-bold text-white sm:text-[10px]">
						0
					</span>
				</div>

				{/* Empty state */}
				<div className="flex flex-1 items-center justify-center text-[9px] text-white/30 text-pretty sm:text-[10px]">
					No events yet. Run a query to see events.
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Filter bar */}
			<div className="flex items-center justify-between border-b border-white/10 px-3 py-2 sm:px-4">
				<div className="flex items-center gap-2">
					{filters.map((filter) => {
						const isActive = activeFilter === filter.id
						return (
							<button
								key={filter.id}
								type="button"
								onClick={() => setActiveFilter(filter.id)}
								className={cn(
									'px-2 py-0.5 text-[9px] transition-colors sm:text-[10px]',
									isActive
										? 'text-black font-medium'
										: 'text-white/50 hover:text-white/70'
								)}
								style={
									isActive
										? {backgroundColor: theme.accent}
										: undefined
								}
							>
								{filter.shortcut} {filter.label}
							</button>
						)
					})}
				</div>
				<span className="text-[9px] font-bold text-white sm:text-[10px]">
					{filteredEvents.length}
				</span>
			</div>

			{/* Main content */}
			<div className="flex flex-1 min-h-0 flex-col sm:flex-row">
				{/* Events list */}
				<div className="flex flex-1 flex-col border-b border-white/10 sm:border-b-0 sm:border-r">
					<div className="flex items-center justify-between border-b border-white/10 px-3 py-2 sm:px-4">
						<div className="flex items-center gap-2">
							<span className="bg-white/10 px-1.5 py-0.5 text-[9px] text-white/40 sm:text-[10px]">
								EVENTS
							</span>
							<span className="text-[9px] text-white/30 sm:text-[10px]">
								j/k navigate · enter inspect
							</span>
						</div>
						<span className="text-[9px] text-white/30 sm:text-[10px]">
							1-{filteredEvents.length} of {filteredEvents.length}
						</span>
					</div>
					<div className="flex-1 overflow-y-auto no-scrollbar">
						{filteredEvents.map((event, idx) => {
							const isSelected = idx === selectedIndex
							const isComplete = event.type.includes('complete')
							return (
								<button
									key={event.id}
									type="button"
									onClick={() => setSelectedIndex(idx)}
									className={cn(
										'w-full min-w-0 text-left px-3 py-1 text-[9px] flex items-center gap-2 transition-colors sm:px-4 sm:py-1.5 sm:gap-3 sm:text-[10px]',
										isSelected
											? 'text-white font-medium'
											: 'text-white/50 hover:text-white/70'
									)}
								>
									<span
										className={
											isComplete
												? 'text-green-400'
												: 'text-white/40'
										}
									>
										{isComplete ? chars.check : chars.arrow}
									</span>
									<span className="opacity-60 tabular-nums">
										{event.time}
									</span>
									<span className="min-w-0 flex-1 truncate">
										{event.type}
									</span>
									{event.results && (
										<>
											<span className="opacity-40">
												·
											</span>
											<span className="opacity-60">
												{event.results}
											</span>
										</>
									)}
									{event.duration && (
										<>
											<span className="opacity-40">
												·
											</span>
											<span className="opacity-60 tabular-nums">
												{event.duration}
											</span>
										</>
									)}
								</button>
							)
						})}
					</div>
				</div>

				{/* Details panel */}
				<div className="flex w-full flex-col border-t border-white/10 sm:w-[45%] sm:border-t-0">
					<div className="border-b border-white/10 px-3 py-2 sm:px-4">
						<span className="text-[9px] font-medium text-neutral-500 sm:text-[10px]">
							DETAILS
						</span>
					</div>
					{selectedEvent && (
						<div className="flex-1 p-3 text-[9px] sm:p-4 sm:text-[10px]">
							<div className="flex items-center gap-2 mb-3">
								<span className="text-neutral-500 font-medium">
									{selectedEvent.type.toUpperCase()}
								</span>
								<span className="text-white/40">
									{selectedEvent.time}
								</span>
							</div>
							<div className="space-y-1.5">
								{selectedEvent.query && (
									<div className="flex gap-3">
										<span className="text-white/40 w-10 sm:w-12">
											{queryLabel}
										</span>
										<span className="text-white">
											{selectedEvent.query}
										</span>
									</div>
								)}
								{selectedEvent.results && (
									<div className="flex gap-3">
										<span className="text-white/40 w-10 sm:w-12">
											results
										</span>
										<span className="text-white">
											{selectedEvent.results}
										</span>
									</div>
								)}
								{selectedEvent.embed && (
									<div className="flex gap-3">
										<span className="text-white/40 w-10 sm:w-12">
											embed
										</span>
										<span className="text-white tabular-nums">
											{selectedEvent.embed}
										</span>
									</div>
								)}
								{selectedEvent.db && (
									<div className="flex gap-3">
										<span className="text-white/40 w-10 sm:w-12">
											db
										</span>
										<span className="text-white tabular-nums">
											{selectedEvent.db}
										</span>
									</div>
								)}
								{selectedEvent.total && (
									<div className="flex gap-3">
										<span className="text-white/40 w-10 sm:w-12">
											total
										</span>
										<span className="text-neutral-500 font-medium tabular-nums">
											{selectedEvent.total}
										</span>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
