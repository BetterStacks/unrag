/**
 * Theme constants for the Terminal component.
 * Based on the debug TUI theme from /packages/unrag/registry/debug/tui/theme.ts
 */

export const theme = {
	// Primary text
	fg: '#ffffff',
	// Secondary/dim text
	muted: 'rgba(255, 255, 255, 0.55)',
	dim: 'rgba(255, 255, 255, 0.4)',
	// Borders and separators
	border: 'rgba(255, 255, 255, 0.15)',
	borderActive: '#ffffff',
	// Accent color (selection, active states)
	accent: '#8AA170',
	accentBg: '#8AA170',
	// Background colors
	panelBg: '#1A1A1A',
	headerBg: 'white',
	// Status colors
	success: '#22c55e',
	warning: '#eab308',
	error: '#ef4444',
	// Event type colors
	ingest: '#8AA170',
	retrieve: '#8AA170'
} as const

export const chars = {
	// Horizontal/vertical lines
	h: '─',
	v: '│',
	// Corners
	tl: '┌',
	tr: '┐',
	bl: '└',
	br: '┘',
	// T-junctions
	lt: '├',
	rt: '┤',
	tt: '┬',
	bt: '┴',
	// Cross
	x: '┼',
	// Bullets and indicators
	dot: '●',
	circle: '○',
	arrow: '›',
	pointer: '›',
	check: '✓',
	cross: '✗',
	// Section markers
	section: '▸',
	// Solid block (for logo rendering)
	fullBlock: '█'
} as const

export const TABS = [
	{id: 'dashboard', label: 'Dashboard', shortcut: 1},
	{id: 'events', label: 'Events', shortcut: 2},
	{id: 'traces', label: 'Traces', shortcut: 3},
	{id: 'query', label: 'Query', shortcut: 4},
	{id: 'docs', label: 'DOCS', shortcut: 5},
	{id: 'doctor', label: 'Doctor', shortcut: 6},
	{id: 'eval', label: 'Eval', shortcut: 7}
] as const
