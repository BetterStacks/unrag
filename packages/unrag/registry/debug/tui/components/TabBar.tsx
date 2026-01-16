import {theme} from '@registry/debug/tui/theme'
import {Box, Text} from 'ink'

type TabDefinition = {
	id: string
	label: string
	shortcut?: string
}

type TabBarProps = {
	tabs: TabDefinition[]
	activeTab: string
	onSelect: (tabId: string) => void
}

export function TabBar({tabs, activeTab}: TabBarProps) {
	return (
		<Box paddingX={1} paddingY={1} gap={2}>
			{tabs.map((tab) => {
				const isActive = tab.id === activeTab

				return (
					<Box key={tab.id}>
						{isActive ? (
							<Text
								backgroundColor={theme.accent}
								color="black"
								bold
							>
								{' '}
								{tab.shortcut} {tab.label.toUpperCase()}{' '}
							</Text>
						) : (
							<Text color={theme.muted}>
								{' '}
								{tab.shortcut} {tab.label}{' '}
							</Text>
						)}
					</Box>
				)
			})}
		</Box>
	)
}

export default TabBar
