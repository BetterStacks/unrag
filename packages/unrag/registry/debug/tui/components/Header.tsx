import {Logo} from '@registry/debug/tui/components/Logo'
import {
	chars,
	statusColor,
	statusLabel,
	theme,
	truncate
} from '@registry/debug/tui/theme'
import type {DebugConnectionStatus} from '@registry/debug/types'
import {Box, Text} from 'ink'

type HeaderProps = {
	title: string
	status: DebugConnectionStatus
	sessionId?: string
	columns: number
	rows: number
}

export function Header({title, status, sessionId, columns, rows}: HeaderProps) {
	const label = statusLabel(status)
	const color = statusColor(status)

	return (
		<Box flexDirection="column" paddingX={1} paddingY={1}>
			{/* ASCII logo (responsive downsample) */}
			<Logo columns={columns} rows={rows} />

			{/* Status strip */}
			<Box
				marginTop={1}
				width="100%"
				borderStyle="classic"
				borderColor={theme.accentBg}
				paddingX={1}
				justifyContent="space-between"
			>
				<Text color="black" bold>
					{title.toUpperCase()}
				</Text>

				<Box gap={2}>
					{sessionId && (
						<Text color="black">
							session {truncate(sessionId, 8)}
						</Text>
					)}
					<Box backgroundColor={color} paddingX={1}>
						<Text color="black" bold>
							{chars.dot} {label.toUpperCase()}
						</Text>
					</Box>
				</Box>
			</Box>
		</Box>
	)
}

export default Header
