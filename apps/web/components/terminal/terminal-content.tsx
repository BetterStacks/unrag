'use client'

import {AnimatePresence, motion} from 'motion/react'
import {useTerminal} from './terminal-context'
import {TerminalDashboard} from './terminal-dashboard'
import {TerminalDocs} from './terminal-docs'
import {TerminalEvents} from './terminal-events'
import {TerminalQuery} from './terminal-query'
import {TerminalTraces} from './terminal-traces'

export function TerminalContent() {
	const {activeTab} = useTerminal()

	return (
		<div className="h-[360px] overflow-hidden">
			<AnimatePresence mode="wait">
				<motion.div
					key={activeTab}
					initial={{opacity: 0}}
					animate={{opacity: 1}}
					exit={{opacity: 0}}
					transition={{duration: 0.15}}
					className="h-full"
				>
					{activeTab === 'dashboard' && <TerminalDashboard />}
					{activeTab === 'events' && <TerminalEvents />}
					{activeTab === 'traces' && <TerminalTraces />}
					{activeTab === 'query' && <TerminalQuery />}
					{activeTab === 'docs' && <TerminalDocs />}
					{activeTab !== 'dashboard' &&
						activeTab !== 'events' &&
						activeTab !== 'traces' &&
						activeTab !== 'query' &&
						activeTab !== 'docs' && <TerminalPlaceholder tab={activeTab} />}
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

function TerminalPlaceholder({tab}: {tab: string}) {
	return (
		<div className="h-full flex items-center justify-center text-white/40">
			<span className="text-xs">{tab.toUpperCase()} view</span>
		</div>
	)
}
