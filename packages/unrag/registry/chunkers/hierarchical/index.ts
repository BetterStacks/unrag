import {countTokens} from '@registry/chunkers/_shared/text'
import {
	recursiveChunker,
	registerChunkerPlugin,
	resolveChunkingOptions
} from '@registry/core/chunking'
import type {
	ChunkText,
	Chunker,
	ChunkerPlugin,
	ChunkingOptions
} from '@registry/core/types'

const isFence = (line: string): boolean =>
	line.trim().startsWith('```') || line.trim().startsWith('~~~')

const isHeading = (line: string): boolean => /^#{1,6}\s+/.test(line)

type Section = {
	header?: string
	body: string
}

const splitSections = (text: string): Section[] => {
	const lines = text.split('\n')
	const sections: Section[] = []
	let currentHeader: string | undefined
	let current: string[] = []
	let inCodeBlock = false

	const flush = () => {
		const body = current.join('\n').trim()
		if (body || currentHeader) {
			sections.push({header: currentHeader, body})
		}
		current = []
	}

	for (const line of lines) {
		if (isFence(line)) {
			inCodeBlock = !inCodeBlock
			current.push(line)
			continue
		}

		if (!inCodeBlock && isHeading(line)) {
			flush()
			currentHeader = line.trim()
			continue
		}

		current.push(line)
	}

	flush()
	return sections
}

export const hierarchicalChunker: Chunker = async (
	content: string,
	options: ChunkingOptions
): Promise<ChunkText[]> => {
	const resolved = resolveChunkingOptions(options)
	const {chunkSize, chunkOverlap, minChunkSize = 24} = resolved

	if (!content.trim()) {
		return []
	}

	const sections = splitSections(content)
	const chunks: ChunkText[] = []

	for (const section of sections) {
		const body = section.body
		if (!body && section.header) {
			const headerOnly = section.header
			chunks.push({
				index: chunks.length,
				content: headerOnly,
				tokenCount: countTokens(headerOnly)
			})
			continue
		}

		const sectionChunks = await recursiveChunker(body, {
			chunkSize,
			chunkOverlap,
			minChunkSize
		})

		for (const chunk of sectionChunks) {
			const contentWithHeader = section.header
				? `${section.header}\n${chunk.content}`
				: chunk.content
			chunks.push({
				index: chunks.length,
				content: contentWithHeader,
				tokenCount: countTokens(contentWithHeader)
			})
		}
	}

	return chunks
}

export const createHierarchicalChunkerPlugin = (): ChunkerPlugin => ({
	name: 'hierarchical',
	createChunker: () => hierarchicalChunker
})

export const registerHierarchicalChunker = (): void => {
	registerChunkerPlugin(createHierarchicalChunkerPlugin())
}

registerHierarchicalChunker()
