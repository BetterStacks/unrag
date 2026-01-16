import {useStdout} from 'ink'
import {useEffect, useMemo, useState} from 'react'

type TerminalSize = {
	columns: number
	rows: number
}

function readSize(stdout: any): TerminalSize {
	const columns =
		Number(stdout?.columns ?? process.stdout?.columns ?? 80) || 80
	const rows = Number(stdout?.rows ?? process.stdout?.rows ?? 24) || 24
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

		const out: any = stdout ?? process.stdout
		const onResize = () => setSize(get())

		// Node stdout emits "resize" when TTY size changes.
		if (out?.on) out.on('resize', onResize)
		return () => {
			if (out?.off) out.off('resize', onResize)
			else if (out?.removeListener) out.removeListener('resize', onResize)
		}
	}, [get, stdout])

	return size
}
