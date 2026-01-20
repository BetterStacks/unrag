'use client'

import {mockSessionId} from './terminal-mock-data'
import {chars, theme} from './terminal-theme'

export function TerminalHeader() {
	const shortSessionId = mockSessionId.slice(0, 8)

	return (
		<div className="flex items-center justify-between px-4 py-1.5 border-y border-white/10">
			<div className="flex items-center gap-3">
				<span
					className="px-1.5 py-0.5 uppercase text-neutral-300 text-[10px]"
					style={{backgroundColor: 'transparent'}}
				>
					Unrag debug
				</span>
				<span className="text-white/50">
					session {shortSessionId}...
				</span>
			</div>
			<div className="flex items-center gap-1.5">
				<span className="animate-pulse" style={{color: theme.success}}>
					{chars.dot}
				</span>
				<span style={{color: theme.success}}>LIVE</span>
			</div>
		</div>
	)
}
