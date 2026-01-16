import {useStdout} from 'ink'
import {useEffect, useMemo, useState} from 'react'

type TerminalSize = {
	columns: number
	rows: number
}

type StdoutLike = {
	columns?: unknown
	rows?: unknown
	on?: (event: 'resize', listener: () => void) => void
	off?: (event: 'resize', listener: () => void) => void
	removeListener?: (event: 'resize', listener: () => void) => void
}

function readSize(stdout: unknown): TerminalSize {
	const out = stdout as StdoutLike
	const columns = Number(out?.columns ?? process.stdout?.columns ?? 80) || 80
	const rows = Number(out?.rows ?? process.stdout?.rows ?? 24) || 24
	return {columns, rows}
}

/**
 * Cross-version terminal size hook.
 *
 * Ink's exported hooks have changed across major versions; `useStdoutDimensions`
 * isn't always available. This hook relies on `useStdout()` and the underlying
 * stream's `columns/rows` + `resize` event.
 */
export function useTerminalSize(): TerminalSize {
	const {stdout} = useStdout()

	const get = useMemo(() => () => readSize(stdout), [stdout])
	const [size, setSize] = useState<TerminalSize>(() => get())

	useEffect(() => {
		setSize(get())

		const out = (stdout ?? process.stdout) as StdoutLike
		const onResize = () => setSize(get())

		// Node stdout emits "resize" when TTY size changes.
		if (out?.on) {
			out.on('resize', onResize)
		}
		return () => {
			if (out?.off) {
				out.off('resize', onResize)
			} else if (out?.removeListener) {
				out.removeListener('resize', onResize)
			}
		}
	}, [get, stdout])

	return size
}
