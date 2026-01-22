import {resolveChunkingOptions, registerChunkerPlugin} from '@registry/core/chunking'
import type {
	ChunkText,
	Chunker,
	ChunkerPlugin,
	ChunkingOptions
} from '@registry/core/types'
import {countTokens, mergeSplits} from '@registry/chunkers/_shared/text'

const isFence = (line: string): boolean =>
	line.trim().startsWith('```') || line.trim().startsWith('~~~')

const isHeading = (line: string): boolean => /^#{1,6}\s+/.test(line)

const isRule = (line: string): boolean =>
	/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())

const splitMarkdownBlocks = (text: string): string[] => {
	const lines = text.split('\n')
	const blocks: string[] = []
	let current: string[] = []
	let inCodeBlock = false

	const flush = () => {
		const block = current.join('\n')
		if (block.trim()) {
			blocks.push(block)
		}
		current = []
	}

	for (const line of lines) {
		if (isFence(line)) {
			inCodeBlock = !inCodeBlock
			current.push(line)
			continue
		}

		if (!inCodeBlock && (isHeading(line) || isRule(line))) {
			flush()
			current.push(line)
			continue
		}

		current.push(line)
	}

	flush()
	return blocks
}

export const markdownChunker: Chunker = (
	content: string,
	options: ChunkingOptions
): ChunkText[] => {
	const resolved = resolveChunkingOptions(options)
	const {
		chunkSize,
		chunkOverlap,
		minChunkSize = 24
	} = resolved

	if (!content.trim()) {
		return []
	}

	const blocks = splitMarkdownBlocks(content)
	const chunks = mergeSplits(blocks, chunkSize, chunkOverlap, minChunkSize)

	return chunks.map((chunkContent, index) => ({
		index,
		content: chunkContent,
		tokenCount: countTokens(chunkContent)
	}))
}

export const createMarkdownChunkerPlugin = (): ChunkerPlugin => ({
	name: 'markdown',
	createChunker: () => markdownChunker
})

export const registerMarkdownChunker = (): void => {
	registerChunkerPlugin(createMarkdownChunkerPlugin())
}

registerMarkdownChunker()
