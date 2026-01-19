'use client'

import {clsx} from 'clsx/lite'
import {useTerminal} from './terminal-context'
import {TABS, theme} from './terminal-theme'
import type {TabId} from './terminal-types'

export function TerminalTabBar() {
	const {activeTab, setActiveTab} = useTerminal()

	return (
		<div className="flex items-center gap-1 px-4 py-1.5 border-b border-white/10 overflow-x-auto">
			{TABS.map((tab) => {
				const isActive = activeTab === tab.id
				return (
					<button
						type="button"
						key={tab.id}
						onClick={() => setActiveTab(tab.id as TabId)}
						className={clsx(
							'px-2 py-0.5 text-[10px] transition-colors duration-150 whitespace-nowrap',
							isActive
								? 'text-black font-medium'
								: 'text-white/60 hover:text-white/80'
						)}
						style={
							isActive
								? {backgroundColor: theme.accent}
								: undefined
						}
					>
						{tab.shortcut} {tab.label}
					</button>
				)
			})}
		</div>
	)
}
