'use client'

import {clsx} from 'clsx/lite'
import {useTerminal} from './terminal-context'
import {TABS, theme} from './terminal-theme'
import type {TabId} from './terminal-types'

export function TerminalTabBar() {
	const {activeTab, setActiveTab} = useTerminal()

	return (
		<div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-3 py-1 sm:flex-nowrap sm:px-4 sm:py-1.5">
			{TABS.map((tab) => {
				const isActive = activeTab === tab.id
				return (
					<button
						type="button"
						key={tab.id}
						onClick={() => setActiveTab(tab.id as TabId)}
						className={clsx(
							'whitespace-nowrap px-1.5 py-0.5 text-[9px] transition-colors duration-150 sm:px-2 sm:text-[10px]',
							isActive
								? 'text-black font-medium'
								: 'text-white/50 hover:text-white/70'
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
