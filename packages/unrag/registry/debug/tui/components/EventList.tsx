/**
 * Event list component with filtering and details.
 */

import {EventDetail} from '@registry/debug/tui/components/EventDetail'
import {EventRow} from '@registry/debug/tui/components/EventRow'
import {useScrollWindow} from '@registry/debug/tui/hooks/useScrollWindow'
import {useTerminalSize} from '@registry/debug/tui/hooks/useTerminalSize'
import {theme} from '@registry/debug/tui/theme'
import type {DebugEvent} from '@registry/debug/types'
import {Box, Text, useInput} from 'ink'
import {useMemo, useState} from 'react'

type EventListProps = {
	events: DebugEvent[]
}

type FilterType = 'all' | 'ingest' | 'retrieve' | 'rerank' | 'delete'

const FILTERS: {
	id: FilterType
	label: string
	shortcut: string
	color: string
}[] = [
	{id: 'all', label: 'all', shortcut: 'a', color: theme.muted},
	{id: 'ingest', label: 'ingest', shortcut: 'i', color: theme.ingest},
	{id: 'retrieve', label: 'retrieve', shortcut: 'r', color: theme.retrieve},
	{id: 'rerank', label: 'rerank', shortcut: 'k', color: theme.rerank},
	{id: 'delete', label: 'delete', shortcut: 'd', color: theme.delete}
]

export function EventList({events}: EventListProps) {
	const [filter, setFilter] = useState<FilterType>('all')
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [showDetail, setShowDetail] = useState(false)
	const {columns, rows} = useTerminalSize()

	const filteredEvents = useMemo(() => {
		if (filter === 'all') return events
		return events.filter((e) => e.type.startsWith(filter))
	}, [events, filter])

	// Keep selection in bounds
	const maxIndex = Math.max(0, filteredEvents.length - 1)
	const boundedIndex = Math.min(selectedIndex, maxIndex)

	// Reverse to show newest first
	const displayEvents = useMemo(
		() => [...filteredEvents].reverse(),
		[filteredEvents]
	)

	const selectedEvent = displayEvents[boundedIndex]
	const canSplit = columns >= 120
	const listViewportRows = Math.max(
		6,
		Math.min(30, rows - (canSplit ? 16 : 18))
	)
	const scroll = useScrollWindow({
		itemCount: displayEvents.length,
		selectedIndex: boundedIndex,
		viewportRows: listViewportRows,
		resetKey: filter
	})

	useInput((input, key) => {
		// Filter shortcuts
		for (const f of FILTERS) {
			if (input === f.shortcut) {
				setFilter(f.id)
				setSelectedIndex(0)
				return
			}
		}

		// Navigation
		if (key.upArrow || input === 'k') {
			setSelectedIndex((prev) => Math.max(0, prev - 1))
			return
		}
		if (key.downArrow || input === 'j') {
			setSelectedIndex((prev) => Math.min(maxIndex, prev + 1))
			return
		}

		// Toggle detail view
		if (key.return || input === 'e') {
			setShowDetail((prev) => !prev)
			return
		}

		// Close detail view
		if (key.escape && showDetail) {
			setShowDetail(false)
			return
		}
	})

	return (
		<Box flexDirection="column" flexGrow={1} paddingY={1}>
			{/* Filter bar + count */}
			<Box justifyContent="space-between" marginBottom={1}>
				<Box gap={1}>
					{FILTERS.map((f) => {
						const isActive = filter === f.id
						return isActive ? (
							<Text
								key={f.id}
								backgroundColor={f.color}
								color="black"
								bold
							>
								{' '}
								{f.shortcut} {f.label.toUpperCase()}{' '}
							</Text>
						) : (
							<Text key={f.id} color={theme.muted}>
								{' '}
								{f.shortcut} {f.label}{' '}
							</Text>
						)
					})}
				</Box>
				<Text color={theme.fg} bold>
					{displayEvents.length}
				</Text>
			</Box>

			{/* Main content: list + detail panel */}
			<Box flexDirection={canSplit ? 'row' : 'column'} flexGrow={1}>
				{/* Event list */}
				<Box
					flexDirection="column"
					flexGrow={1}
					borderStyle="single"
					borderColor={theme.borderActive}
					paddingX={1}
					width={canSplit ? Math.floor(columns * 0.55) : undefined}
				>
					{/* List header */}
					<Box marginBottom={1} justifyContent="space-between">
						<Box gap={1}>
							<Text
								backgroundColor={theme.border}
								color={theme.fg}
							>
								{' '}
								EVENTS{' '}
							</Text>
							<Text color={theme.muted}>
								{' '}
								j/k navigate · enter inspect
							</Text>
						</Box>
						{displayEvents.length > 0 && (
							<Text color={theme.muted}>
								{scroll.windowStart + 1}-{scroll.windowEnd} of{' '}
								{displayEvents.length}
								{scroll.hasAbove || scroll.hasBelow
									? ` (${scroll.aboveCount}↑ ${scroll.belowCount}↓)`
									: ''}
							</Text>
						)}
					</Box>

					{/* Event rows */}
					<Box flexDirection="column">
						{displayEvents.length === 0 ? (
							<Text color={theme.muted}>No events.</Text>
						) : (
							displayEvents
								.slice(scroll.windowStart, scroll.windowEnd)
								.map((event, idx) => {
									const i = scroll.windowStart + idx
									return (
										<EventRow
											key={`${event.timestamp}-${i}`}
											event={event}
											selected={i === boundedIndex}
											compact={false}
										/>
									)
								})
						)}
					</Box>
				</Box>

				{/* Detail panel */}
				{(canSplit || showDetail) && (
					<Box
						flexDirection="column"
						flexGrow={1}
						marginLeft={canSplit ? 1 : 0}
						marginTop={!canSplit ? 1 : 0}
						borderStyle="single"
						borderColor={
							selectedEvent ? theme.accent : theme.border
						}
						paddingX={1}
					>
						{/* Detail header */}
						<Box marginBottom={1}>
							<Text
								backgroundColor={theme.accent}
								color="black"
								bold
							>
								{' '}
								DETAILS{' '}
							</Text>
							{!canSplit && (
								<Text color={theme.muted}>
									{' '}
									(enter to close)
								</Text>
							)}
						</Box>

						{/* Detail content */}
						{selectedEvent ? (
							<EventDetail event={selectedEvent} />
						) : (
							<Text color={theme.muted}>Select an event.</Text>
						)}
					</Box>
				)}
			</Box>
		</Box>
	)
}

export default EventList
