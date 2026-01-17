import {chars, pad, theme} from '@registry/debug/tui/theme'
import {Box, Text, useInput} from 'ink'

type HelpOverlayProps = {
	onClose: () => void
}

type Shortcut = {
	keys: string
	desc: string
}

const SHORTCUTS: {section: string; items: Shortcut[]}[] = [
	{
		section: 'Navigation',
		items: [
			{keys: '1–8', desc: 'Jump to tab'},
			{keys: 'Shift+Tab', desc: 'Cycle tabs'},
			{keys: 'j / k', desc: 'Navigate list'},
			{keys: 'Enter', desc: 'Inspect event'},
			{keys: 'Esc', desc: 'Close panel'}
		]
	},
	{
		section: 'Filters',
		items: [
			{keys: 'a', desc: 'All events'},
			{keys: 'i', desc: 'Ingest only'},
			{keys: 'r', desc: 'Retrieve only'},
			{keys: 'k', desc: 'Rerank only'},
			{keys: 'd', desc: 'Delete only'}
		]
	},
	{
		section: 'General',
		items: [
			{keys: '?', desc: 'Toggle help'},
			{keys: 'q', desc: 'Quit'}
		]
	}
]

export function HelpOverlay({onClose}: HelpOverlayProps) {
	useInput((input, key) => {
		if (key.escape || key.return || input === '?' || input === 'h') {
			onClose()
		}
	})

	return (
		<Box
			flexDirection="column"
			borderStyle="double"
			borderColor={theme.accent}
			paddingX={2}
			paddingY={1}
			marginTop={1}
		>
			{/* Header */}
			<Box marginBottom={1}>
				<Text backgroundColor={theme.accent} color="black" bold>
					{' '}
					KEYBOARD SHORTCUTS{' '}
				</Text>
				<Text color={theme.muted}> press ? or esc to close</Text>
			</Box>

			{/* Shortcuts grid */}
			<Box gap={4}>
				{SHORTCUTS.map((group) => (
					<Box key={group.section} flexDirection="column">
						<Text color={theme.fg} bold>
							{group.section}
						</Text>
						{group.items.map((s) => (
							<Box key={`${group.section}:${s.keys}`}>
								<Text
									backgroundColor={theme.border}
									color={theme.fg}
								>
									{' '}
									{pad(s.keys, 8)}{' '}
								</Text>
								<Text color={theme.muted}> {s.desc}</Text>
							</Box>
						))}
					</Box>
				))}
			</Box>

			{/* Tip */}
			<Box marginTop={1}>
				<Text color={theme.warning}>
					{chars.arrow} Set UNRAG_DEBUG=true in your app ·
					ws://localhost:3847
				</Text>
			</Box>
		</Box>
	)
}

export default HelpOverlay
