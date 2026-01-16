/**
 * Hook for managing debug event stream.
 */

import type {DebugConnection, DebugEvent} from '@registry/debug/types'
import {useEffect, useState} from 'react'

const MAX_EVENTS = 1000

export function useEvents(connection: DebugConnection): DebugEvent[] {
	const [events, setEvents] = useState<DebugEvent[]>([])

	useEffect(() => {
		// Subscribe to events
		const unsubscribe = connection.onEvent((event) => {
			setEvents((prev) => {
				const next = [...prev, event]
				// Keep only the last MAX_EVENTS
				if (next.length > MAX_EVENTS) {
					return next.slice(-MAX_EVENTS)
				}
				return next
			})
		})

		// Clear events when disconnected
		const unsubStatus = connection.onStatusChange((status) => {
			if (status === 'disconnected' || status === 'error') {
				// Optionally clear events on disconnect
				// setEvents([]);
			}
		})

		return () => {
			unsubscribe()
			unsubStatus()
		}
	}, [connection])

	return events
}

/**
 * Hook for filtering events by type.
 */
export function useFilteredEvents(
	events: DebugEvent[],
	filter: string | null
): DebugEvent[] {
	if (!filter) return events
	return events.filter((e) => e.type.startsWith(filter))
}

/**
 * Hook for computing event statistics.
 */
export function useEventStats(events: DebugEvent[]) {
	return {
		total: events.length,
		ingest: events.filter((e) => e.type.startsWith('ingest')).length,
		retrieve: events.filter((e) => e.type.startsWith('retrieve')).length,
		rerank: events.filter((e) => e.type.startsWith('rerank')).length,
		delete: events.filter((e) => e.type.startsWith('delete')).length,
		errors: events.filter((e) => e.type.includes('error')).length
	}
}

export default useEvents
