/**
 * Main Debug TUI Application.
 *
 * Terminal interface for debugging Unrag RAG operations.
 * Uses Ink (React for CLI) for rendering.
 */

import {Dashboard} from '@registry/debug/tui/components/Dashboard'
import {Docs} from '@registry/debug/tui/components/Docs'
import {Doctor} from '@registry/debug/tui/components/Doctor'
import {Eval} from '@registry/debug/tui/components/Eval'
import {EventList} from '@registry/debug/tui/components/EventList'
import {Header} from '@registry/debug/tui/components/Header'
import {HelpOverlay} from '@registry/debug/tui/components/HelpOverlay'
import {Ingest} from '@registry/debug/tui/components/Ingest'
import {QueryRunner} from '@registry/debug/tui/components/QueryRunner'
import {StatusBar} from '@registry/debug/tui/components/StatusBar'
import {TabBar} from '@registry/debug/tui/components/TabBar'
import {Traces} from '@registry/debug/tui/components/Traces'
import {
	HotkeysLockProvider,
	useHotkeysLocked
} from '@registry/debug/tui/context/HotkeysLock'
import {useConnection} from '@registry/debug/tui/hooks/useConnection'
import {useEvents} from '@registry/debug/tui/hooks/useEvents'
import {useTerminalSize} from '@registry/debug/tui/hooks/useTerminalSize'
import {Box, render, useApp, useInput} from 'ink'
import {useCallback, useState} from 'react'

export type Tab =
	| 'dashboard'
	| 'events'
	| 'traces'
	| 'query'
	| 'docs'
	| 'ingest'
	| 'doctor'
	| 'eval'

type AppProps = {
	url?: string
}

export function App({url}: AppProps) {
	const [activeTab, setActiveTab] = useState<Tab>('dashboard')
	const [showHelp, setShowHelp] = useState(false)
	const {exit} = useApp()
	const {columns, rows} = useTerminalSize()
	const hotkeysLocked = useHotkeysLocked()

	const connection = useConnection(url)
	const events = useEvents(connection)

	// Tab navigation
	const tabs: Tab[] = [
		'dashboard',
		'events',
		'traces',
		'query',
		'docs',
		'ingest',
		'doctor',
		'eval'
	]

	const cycleTab = useCallback(
		(direction: 1 | -1) => {
			const currentIndex = tabs.indexOf(activeTab)
			const newIndex =
				(currentIndex + direction + tabs.length) % tabs.length
			setActiveTab(tabs[newIndex] ?? 'dashboard')
		},
		[activeTab, tabs]
	)

	// Keyboard handling
	useInput((input, key) => {
		// When a panel is in edit mode, disable App-level hotkeys so typing is safe.
		if (hotkeysLocked && !(key.ctrl && input === 'c')) {
			return
		}

		// Quit
		if (input === 'q' || (key.ctrl && input === 'c')) {
			connection.disconnect()
			exit()
			return
		}

		// Help toggle
		if (input === '?' || input === 'h') {
			setShowHelp((prev) => !prev)
			return
		}

		// Close help overlay if open
		if (showHelp && (key.escape || key.return)) {
			setShowHelp(false)
			return
		}

		// Tab navigation
		// Reserve plain Tab for in-panel focus (e.g. Docs tab). Use Shift+Tab to cycle panels.
		if (key.shift && key.tab) {
			cycleTab(-1)
			return
		}

		// Number keys for direct tab selection
		if (input === '1') setActiveTab('dashboard')
		if (input === '2') setActiveTab('events')
		if (input === '3') setActiveTab('traces')
		if (input === '4') setActiveTab('query')
		if (input === '5') setActiveTab('docs')
		if (input === '6') setActiveTab('ingest')
		if (input === '7') setActiveTab('doctor')
		if (input === '8') setActiveTab('eval')
	})

	return (
		<Box flexDirection="column" width="100%" height="100%">
			{/* Header bar */}
			<Header
				title="Unrag Debug"
				status={connection.status}
				sessionId={connection.sessionId}
				columns={columns}
				rows={rows}
			/>

			{/* Tab bar */}
			<TabBar
				tabs={[
					{id: 'dashboard', label: 'Dashboard', shortcut: '1'},
					{id: 'events', label: 'Events', shortcut: '2'},
					{id: 'traces', label: 'Traces', shortcut: '3'},
					{id: 'query', label: 'Query', shortcut: '4'},
					{id: 'docs', label: 'Docs', shortcut: '5'},
					{id: 'ingest', label: 'Ingest', shortcut: '6'},
					{id: 'doctor', label: 'Doctor', shortcut: '7'},
					{id: 'eval', label: 'Eval', shortcut: '8'}
				]}
				activeTab={activeTab}
				onSelect={(tab) => setActiveTab(tab as Tab)}
			/>

			{/* Main content */}
			<Box flexGrow={1} flexDirection="column" paddingX={1}>
				{activeTab === 'dashboard' && (
					<Dashboard events={events} connection={connection} />
				)}
				{activeTab === 'events' && <EventList events={events} />}
				{activeTab === 'traces' && <Traces events={events} />}
				{activeTab === 'query' && (
					<QueryRunner connection={connection} />
				)}
				{activeTab === 'docs' && <Docs connection={connection} />}
				{activeTab === 'ingest' && <Ingest connection={connection} />}
				{activeTab === 'doctor' && <Doctor connection={connection} />}
				{activeTab === 'eval' && <Eval connection={connection} />}
			</Box>

			{/* Status bar */}
			<StatusBar
				hint="? help · q quit"
				eventCount={events.length}
				status={connection.status}
				url={url ?? 'ws://localhost:3847'}
				errorMessage={connection.errorMessage}
			/>

			{/* Help overlay */}
			{showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
		</Box>
	)
}

type RunOptions = {
	url?: string
}

/**
 * Run the debug TUI.
 */
export function runDebugTui(options?: RunOptions) {
	// Best-effort: ensure raw mode is enabled so single-key shortcuts (e.g. `q`) work.
	// Some runtimes/launchers can leave stdin in cooked mode, which causes Ink to only
	// receive input after Enter and makes keys echo on screen.
	const stdin = process.stdin as any
	try {
		if (stdin?.isTTY && typeof stdin.setRawMode === 'function') {
			stdin.setRawMode(true)
		}
		if (typeof stdin?.setEncoding === 'function') stdin.setEncoding('utf8')
		if (typeof stdin?.resume === 'function') stdin.resume()
	} catch {
		// ignore
	}

	const {waitUntilExit} = render(
		<HotkeysLockProvider>
			<App url={options?.url} />
		</HotkeysLockProvider>
	)
	return waitUntilExit().finally(() => {
		try {
			if (stdin?.isTTY && typeof stdin.setRawMode === 'function') {
				stdin.setRawMode(false)
			}
		} catch {
			// ignore
		}
	})
}

export default App
