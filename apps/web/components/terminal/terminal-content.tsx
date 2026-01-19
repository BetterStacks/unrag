'use client'

import {AnimatePresence, motion} from 'motion/react'
import {useTerminal} from './terminal-context'
import {TerminalDashboard} from './terminal-dashboard'
import {TerminalDocs} from './terminal-docs'

export function TerminalContent() {
	const {activeTab} = useTerminal()

	return (
		<div className="h-[280px] overflow-hidden">
			<AnimatePresence mode="wait">
				<motion.div
					key={activeTab}
					initial={{opacity: 0}}
					animate={{opacity: 1}}
					exit={{opacity: 0}}
					transition={{duration: 0.15}}
					className="h-full"
				>
					{activeTab === 'docs' && <TerminalDocs />}
					{activeTab === 'dashboard' && <TerminalDashboard />}
					{activeTab !== 'docs' && activeTab !== 'dashboard' && (
						<TerminalPlaceholder tab={activeTab} />
					)}
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
