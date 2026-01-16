/**
 * Ingest tab: ingest a new document directly through the engine.
 *
 * This is intentionally "batteries included" so new apps can quickly test retrieval
 * without building an ingestion pipeline first.
 */

import type {Metadata, MetadataValue} from '@registry/core/types'
import {ScrollableText} from '@registry/debug/tui/components/ScrollableText'
import {useHotkeysLock} from '@registry/debug/tui/context/HotkeysLock'
import {useTerminalSize} from '@registry/debug/tui/hooks/useTerminalSize'
import {chars, theme, truncate} from '@registry/debug/tui/theme'
import type {DebugCommandResult, DebugConnection} from '@registry/debug/types'
import {Box, Text, useInput} from 'ink'
import {useEffect, useMemo, useState} from 'react'

type IngestProps = {
	connection: DebugConnection
}

type Field = 'sourceId' | 'content' | 'metadata' | 'chunkSize' | 'chunkOverlap'
type Mode = 'idle' | 'editing' | 'running'

function canIngest(connection: DebugConnection): boolean {
	return (
		Array.isArray(connection.capabilities) &&
		connection.capabilities.includes('ingest')
	)
}

export function Ingest({connection}: IngestProps) {
	const {columns, rows} = useTerminalSize()
	const ingestCapable = canIngest(connection)

	const [mode, setMode] = useState<Mode>('idle')
	const [focus, setFocus] = useState<Field>('sourceId')
	const [inputMode, setInputMode] = useState<'file' | 'inline'>('file')

	const [sourceId, setSourceId] = useState('debug:hello-world')
	const [contentPath, setContentPath] = useState('./README.md')
	const [content, setContent] = useState('Hello from Unrag Debug TUI.')
	const [metadataText, setMetadataText] = useState('{"source":"debug"}')
	const [chunkSize, setChunkSize] = useState<number | undefined>(undefined)
	const [chunkOverlap, setChunkOverlap] = useState<number | undefined>(
		undefined
	)

	const [res, setRes] = useState<DebugCommandResult | null>(null)
	const [warningsScrollTop, setWarningsScrollTop] = useState(0)

	const metaParse = useMemo(() => {
		const t = (metadataText ?? '').trim()
		if (!t) {
			return {ok: true as const, value: undefined as Metadata | undefined}
		}
		try {
			const v = JSON.parse(t) as unknown
			if (v && typeof v === 'object' && !Array.isArray(v)) {
				const obj = v as Record<string, unknown>
				const out: Metadata = {}
				for (const [k, val] of Object.entries(obj)) {
					if (
						val === null ||
						typeof val === 'string' ||
						typeof val === 'number' ||
						typeof val === 'boolean'
					) {
						out[k] = val as MetadataValue
					} else if (
						Array.isArray(val) &&
						val.every(
							(x) =>
								x === null ||
								typeof x === 'string' ||
								typeof x === 'number' ||
								typeof x === 'boolean'
						)
					) {
						out[k] = val as MetadataValue[]
					}
				}
				return {ok: true as const, value: out}
			}
			return {ok: false as const, error: 'metadata must be a JSON object'}
		} catch (err) {
			return {
				ok: false as const,
				error: err instanceof Error ? err.message : String(err)
			}
		}
	}, [metadataText])

	const run = async () => {
		setMode('running')
		setRes(null)
		try {
			const cmd =
				inputMode === 'file'
					? {
							type: 'ingest' as const,
							sourceId,
							contentPath: contentPath.trim() || undefined,
							...(metaParse.ok && metaParse.value
								? {metadata: metaParse.value}
								: {}),
							chunking: {
								...(typeof chunkSize === 'number'
									? {chunkSize}
									: {}),
								...(typeof chunkOverlap === 'number'
									? {chunkOverlap}
									: {})
							}
						}
					: {
							type: 'ingest' as const,
							sourceId,
							content,
							...(metaParse.ok && metaParse.value
								? {metadata: metaParse.value}
								: {}),
							chunking: {
								...(typeof chunkSize === 'number'
									? {chunkSize}
									: {}),
								...(typeof chunkOverlap === 'number'
									? {chunkOverlap}
									: {})
							}
						}
			const r = await connection.sendCommand(cmd)
			setRes(r)
		} finally {
			setMode('idle')
		}
	}

	const isEditing = mode === 'editing'
	useHotkeysLock(isEditing)
	const _editTarget =
		focus === 'sourceId'
			? sourceId
			: focus === 'content'
				? inputMode === 'file'
					? contentPath
					: content
				: focus === 'metadata'
					? metadataText
					: focus === 'chunkSize'
						? typeof chunkSize === 'number'
							? String(chunkSize)
							: ''
						: typeof chunkOverlap === 'number'
							? String(chunkOverlap)
							: ''

	useInput((input, key) => {
		if (!ingestCapable) {
			return
		}

		if (mode === 'editing') {
			// Nano-like: type freely; Esc / Ctrl+X exits; Enter applies.
			if (key.escape || (key.ctrl && input === 'x')) {
				setMode('idle')
				return
			}
			if (key.return) {
				setMode('idle')
				return
			}

			const backspace = key.backspace || key.delete
			if (backspace) {
				if (focus === 'sourceId') {
					setSourceId((s) => s.slice(0, -1))
				}
				if (focus === 'content') {
					if (inputMode === 'file') {
						setContentPath((s) => s.slice(0, -1))
					} else {
						setContent((s) => s.slice(0, -1))
					}
				}
				if (focus === 'metadata') {
					setMetadataText((s) => s.slice(0, -1))
				}
				if (focus === 'chunkSize') {
					setChunkSize((n) =>
						typeof n === 'number'
							? Number(String(n).slice(0, -1)) || 0
							: undefined
					)
				}
				if (focus === 'chunkOverlap') {
					setChunkOverlap((n) =>
						typeof n === 'number'
							? Number(String(n).slice(0, -1)) || 0
							: undefined
					)
				}
				return
			}

			if (input && input.length === 1 && !key.ctrl && !key.meta) {
				if (focus === 'sourceId') {
					setSourceId((s) => s + input)
				}
				if (focus === 'content') {
					if (inputMode === 'file') {
						setContentPath((s) => s + input)
					} else {
						setContent((s) => s + input)
					}
				}
				if (focus === 'metadata') {
					setMetadataText((s) => s + input)
				}
				if (focus === 'chunkSize') {
					setChunkSize((n) =>
						Number(`${typeof n === 'number' ? n : ''}${input}`)
					)
				}
				if (focus === 'chunkOverlap') {
					setChunkOverlap((n) =>
						Number(`${typeof n === 'number' ? n : ''}${input}`)
					)
				}
				return
			}

			return
		}

		if (key.tab) {
			const order: Field[] = [
				'sourceId',
				'content',
				'metadata',
				'chunkSize',
				'chunkOverlap'
			]
			const i = order.indexOf(focus)
			setFocus(order[(i + 1) % order.length] ?? 'sourceId')
			return
		}

		if (input === 'm') {
			setInputMode((m) => (m === 'file' ? 'inline' : 'file'))
			return
		}

		if (input === 'e') {
			setMode('editing')
			return
		}

		if (input === 'r') {
			void run()
			return
		}

		if (input === 'c' && focus === 'content') {
			if (inputMode === 'file') {
				setContentPath('')
			} else {
				setContent('')
			}
			return
		}

		const out = res?.type === 'ingest' ? res : undefined
		const hasWarnings = Boolean(
			out?.success && out?.warnings && out.warnings.length > 0
		)
		// Scroll warnings output (like less)
		if (hasWarnings && (key.pageUp || (key.ctrl && input === 'u'))) {
			setWarningsScrollTop((t) => Math.max(0, t - 8))
			return
		}
		if (hasWarnings && (key.pageDown || (key.ctrl && input === 'd'))) {
			setWarningsScrollTop((t) => t + 8)
			return
		}
		if (hasWarnings && key.home) {
			setWarningsScrollTop(0)
			return
		}
	})

	const out = res?.type === 'ingest' ? res : undefined
	const ok = out?.success
	const err = out && !out.success ? out.error : undefined
	const hasWarnings = Boolean(ok && out?.warnings && out.warnings.length > 0)

	useEffect(() => {
		if (hasWarnings) {
			setWarningsScrollTop(0)
		}
	}, [hasWarnings, out?.warnings?.length])

	const detailsHeight = Math.max(6, Math.min(14, rows - 18))
	const detailsWidth = Math.max(30, columns - 8)

	const field = (label: string, value: string, isActive: boolean) => (
		<Box gap={1}>
			<Text color={theme.muted}>{label.padEnd(12)}</Text>
			<Text color={isActive ? theme.accent : theme.fg} bold={isActive}>
				{truncate(value || '—', Math.max(16, columns - 24))}
			</Text>
		</Box>
	)

	return (
		<Box flexDirection="column" flexGrow={1} paddingY={1}>
			<Box justifyContent="space-between" marginBottom={1}>
				<Box gap={1}>
					<Text backgroundColor={theme.border} color={theme.fg}>
						{' '}
						INGEST{' '}
					</Text>
					<Text color={theme.muted}>
						{mode === 'editing'
							? 'editing: type · esc/^x exit · ⏎ apply'
							: 'tab field · e edit · m mode · r run · c clear'}
					</Text>
				</Box>
				<Text color={theme.muted}>
					mode{' '}
					<Text color={theme.fg} bold>
						{inputMode}
					</Text>
				</Text>
			</Box>

			{!ingestCapable ? (
				<Box
					borderStyle="single"
					borderColor={theme.borderActive}
					paddingX={1}
					paddingY={1}
				>
					<Text color={theme.warning}>
						{chars.cross} Server does not advertise ingest
						capability. In your app, call{' '}
						<Text bold color={theme.fg}>
							{'`registerUnragDebug({ engine })`'}
						</Text>
						.
					</Text>
				</Box>
			) : (
				<>
					<Box
						borderStyle="single"
						borderColor={theme.border}
						paddingX={1}
						paddingY={1}
						marginBottom={1}
						flexDirection="column"
						gap={0}
					>
						{field('sourceId', sourceId, focus === 'sourceId')}
						{field(
							inputMode === 'file' ? 'contentPath' : 'content',
							inputMode === 'file' ? contentPath : content,
							focus === 'content'
						)}
						{field(
							'metadata',
							metadataText.trim() ? metadataText : '—',
							focus === 'metadata'
						)}
						{field(
							'chunkSize',
							typeof chunkSize === 'number'
								? String(chunkSize)
								: 'default',
							focus === 'chunkSize'
						)}
						{field(
							'chunkOverlap',
							typeof chunkOverlap === 'number'
								? String(chunkOverlap)
								: 'default',
							focus === 'chunkOverlap'
						)}
						{!metaParse.ok && (
							<Text color={theme.error} bold>
								{chars.cross} metadata invalid:{' '}
								{metaParse.error}
							</Text>
						)}
						{inputMode === 'inline' && (
							<Text color={theme.muted}>
								tip: inline content is single-line; use file
								mode for large/multiline docs
							</Text>
						)}
					</Box>

					{mode === 'running' && (
						<Text color={theme.muted}>Ingesting…</Text>
					)}

					{err && (
						<Box
							borderStyle="single"
							borderColor={theme.error}
							paddingX={1}
							paddingY={1}
						>
							<Text color={theme.error} bold>
								{chars.cross} {err}
							</Text>
						</Box>
					)}

					{ok && out && (
						<Box
							borderStyle="single"
							borderColor={theme.ok}
							paddingX={1}
							paddingY={1}
						>
							<Box gap={2} flexWrap="wrap">
								<Text color={theme.muted}>docId</Text>
								<Text color={theme.fg} bold>
									{out.documentId
										? truncate(out.documentId, 20)
										: '—'}
								</Text>
								<Text color={theme.muted}>chunks</Text>
								<Text color={theme.fg} bold>
									{out.chunkCount ?? '—'}
								</Text>
								<Text color={theme.muted}>model</Text>
								<Text color={theme.fg} bold>
									{out.embeddingModel ?? '—'}
								</Text>
							</Box>
						</Box>
					)}

					{ok && out?.warnings && out.warnings.length > 0 && (
						<Box marginTop={1}>
							<Text color={theme.muted}>
								warnings ({out.warnings.length})
							</Text>
							<ScrollableText
								text={out.warnings
									.map((w) => `${w.code}: ${w.message}`)
									.join('\n')}
								width={detailsWidth}
								height={detailsHeight}
								scrollTop={warningsScrollTop}
							/>
						</Box>
					)}
				</>
			)}
		</Box>
	)
}

export default Ingest
