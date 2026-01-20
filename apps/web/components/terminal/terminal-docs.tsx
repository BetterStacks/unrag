'use client'

import {clsx} from 'clsx/lite'
import {useTerminal} from './terminal-context'
import {
	mockChunkDetails,
	mockChunkRanges,
	mockDocuments
} from './terminal-mock-data'
import {chars, theme} from './terminal-theme'

function DocumentList() {
	const {selectedDocIndex, setSelectedDocIndex} = useTerminal()

	return (
		<div className="flex flex-col h-full border-r border-white/10">
			<div className="px-3 py-1.5 border-b border-white/10 text-white/50 text-[10px]">
				Documents ({mockDocuments.length})
			</div>
			<div className="flex-1 overflow-y-auto">
				{mockDocuments.slice(0, 12).map((doc, idx) => {
					const isSelected = idx === selectedDocIndex
					return (
						<button
							type="button"
							key={doc.sourceId}
							onClick={() => setSelectedDocIndex(idx)}
							className={clsx(
								'w-full text-left px-3 py-1 text-[10px] flex items-center justify-between transition-colors duration-150',
								isSelected
									? 'text-white font-medium'
									: 'text-white/50 hover:text-white/70'
							)}
						>
							<span className="truncate flex-1 mr-2">
								{chars.arrow} {doc.sourceId}
							</span>
							<span
								className={clsx(
									'tabular-nums',
									isSelected ? 'text-white/70' : 'text-white/40'
								)}
							>
								{doc.chunks}
							</span>
						</button>
					)
				})}
			</div>
		</div>
	)
}

function ChunkHistogram() {
	const maxCount = Math.max(...mockChunkRanges.map((r) => r.count), 1)

	return (
		<div className="px-3 py-2 border-b border-white/10">
			<div className="text-[10px] text-white/50 mb-2">
				Chunk Size Distribution
			</div>
			<div className="flex items-end gap-1 h-8">
				{mockChunkRanges.map((range) => {
					const height =
						range.count > 0 ? (range.count / maxCount) * 100 : 4
					return (
						<div
							key={range.range}
							className="flex-1 flex flex-col items-center gap-0.5"
						>
							<div
								className="w-full rounded-t-sm transition-all duration-300"
								style={{
									height: `${height}%`,
									minHeight: '2px',
									backgroundColor:
										range.count > 0
											? theme.accent
											: 'rgba(255,255,255,0.1)'
								}}
							/>
							<span className="text-[8px] text-white/40">
								{range.range}
							</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}

function ChunkDetails() {
	const {selectedDocIndex, selectedChunkIndex, setSelectedChunkIndex} =
		useTerminal()
	const doc = mockDocuments[selectedDocIndex]
	const chunks = doc
		? mockChunkDetails[doc.sourceId] ||
			Array.from({length: doc.chunks}, (_, i) => ({
				idx: i,
				tokens: 150 + Math.floor(Math.random() * 100),
				content: `Chunk ${i + 1} content preview for ${doc.sourceId}...`
			}))
		: []

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="px-3 py-1.5 border-b border-white/10 text-white/50 text-[10px]">
				Chunks ({chunks.length})
			</div>
			{chunks.map((chunk) => {
				const isSelected = chunk.idx === selectedChunkIndex
				return (
					<button
						type="button"
						key={chunk.idx}
						onClick={() => setSelectedChunkIndex(chunk.idx)}
						className={clsx(
							'w-full text-left px-3 py-1.5 text-[10px] border-b border-white/5 transition-colors duration-150',
							isSelected ? 'bg-white/5' : 'hover:bg-white/5'
						)}
					>
						<div className="flex items-center justify-between mb-0.5">
							<span
								className={
									isSelected
										? 'text-white font-medium'
										: 'text-white/70'
								}
							>
								#{chunk.idx}
							</span>
							<span className="text-white/40">
								{chunk.tokens} tokens
							</span>
						</div>
						<div className="text-white/50 truncate">
							{chunk.content}
						</div>
					</button>
				)
			})}
		</div>
	)
}

function DocumentDetails() {
	return (
		<div className="flex flex-col h-full">
			<ChunkHistogram />
			<ChunkDetails />
		</div>
	)
}

export function TerminalDocs() {
	return (
		<div className="grid grid-cols-2 h-full">
			<DocumentList />
			<DocumentDetails />
		</div>
	)
}
