'use client'

import {cn} from '@/lib/utils'
import {useState} from 'react'
import {useTerminal} from './terminal-context'
import {theme} from './terminal-theme'

const DEFAULT_SOURCE_ID = 'debug:hello-world'
const DEFAULT_CONTENT =
	'Hello from Unrag Debug TUI. This content is chunked, embedded, and stored so queries can retrieve matching passages.'
const DEFAULT_METADATA = '{"source":"debug"}'

export function TerminalIngest() {
	const {ingestDocument, ingestedDocuments, stopAllAnimations, isIngesting} =
		useTerminal()
	const [sourceId, setSourceId] = useState(DEFAULT_SOURCE_ID)
	const [content, setContent] = useState(DEFAULT_CONTENT)
	const [metadata, setMetadata] = useState(DEFAULT_METADATA)
	const [chunkSize, setChunkSize] = useState(120)
	const [overlap, setOverlap] = useState(20)

	const recentLogs = ingestedDocuments.slice(0, 4)

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		stopAllAnimations()
		ingestDocument({
			sourceId,
			content,
			metadata,
			chunkSize,
			overlap
		})
	}

	const handleClear = () => {
		stopAllAnimations()
		setContent('')
	}

	return (
		<div className="flex flex-col h-full">
			<div className="border-b border-white/10 px-3 py-2 text-[9px] text-white/40 text-balance sm:px-4 sm:text-[10px]">
				INGEST tab fields · e edit · r run · c clear
			</div>
			<form
				onSubmit={handleSubmit}
				className="flex flex-1 flex-col gap-3 p-3 sm:p-4"
			>
				<div className="border border-white/15 px-2 py-2 text-[9px] text-white/70 sm:px-3 sm:text-[10px]">
					<div className="flex flex-col gap-1">
						<label className="flex items-center gap-3">
							<span className="w-12 text-white/40 sm:w-16">
								sourceId
							</span>
							<input
								value={sourceId}
								onChange={(event) => {
									stopAllAnimations()
									setSourceId(event.target.value)
								}}
								onFocus={stopAllAnimations}
								placeholder="debug:hello-world"
								className={cn(
									'flex-1 bg-transparent text-white/80 outline-none text-pretty',
									'placeholder:text-white/30'
								)}
							/>
						</label>
						<label className="flex items-center gap-3">
							<span className="w-12 text-white/40 sm:w-16">
								content
							</span>
							<input
								value={content}
								onChange={(event) => {
									stopAllAnimations()
									setContent(event.target.value)
								}}
								onFocus={stopAllAnimations}
								placeholder="Paste or type content to ingest"
								className={cn(
									'flex-1 bg-transparent text-white/70 outline-none text-pretty',
									'placeholder:text-white/30'
								)}
							/>
						</label>
						<label className="flex items-center gap-3">
							<span className="w-12 text-white/40 sm:w-16">
								metadata
							</span>
							<input
								value={metadata}
								onChange={(event) => {
									stopAllAnimations()
									setMetadata(event.target.value)
								}}
								onFocus={stopAllAnimations}
								placeholder='{"source":"debug"}'
								className={cn(
									'flex-1 bg-transparent text-white/70 outline-none text-pretty',
									'placeholder:text-white/30'
								)}
							/>
						</label>
					</div>
					<div className="flex items-center gap-4 mt-2 sm:gap-6">
						<label className="flex items-center gap-2">
							<span className="text-white/40">chunkSize</span>
							<input
								type="number"
								min={40}
								max={400}
								value={chunkSize}
								onChange={(event) => {
									stopAllAnimations()
									setChunkSize(Number(event.target.value))
								}}
								onFocus={stopAllAnimations}
								className={cn(
									'w-12 bg-transparent text-white/70 outline-none tabular-nums sm:w-16'
								)}
							/>
						</label>
						<label className="flex items-center gap-2">
							<span className="text-white/40">overlap</span>
							<input
								type="number"
								min={0}
								max={120}
								value={overlap}
								onChange={(event) => {
									stopAllAnimations()
									setOverlap(Number(event.target.value))
								}}
								onFocus={stopAllAnimations}
								className={cn(
									'w-12 bg-transparent text-white/70 outline-none tabular-nums sm:w-16'
								)}
							/>
						</label>
						<span className="ml-auto text-white/30">
							mode inline
						</span>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="submit"
						disabled={isIngesting}
						className="px-2 py-0.5 text-[9px] font-medium text-black disabled:cursor-not-allowed disabled:opacity-50 sm:text-[10px]"
						style={{backgroundColor: theme.accent}}
					>
						INGEST
					</button>
					<button
						type="button"
						onClick={handleClear}
						className="px-2 py-0.5 text-[9px] text-white/60 border border-white/20 sm:text-[10px]"
					>
						CLEAR
					</button>
				</div>
				<div className="border-t border-white/10 pt-2 text-[9px] text-white/40 text-pretty sm:text-[10px]">
					{isIngesting ? (
						<span className="text-white/40">Ingesting...</span>
					) : recentLogs.length ? (
						recentLogs.map((log) => (
							<div
								key={log.id}
								className="flex items-center justify-between gap-3"
							>
								<span className="min-w-0 truncate text-white/70 text-pretty">
									Ingested {log.sourceId}
								</span>
								<span className="tabular-nums">
									{log.chunkCount} chunks · {log.time}
								</span>
							</div>
						))
					) : (
						<span>
							No ingests yet. Add content to make it searchable.
						</span>
					)}
				</div>
			</form>
		</div>
	)
}
