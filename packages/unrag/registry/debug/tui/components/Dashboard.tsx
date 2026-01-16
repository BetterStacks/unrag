/**
 * Dashboard component showing overview statistics and recent events.
 */

import {EventRow} from '@registry/debug/tui/components/EventRow'
import {MetricCard} from '@registry/debug/tui/components/MetricCard'
import {Sparkline} from '@registry/debug/tui/components/Sparkline'
import {chars, theme} from '@registry/debug/tui/theme'
import type {DebugConnection, DebugEvent} from '@registry/debug/types'
import {Box, Text} from 'ink'
import {useMemo} from 'react'

type DashboardProps = {
	events: DebugEvent[]
	connection: DebugConnection
}

type Stats = {
	ingest: {count: number; lastMs?: number; lastAt?: number; avgMs?: number}
	retrieve: {count: number; lastMs?: number; lastAt?: number; avgMs?: number}
	rerank: {count: number; lastMs?: number; lastAt?: number; avgMs?: number}
	delete: {count: number; lastMs?: number; lastAt?: number; avgMs?: number}
	errors: number
	latencyHistory: number[]
}

function computeStats(events: DebugEvent[]): Stats {
	const stats: Stats = {
		ingest: {count: 0},
		retrieve: {count: 0},
		rerank: {count: 0},
		delete: {count: 0},
		errors: 0,
		latencyHistory: []
	}

	const ingestWindow: number[] = []
	const retrieveWindow: number[] = []
	const rerankWindow: number[] = []
	const deleteWindow: number[] = []

	const pushWindow = (arr: number[], value: number) => {
		arr.push(value)
		if (arr.length > 10) {
			arr.shift()
		}
	}

	for (const event of events) {
		switch (event.type) {
			case 'ingest:complete':
				stats.ingest.count++
				stats.ingest.lastMs = event.totalDurationMs
				stats.ingest.lastAt = event.timestamp
				pushWindow(ingestWindow, event.totalDurationMs)
				stats.latencyHistory.push(event.totalDurationMs)
				break
			case 'retrieve:complete':
				stats.retrieve.count++
				stats.retrieve.lastMs = event.totalDurationMs
				stats.retrieve.lastAt = event.timestamp
				pushWindow(retrieveWindow, event.totalDurationMs)
				stats.latencyHistory.push(event.totalDurationMs)
				break
			case 'rerank:complete':
				stats.rerank.count++
				stats.rerank.lastMs = event.totalMs
				stats.rerank.lastAt = event.timestamp
				pushWindow(rerankWindow, event.totalMs)
				stats.latencyHistory.push(event.totalMs)
				break
			case 'delete:complete':
				stats.delete.count++
				stats.delete.lastMs = event.durationMs
				stats.delete.lastAt = event.timestamp
				pushWindow(deleteWindow, event.durationMs)
				stats.latencyHistory.push(event.durationMs)
				break
			case 'ingest:error':
				stats.errors++
				break
		}
	}

	const avg = (arr: number[]) =>
		arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : undefined
	stats.ingest.avgMs = avg(ingestWindow)
	stats.retrieve.avgMs = avg(retrieveWindow)
	stats.rerank.avgMs = avg(rerankWindow)
	stats.delete.avgMs = avg(deleteWindow)

	// Keep only last 30 latency points
	stats.latencyHistory = stats.latencyHistory.slice(-30)

	return stats
}

function SectionHeader({title}: {title: string}) {
	return (
		<Box marginBottom={1}>
			<Text backgroundColor={theme.border} color={theme.fg} bold>
				{' '}
				{chars.section} {title.toUpperCase()}{' '}
			</Text>
		</Box>
	)
}

export function Dashboard({events, connection}: DashboardProps) {
	const stats = useMemo(() => computeStats(events), [events])
	const recentEvents = useMemo(() => events.slice(-10).reverse(), [events])

	return (
		<Box flexDirection="column" paddingY={1}>
			{/* Stats row */}
			<Box flexDirection="column">
				<SectionHeader title="Operations" />
				<Box gap={2} paddingX={1} paddingY={1} width="100%">
					<MetricCard
						title="INGEST"
						count={stats.ingest.count}
						lastMs={stats.ingest.lastMs}
						avgMs={stats.ingest.avgMs}
						lastAt={stats.ingest.lastAt}
						color={theme.muted}
					/>
					<MetricCard
						title="RETRIEVE"
						count={stats.retrieve.count}
						lastMs={stats.retrieve.lastMs}
						avgMs={stats.retrieve.avgMs}
						lastAt={stats.retrieve.lastAt}
						color={theme.muted}
					/>
					<MetricCard
						title="RERANK"
						count={stats.rerank.count}
						lastMs={stats.rerank.lastMs}
						avgMs={stats.rerank.avgMs}
						lastAt={stats.rerank.lastAt}
						color={theme.muted}
					/>
					<MetricCard
						title="DELETE"
						count={stats.delete.count}
						lastMs={stats.delete.lastMs}
						avgMs={stats.delete.avgMs}
						lastAt={stats.delete.lastAt}
						color={theme.muted}
					/>
					{stats.errors > 0 && (
						<Box gap={1}>
							<Text
								backgroundColor={theme.error}
								color="white"
								bold
							>
								{' '}
								{chars.cross} {stats.errors} ERRORS{' '}
							</Text>
						</Box>
					)}
				</Box>
			</Box>

			{/* Latency sparkline */}
			{stats.latencyHistory.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<SectionHeader title="Latency" />
					<Box paddingX={1}>
						<Sparkline data={stats.latencyHistory} width={60} />
					</Box>
				</Box>
			)}

			{/* Recent events */}
			<Box flexDirection="column" marginTop={1}>
				<SectionHeader title="Recent Events" />
				<Box
					flexDirection="column"
					borderStyle="single"
					borderColor={theme.borderActive}
					paddingX={1}
					paddingY={0}
				>
					{recentEvents.length === 0 ? (
						<Text color={theme.muted}>Waiting for events…</Text>
					) : (
						recentEvents.map((event, i) => (
							<EventRow
								key={`${event.timestamp}-${i}`}
								event={event}
								compact
							/>
						))
					)}
				</Box>
			</Box>
		</Box>
	)
}

export default Dashboard
