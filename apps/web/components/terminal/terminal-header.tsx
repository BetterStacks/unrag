'use client'

import {mockSessionId} from './terminal-mock-data'
import {chars, theme} from './terminal-theme'

export function TerminalHeader() {
	const shortSessionId = mockSessionId.slice(0, 8)

	return (
		<div className="flex items-center justify-between border-y border-white/10 px-3 py-1 sm:px-4 sm:py-1.5">
			<div className="flex items-center gap-3">
				<span
					className="px-1.5 py-0.5 text-[9px] uppercase text-neutral-300 sm:text-[10px]"
					style={{backgroundColor: 'transparent'}}
				>
					Unrag debug
				</span>
				<span className="text-[9px] text-white/50 sm:text-[10px]">
					session {shortSessionId}...
				</span>
			</div>
			<div className="flex items-center gap-1.5">
				<span className="animate-pulse" style={{color: theme.success}}>
					{chars.dot}
				</span>
				<span
					className="text-[9px] sm:text-[10px]"
					style={{color: theme.success}}
				>
					LIVE
				</span>
			</div>
		</div>
	)
}
