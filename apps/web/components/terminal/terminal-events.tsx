'use client'

import {clsx} from 'clsx/lite'
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

export function TerminalEvents() {
	const {events} = useTerminal()
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

	// Empty state
	if (events.length === 0) {
		return (
			<div className="flex flex-col h-full">
				{/* Filter bar */}
				<div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
					<div className="flex items-center gap-2">
						{filters.map((filter) => {
							const isActive = activeFilter === filter.id
							return (
								<button
									key={filter.id}
									type="button"
									onClick={() => setActiveFilter(filter.id)}
									className={clsx(
										'px-2 py-0.5 text-[10px] transition-colors',
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
					<span className="text-[10px] text-white font-bold">0</span>
				</div>

				{/* Empty state */}
				<div className="flex-1 flex items-center justify-center text-[10px] text-white/30">
					No events yet. Run a query to see events.
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Filter bar */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
				<div className="flex items-center gap-2">
					{filters.map((filter) => {
						const isActive = activeFilter === filter.id
						return (
							<button
								key={filter.id}
								type="button"
								onClick={() => setActiveFilter(filter.id)}
								className={clsx(
									'px-2 py-0.5 text-[10px] transition-colors',
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
				<span className="text-[10px] text-white font-bold">
					{filteredEvents.length}
				</span>
			</div>

			{/* Main content */}
			<div className="flex flex-1 min-h-0">
				{/* Events list */}
				<div className="flex-1 flex flex-col border-r border-white/10">
					<div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-white/40 bg-white/10 px-1.5 py-0.5">
								EVENTS
							</span>
							<span className="text-[10px] text-white/30">
								j/k navigate · enter inspect
							</span>
						</div>
						<span className="text-[10px] text-white/30">
							1-{filteredEvents.length} of {filteredEvents.length}
						</span>
					</div>
					<div className="flex-1 overflow-y-auto">
						{filteredEvents.map((event, idx) => {
							const isSelected = idx === selectedIndex
							const isComplete = event.type.includes('complete')
							return (
								<button
									key={event.id}
									type="button"
									onClick={() => setSelectedIndex(idx)}
									className={clsx(
										'w-full text-left px-4 py-1 text-[10px] flex items-center gap-3 transition-colors',
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
									<span>{event.type}</span>
									{event.results && (
										<>
											<span className="opacity-40">·</span>
											<span className="opacity-60">
												{event.results}
											</span>
										</>
									)}
									{event.duration && (
										<>
											<span className="opacity-40">·</span>
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
				<div className="w-[45%] flex flex-col">
					<div className="px-4 py-2 border-b border-white/10">
						<span
							className="text-[10px] font-medium px-1.5 py-0.5 text-black"
							style={{backgroundColor: theme.accent}}
						>
							DETAILS
						</span>
					</div>
					{selectedEvent && (
						<div className="flex-1 p-4 text-[10px]">
							<div className="flex items-center gap-2 mb-3">
								<span
									className="px-1.5 py-0.5 text-black font-medium"
									style={{backgroundColor: theme.accent}}
								>
									{selectedEvent.type.toUpperCase()}
								</span>
								<span className="text-white/40">
									{selectedEvent.time}
								</span>
							</div>
							<div className="space-y-1.5">
								{selectedEvent.query && (
									<div className="flex gap-3">
										<span className="text-white/40 w-12">
											query
										</span>
										<span className="text-white">
											{selectedEvent.query}
										</span>
									</div>
								)}
								{selectedEvent.results && (
									<div className="flex gap-3">
										<span className="text-white/40 w-12">
											results
										</span>
										<span className="text-white">
											{selectedEvent.results}
										</span>
									</div>
								)}
								{selectedEvent.embed && (
									<div className="flex gap-3">
										<span className="text-white/40 w-12">
											embed
										</span>
										<span className="text-white tabular-nums">
											{selectedEvent.embed}
										</span>
									</div>
								)}
								{selectedEvent.db && (
									<div className="flex gap-3">
										<span className="text-white/40 w-12">
											db
										</span>
										<span className="text-white tabular-nums">
											{selectedEvent.db}
										</span>
									</div>
								)}
								{selectedEvent.total && (
									<div className="flex gap-3">
										<span className="text-white/40 w-12">
											total
										</span>
										<span
											className="px-1.5 py-0.5 text-black font-medium tabular-nums"
											style={{
												backgroundColor: theme.accent
											}}
										>
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
