import {formatDuration, formatTime, theme} from '@registry/debug/tui/theme'
import {Box, Text} from 'ink'

type MetricCardProps = {
	title: string
	count: number
	lastMs?: number
	avgMs?: number
	lastAt?: number
	color: string
}

export function MetricCard({
	title,
	count,
	lastMs,
	avgMs,
	lastAt,
	color
}: MetricCardProps) {
	return (
		<Box
			flexDirection="column"
			borderStyle="single"
			borderColor={color}
			paddingX={2}
			paddingY={1}
			minWidth={22}
			flexGrow={1}
		>
			<Box justifyContent="space-between">
				<Text color={color} bold>
					{title}
				</Text>
				{lastAt !== undefined && (
					<Text color={theme.muted}>{formatTime(lastAt)}</Text>
				)}
			</Box>

			<Box marginTop={1} justifyContent="space-between">
				<Text color={theme.fg} bold>
					{count} ops
				</Text>
				<Text color={theme.muted}>
					last {lastMs !== undefined ? formatDuration(lastMs) : '—'}
				</Text>
			</Box>

			<Box justifyContent="space-between">
				<Text color={theme.muted}>
					avg {avgMs !== undefined ? formatDuration(avgMs) : '—'}
				</Text>
				<Text color={theme.dim}>window 10</Text>
			</Box>
		</Box>
	)
}

export default MetricCard
