import {chars, statusColor, theme, truncate} from '@registry/debug/tui/theme'
import type {DebugConnectionStatus} from '@registry/debug/types'
import {Box, Text} from 'ink'

type StatusBarProps = {
	hint: string
	eventCount: number
	status: DebugConnectionStatus
	url?: string
	errorMessage?: string
}

export function StatusBar({
	hint,
	eventCount,
	status,
	url,
	errorMessage
}: StatusBarProps) {
	const color = statusColor(status)
	const endpoint = url ?? 'ws://localhost:3847'

	return (
		<Box
			paddingX={2}
			paddingY={0}
			justifyContent="space-between"
			borderStyle="single"
			borderColor={theme.border}
			borderTop={true}
			borderBottom={false}
			borderLeft={false}
			borderRight={false}
		>
			{/* Left: keyboard hints */}
			<Box gap={2}>
				{status === 'error' && errorMessage ? (
					<Text color={theme.error} bold>
						{chars.cross} {truncate(errorMessage, 120)}
					</Text>
				) : (
					<Text color={theme.muted}>{hint}</Text>
				)}
			</Box>

			{/* Right: stats */}
			<Box gap={3}>
				<Text color={theme.fg} bold>
					{eventCount}
				</Text>
				<Text color={theme.muted}>events</Text>
				<Text color={theme.muted}>{chars.v}</Text>
				<Box gap={1}>
					<Text color={color} bold>
						{chars.dot}
					</Text>
					<Text color={theme.fg}>{endpoint}</Text>
				</Box>
			</Box>
		</Box>
	)
}

export default StatusBar
