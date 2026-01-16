/**
 * Traces tab: groups events by opId and renders a simple waterfall/stage breakdown.
 */

import {useScrollWindow} from '@registry/debug/tui/hooks/useScrollWindow'
import {useTerminalSize} from '@registry/debug/tui/hooks/useTerminalSize'
import {
	chars,
	formatDuration,
	formatTime,
	theme,
	truncate
} from '@registry/debug/tui/theme'
import type {DebugEvent} from '@registry/debug/types'
import {Box, Text, useInput} from 'ink'
import {useMemo, useState} from 'react'

type TracesProps = {
	events: DebugEvent[]
}

type Stage = {
	id: string
	label: string
	ms: number
	color: string
}

type Trace = {
	opId: string
	opName: string
	startAt: number
	totalMs?: number
	label: string
	hasError: boolean
	stages: Stage[]
	events: DebugEvent[]
}

function inferOpName(e: DebugEvent): string {
	if (e.opName) {
		return e.opName
	}
	const t = e.type
	if (t.startsWith('ingest')) {
		return 'ingest'
	}
	if (t.startsWith('retrieve')) {
		return 'retrieve'
	}
	if (t.startsWith('rerank')) {
		return 'rerank'
	}
	if (t.startsWith('delete')) {
		return 'delete'
	}
	return 'op'
}

function inferLabel(opName: string, events: DebugEvent[]): string {
	const byType = <T extends DebugEvent['type']>(type: T) =>
		events.find((e): e is Extract<DebugEvent, {type: T}> => e.type === type)

	if (opName === 'ingest') {
		const start = byType('ingest:start')
		return start?.sourceId ? `source ${String(start.sourceId)}` : 'ingest'
	}
	if (opName === 'retrieve') {
		const start = byType('retrieve:start')
		return start?.query
			? `q ${truncate(String(start.query), 52)}`
			: 'retrieve'
	}
	if (opName === 'rerank') {
		const start = byType('rerank:start')
		return start?.query
			? `q ${truncate(String(start.query), 52)}`
			: 'rerank'
	}
	if (opName === 'delete') {
		const start = byType('delete:start')
		if (start?.mode && start?.value) {
			return `${String(start.mode)} ${String(start.value)}`
		}
		return 'delete'
	}
	return opName
}

function computeStages(
	opName: string,
	events: DebugEvent[]
): {totalMs?: number; stages: Stage[]} {
	const find = <T extends DebugEvent['type']>(type: T) =>
		events.find((e): e is Extract<DebugEvent, {type: T}> => e.type === type)
	const stages: Stage[] = []

	if (opName === 'ingest') {
		const chunking = find('ingest:chunking-complete')?.durationMs
		const embedding = find('ingest:embedding-complete')?.durationMs
		const storage = find('ingest:storage-complete')?.durationMs
		const total = find('ingest:complete')?.totalDurationMs

		if (typeof chunking === 'number') {
			stages.push({
				id: 'chunking',
				label: 'chunking',
				ms: chunking,
				color: theme.muted
			})
		}
		if (typeof embedding === 'number') {
			stages.push({
				id: 'embedding',
				label: 'embedding',
				ms: embedding,
				color: theme.ingest
			})
		}
		if (typeof storage === 'number') {
			stages.push({
				id: 'storage',
				label: 'storage',
				ms: storage,
				color: theme.borderActive
			})
		}
		return {totalMs: total, stages}
	}

	if (opName === 'retrieve') {
		const complete = find('retrieve:complete')
		const total = complete?.totalDurationMs
		const embedding = complete?.embeddingMs
		const retrieval = complete?.retrievalMs
		if (typeof embedding === 'number') {
			stages.push({
				id: 'embedding',
				label: 'embedding',
				ms: embedding,
				color: theme.retrieve
			})
		}
		if (typeof retrieval === 'number') {
			stages.push({
				id: 'db',
				label: 'db',
				ms: retrieval,
				color: theme.borderActive
			})
		}
		return {totalMs: total, stages}
	}

	if (opName === 'rerank') {
		const complete = find('rerank:complete')
		const total = complete?.totalMs
		const rerankMs = complete?.rerankMs
		if (typeof rerankMs === 'number') {
			stages.push({
				id: 'rerank',
				label: 'rerank',
				ms: rerankMs,
				color: theme.rerank
			})
		}
		return {totalMs: total, stages}
	}

	if (opName === 'delete') {
		const complete = find('delete:complete')
		const total = complete?.durationMs
		if (typeof total === 'number') {
			stages.push({
				id: 'delete',
				label: 'delete',
				ms: total,
				color: theme.delete
			})
		}
		return {totalMs: total, stages}
	}

	return {stages}
}

function computeTraces(events: DebugEvent[]): Trace[] {
	const map = new Map<string, DebugEvent[]>()
	for (const e of events) {
		const opId = e.opId ?? 'uncorrelated'
		const arr = map.get(opId)
		if (arr) {
			arr.push(e)
		} else {
			map.set(opId, [e])
		}
	}

	const traces: Trace[] = []
	for (const [opId, evs] of map) {
		evs.sort((a, b) => a.timestamp - b.timestamp)
		const first = evs[0]
		if (!first) {
			continue
		}
		const startAt = first.timestamp
		const opName = inferOpName(first)
		const {totalMs, stages} = computeStages(opName, evs)
		const hasError = evs.some((e) => e.type.includes('error'))
		traces.push({
			opId,
			opName,
			startAt,
			totalMs,
			label: inferLabel(opName, evs),
			hasError,
			stages,
			events: evs
		})
	}

	// newest first (ignore uncorrelated ordering edge cases)
	traces.sort((a, b) => b.startAt - a.startAt)
	return traces
}

function StageBars({
	stages,
	totalMs,
	width
}: {stages: Stage[]; totalMs?: number; width: number}) {
	if (!stages.length) {
		return <Text color={theme.muted}>No stage timings yet.</Text>
	}
	const denom = Math.max(1, totalMs ?? stages.reduce((s, x) => s + x.ms, 0))
	const barW = Math.max(12, Math.min(60, width))
	return (
		<Box flexDirection="column" gap={0}>
			{stages.map((s) => {
				const n = Math.max(1, Math.round((s.ms / denom) * barW))
				const bar = chars.fullBlock.repeat(n)
				return (
					<Box key={s.id} gap={1}>
						<Text color={theme.muted}>
							{truncate(s.label.toUpperCase().padEnd(10), 10)}
						</Text>
						<Text color={theme.fg}>
							{formatDuration(s.ms).padStart(8)}
						</Text>
						<Text color={s.color}>{bar}</Text>
					</Box>
				)
			})}
		</Box>
	)
}

export function Traces({events}: TracesProps) {
	const traces = useMemo(() => computeTraces(events), [events])
	const [selectedIndex, setSelectedIndex] = useState(0)
	const {columns, rows} = useTerminalSize()
	const canSplit = columns >= 120

	const maxIndex = Math.max(0, traces.length - 1)
	const boundedIndex = Math.min(selectedIndex, maxIndex)
	const selected = traces[boundedIndex]
	const listViewportRows = Math.max(
		6,
		Math.min(28, rows - (canSplit ? 16 : 18))
	)
	const scroll = useScrollWindow({
		itemCount: traces.length,
		selectedIndex: boundedIndex,
		viewportRows: listViewportRows
	})
	const rightEventsRows = Math.max(
		4,
		Math.min(18, rows - (canSplit ? 26 : 28))
	)

	useInput((input, key) => {
		if (key.upArrow || input === 'k') {
			setSelectedIndex((p) => Math.max(0, p - 1))
		}
		if (key.downArrow || input === 'j') {
			setSelectedIndex((p) => Math.min(maxIndex, p + 1))
		}
	})

	return (
		<Box flexDirection="column" flexGrow={1} paddingY={1}>
			<Box justifyContent="space-between" marginBottom={1}>
				<Box gap={1}>
					<Text backgroundColor={theme.border} color={theme.fg}>
						{' '}
						TRACES{' '}
					</Text>
					<Text color={theme.muted}>j/k navigate</Text>
				</Box>
				<Text color={theme.fg} bold>
					{traces.length}
				</Text>
			</Box>

			<Box
				flexDirection={canSplit ? 'row' : 'column'}
				flexGrow={1}
				gap={2}
			>
				{/* Left list */}
				<Box
					flexDirection="column"
					borderStyle="single"
					borderColor={theme.borderActive}
					paddingX={1}
					paddingY={0}
					width={canSplit ? Math.floor(columns * 0.5) : undefined}
					flexGrow={1}
				>
					{traces.length === 0 ? (
						<Text color={theme.muted}>
							No traced operations yet.
						</Text>
					) : (
						traces
							.slice(scroll.windowStart, scroll.windowEnd)
							.map((t, idx) => {
								const i = scroll.windowStart + idx
								const isSel = i === boundedIndex
								return (
									<Box key={`${t.opId}-${t.startAt}`} gap={1}>
										<Text
											color={
												isSel
													? theme.accent
													: theme.muted
											}
											bold={isSel}
										>
											{isSel ? chars.pointer : ' '}
										</Text>
										<Text color={theme.muted}>
											{formatTime(t.startAt)}
										</Text>
										<Text
											color={
												t.hasError
													? theme.error
													: theme.fg
											}
											bold={isSel}
										>
											{t.opName.toUpperCase()}
										</Text>
										<Text color={theme.muted}>·</Text>
										<Text color={theme.fg}>
											{truncate(
												t.label,
												canSplit ? 54 : 42
											)}
										</Text>
										{typeof t.totalMs === 'number' && (
											<Text color={theme.muted}>
												({formatDuration(t.totalMs)})
											</Text>
										)}
									</Box>
								)
							})
					)}
				</Box>

				{/* Right details */}
				<Box
					flexDirection="column"
					borderStyle="single"
					borderColor={theme.border}
					paddingX={1}
					paddingY={0}
					width={canSplit ? Math.floor(columns * 0.5) : undefined}
					flexGrow={1}
				>
					{!selected ? (
						<Text color={theme.muted}>
							Select a trace to inspect.
						</Text>
					) : (
						<>
							<Box marginBottom={1} gap={1}>
								<Text
									backgroundColor={theme.accent}
									color="black"
									bold
								>
									{' '}
									WATERFALL{' '}
								</Text>
								<Text color={theme.muted}>
									{selected.opId === 'uncorrelated'
										? 'uncorrelated'
										: truncate(selected.opId, 16)}
								</Text>
							</Box>

							<StageBars
								stages={selected.stages}
								totalMs={selected.totalMs}
								width={canSplit ? 52 : 40}
							/>

							<Box marginTop={1} marginBottom={1}>
								<Text
									backgroundColor={theme.border}
									color={theme.fg}
								>
									{' '}
									EVENTS{' '}
								</Text>
								<Text color={theme.muted}>
									{' '}
									{Math.min(
										selected.events.length,
										rightEventsRows
									)}{' '}
									shown
								</Text>
							</Box>

							<Box flexDirection="column">
								{selected.events
									.slice(-rightEventsRows)
									.map((e, idx) => (
										<Box
											key={`${e.timestamp}-${idx}`}
											gap={1}
										>
											<Text color={theme.muted}>
												{formatTime(e.timestamp)}
											</Text>
											<Text color={theme.fg}>
												{truncate(e.type, 36)}
											</Text>
										</Box>
									))}
								{selected.events.length > rightEventsRows && (
									<Text color={theme.muted}>
										{chars.arrow}{' '}
										{selected.events.length -
											rightEventsRows}{' '}
										more
									</Text>
								)}
							</Box>
						</>
					)}
				</Box>
			</Box>
		</Box>
	)
}

export default Traces
