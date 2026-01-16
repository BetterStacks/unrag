import {
	chars,
	formatDuration,
	pad,
	theme,
	truncate
} from '@registry/debug/tui/theme'
import type {DebugEvent} from '@registry/debug/types'
import {Box, Text} from 'ink'

type EventDetailProps = {
	event: DebugEvent
}

function formatValue(value: unknown): string {
	if (typeof value === 'string') return value
	if (typeof value === 'number') return value.toLocaleString()
	if (typeof value === 'boolean') return value ? 'yes' : 'no'
	if (Array.isArray(value)) return `[${value.length}]`
	if (value === null || value === undefined) return '–'
	return JSON.stringify(value)
}

function Row({
	label,
	value,
	highlight
}: {label: string; value: unknown; highlight?: boolean}) {
	return (
		<Box>
			<Text color={theme.muted}>{pad(label, 14)}</Text>
			{highlight ? (
				<Text backgroundColor={theme.accent} color="black" bold>
					{' '}
					{truncate(formatValue(value), 40)}{' '}
				</Text>
			) : (
				<Text color={theme.fg} bold>
					{truncate(formatValue(value), 50)}
				</Text>
			)}
		</Box>
	)
}

export function EventDetail({event}: EventDetailProps) {
	const timestamp = new Date(event.timestamp).toLocaleTimeString('en-US', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	})

	// Extract event type info for colored header
	const eventColor = event.type.includes('error')
		? theme.error
		: event.type.startsWith('ingest')
			? theme.ingest
			: event.type.startsWith('retrieve')
				? theme.retrieve
				: event.type.startsWith('rerank')
					? theme.rerank
					: theme.delete

	// Common header
	const header = (
		<Box marginBottom={1} flexDirection="column">
			<Box gap={2}>
				<Text backgroundColor={eventColor} color="black" bold>
					{' '}
					{event.type.toUpperCase()}{' '}
				</Text>
				<Text color={theme.muted}>{timestamp}</Text>
			</Box>
		</Box>
	)

	// Event-specific fields
	const fields = (() => {
		switch (event.type) {
			case 'ingest:start':
				return (
					<>
						<Row label="source" value={event.sourceId} />
						<Row label="document" value={event.documentId} />
						<Row label="size" value={`${event.contentLength}b`} />
						<Row label="assets" value={event.assetCount} />
					</>
				)

			case 'ingest:chunking-complete':
				return (
					<>
						<Row label="source" value={event.sourceId} />
						<Row label="chunks" value={event.chunkCount} />
						<Row
							label="duration"
							value={formatDuration(event.durationMs)}
						/>
					</>
				)

			case 'ingest:embedding-start':
				return (
					<>
						<Row label="source" value={event.sourceId} />
						<Row label="chunks" value={event.chunkCount} />
						<Row label="provider" value={event.embeddingProvider} />
					</>
				)

			case 'ingest:embedding-batch':
				return (
					<>
						<Row
							label="batch"
							value={`${event.batchIndex + 1}/${event.batchSize}`}
						/>
						<Row
							label="duration"
							value={formatDuration(event.durationMs)}
						/>
					</>
				)

			case 'ingest:embedding-complete':
				return (
					<>
						<Row label="embeddings" value={event.totalEmbeddings} />
						<Row
							label="duration"
							value={formatDuration(event.durationMs)}
						/>
					</>
				)

			case 'ingest:storage-complete':
				return (
					<>
						<Row label="stored" value={event.chunksStored} />
						<Row
							label="duration"
							value={formatDuration(event.durationMs)}
						/>
					</>
				)

			case 'ingest:complete':
				return (
					<>
						<Row label="source" value={event.sourceId} />
						<Row label="chunks" value={event.totalChunks} />
						<Row
							label="total"
							value={formatDuration(event.totalDurationMs)}
							highlight
						/>
						{event.warnings.length > 0 && (
							<Row
								label="warnings"
								value={event.warnings.join(', ')}
							/>
						)}
					</>
				)

			case 'ingest:error':
				return (
					<>
						<Row label="source" value={event.sourceId} />
						<Box marginTop={1}>
							<Text color={theme.error}>
								{chars.cross} {event.error}
							</Text>
						</Box>
					</>
				)

			case 'retrieve:start':
				return (
					<>
						<Row label="query" value={event.query} />
						<Row label="topK" value={event.topK} />
						{event.scope && (
							<Row label="scope" value={event.scope} />
						)}
					</>
				)

			case 'retrieve:embedding-complete':
				return (
					<>
						<Row label="provider" value={event.embeddingProvider} />
						<Row
							label="dimension"
							value={event.embeddingDimension}
						/>
						<Row
							label="duration"
							value={formatDuration(event.durationMs)}
						/>
					</>
				)

			case 'retrieve:database-complete':
				return (
					<>
						<Row label="results" value={event.resultsCount} />
						<Row
							label="duration"
							value={formatDuration(event.durationMs)}
						/>
					</>
				)

			case 'retrieve:complete':
				return (
					<>
						<Row label="query" value={event.query} />
						<Row
							label="results"
							value={`${event.resultsCount}/${event.topK}`}
						/>
						<Row
							label="embed"
							value={formatDuration(event.embeddingMs)}
						/>
						<Row
							label="db"
							value={formatDuration(event.retrievalMs)}
						/>
						<Row
							label="total"
							value={formatDuration(event.totalDurationMs)}
							highlight
						/>
					</>
				)

			case 'rerank:start':
				return (
					<>
						<Row label="query" value={event.query} />
						<Row label="candidates" value={event.candidateCount} />
						<Row label="topK" value={event.topK} />
						<Row label="reranker" value={event.rerankerName} />
					</>
				)

			case 'rerank:complete':
				return (
					<>
						<Row
							label="in/out"
							value={`${event.inputCount}→${event.outputCount}`}
						/>
						<Row label="reranker" value={event.rerankerName} />
						{event.model && (
							<Row label="model" value={event.model} />
						)}
						<Row
							label="total"
							value={formatDuration(event.totalMs)}
							highlight
						/>
					</>
				)

			case 'delete:start':
				return (
					<>
						<Row label="mode" value={event.mode} />
						<Row label="target" value={event.value} />
					</>
				)

			case 'delete:complete':
				return (
					<>
						<Row label="mode" value={event.mode} />
						<Row label="target" value={event.value} />
						<Row
							label="duration"
							value={formatDuration(event.durationMs)}
							highlight
						/>
					</>
				)

			default:
				return null
		}
	})()

	return (
		<Box flexDirection="column">
			{header}
			<Box flexDirection="column">{fields}</Box>
		</Box>
	)
}

export default EventDetail
