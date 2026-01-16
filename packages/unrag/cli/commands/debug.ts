/**
 * Debug command: opens the debug TUI and connects to running app.
 *
 * Usage:
 *   bunx unrag debug [options]
 *
 * Options:
 *   --url <ws://...>    WebSocket URL (default: ws://localhost:3847)
 *   --port <number>     Port to connect to (shorthand for --url ws://localhost:<port>)
 */

import {outro} from '@clack/prompts'
import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'
import {existsSync} from 'node:fs'

type ParsedDebugArgs = {
	url?: string
	port?: number
	help?: boolean
}

function parseDebugArgs(args: string[]): ParsedDebugArgs {
	const out: ParsedDebugArgs = {}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]

		if (arg === '--url') {
			out.url = args[++i]
		} else if (arg === '--port' || arg === '-p') {
			const portStr = args[++i] ?? ''
			out.port = parseInt(portStr, 10)
			if (isNaN(out.port)) {
				throw new Error(`Invalid port: ${portStr}`)
			}
		} else if (arg === '--help' || arg === '-h') {
			out.help = true
		}
	}

	return out
}

function renderDebugHelp(): string {
	return [
		'unrag debug — Real-time TUI debugger for RAG operations',
		'',
		'Usage:',
		'  bunx unrag debug [options]',
		'',
		'Options:',
		'  --url <ws://...>    WebSocket URL (default: ws://localhost:3847)',
		'  --port, -p <num>    Port to connect to (default: 3847)',
		'  -h, --help          Show this help',
		'',
		'Setup:',
		"  1. Set UNRAG_DEBUG=true in your app's environment",
		'  2. Start your app (debug server auto-starts on port 3847)',
		'  3. Run: bunx unrag debug',
		'',
		'Keyboard shortcuts (in TUI):',
		'  Shift+Tab     Cycle tabs',
		'  1-8           Jump to specific tab',
		'  j/k or arrows Navigate event list',
		'  Enter/e       View event details',
		'  a/i/r/k/d     Filter events by type',
		'  ?/h           Show help',
		'  q             Quit',
		'',
		'Environment variables (in your app):',
		'  UNRAG_DEBUG=true         Enable debug mode',
		'  UNRAG_DEBUG_PORT=3847    Debug server port (optional)',
		''
	].join('\n')
}

/**
 * Get the path to the TUI module.
 * This is computed at runtime to prevent the bundler from including the TUI
 * in the CLI bundle.
 *
 * The TUI is pre-compiled to JS so it can run on Node.js (not just Bun).
 */
function getTuiModulePath(): string {
	const __filename = fileURLToPath(import.meta.url)
	const __dirname = dirname(__filename)
	// From dist/cli/index.js, go to dist/debug-tui/index(.dev).js
	const dev = process.env.UNRAG_DEBUG_TUI_DEV === '1'
	const devPath = join(__dirname, '..', 'debug-tui', 'index.dev.js')
	const prodPath = join(__dirname, '..', 'debug-tui', 'index.js')
	if (dev) {
		if (existsSync(devPath)) return devPath
		throw new Error(
			'UNRAG_DEBUG_TUI_DEV=1 was set but dev TUI bundle was not found. Rebuild unrag with: `bun run build:debug-tui:dev`'
		)
	}
	return prodPath
}

export async function debugCommand(args: string[]): Promise<void> {
	try {
		const parsed = parseDebugArgs(args)

		if (parsed.help) {
			outro(renderDebugHelp())
			return
		}

		// Determine URL
		let url = parsed.url
		if (!url && parsed.port) {
			url = `ws://localhost:${parsed.port}`
		}
		url = url ?? 'ws://localhost:3847'

		console.log(`Connecting to debug server at ${url}...`)
		console.log('Press ? for help, q to quit\n')

		// Dynamically import the prebuilt TUI bundle.
		// The bundle is self-contained (it bundles React+Ink) to avoid React version conflicts.
		const tuiPath = getTuiModulePath()
		const {runDebugTui} = await import(tuiPath)

		// Run the TUI (this blocks until the user quits)
		await runDebugTui({url})
	} catch (error) {
		if (error instanceof Error) {
			outro(`Error: ${error.message}`)
		} else {
			outro(`Error: ${String(error)}`)
		}
		process.exitCode = 1
	}
}
