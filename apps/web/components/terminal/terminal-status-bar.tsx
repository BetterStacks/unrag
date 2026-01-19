'use client'

import {theme} from './terminal-theme'

const shortcuts = [
	{key: '1-7', action: 'tabs'},
	{key: 'j/k', action: 'navigate'},
	{key: 'enter', action: 'select'},
	{key: '?', action: 'help'},
	{key: 'q', action: 'quit'}
]

export function TerminalStatusBar() {
	return (
		<div className="flex items-center gap-4 px-4 py-1.5 border-t border-white/10 text-[10px]">
			{shortcuts.map((shortcut) => (
				<div key={shortcut.key} className="flex items-center gap-1">
					<span
						className="px-1 py-0.5 text-black font-medium"
						style={{backgroundColor: theme.accent}}
					>
						{shortcut.key}
					</span>
					<span className="text-white/50">{shortcut.action}</span>
				</div>
			))}
		</div>
	)
}
