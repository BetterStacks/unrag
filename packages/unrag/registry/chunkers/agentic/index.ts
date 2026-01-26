import {splitWithLlm} from '@registry/chunkers/_shared/llm'
import {countTokens, mergeSplits} from '@registry/chunkers/_shared/text'
import {
	registerChunkerPlugin,
	resolveChunkingOptions
} from '@registry/core/chunking'
import type {
	ChunkText,
	Chunker,
	ChunkerPlugin,
	ChunkingOptions
} from '@registry/core/types'

const splitSentences = (text: string): string[] => {
	const splits: string[] = []
	let buffer = ''

	for (let i = 0; i < text.length; i++) {
		const ch = text[i]
		buffer += ch

		if (ch === '.' || ch === '!' || ch === '?') {
			const next = text[i + 1]
			if (!next || /\s/.test(next)) {
				if (buffer.trim()) {
					splits.push(buffer)
				}
				buffer = ''
			}
		} else if (ch === '\n' && text[i + 1] === '\n') {
			if (buffer.trim()) {
				splits.push(buffer)
			}
			buffer = ''
		}
	}

	if (buffer.trim()) {
		splits.push(buffer)
	}

	return splits
}

export const agenticChunker: Chunker = async (
	content: string,
	options: ChunkingOptions
): Promise<ChunkText[]> => {
	const resolved = resolveChunkingOptions(options)
	const {chunkSize, chunkOverlap, minChunkSize = 24} = resolved

	if (!content.trim()) {
		return []
	}

	const model = options.model
	const llmSplits =
		(await splitWithLlm({
			content,
			model,
			chunkSize,
			goal: 'Maximize retrieval quality by keeping coherent ideas together and preserving nearby context.'
		})) ?? null

	const splits = llmSplits ?? splitSentences(content)
	const chunks = mergeSplits(splits, chunkSize, chunkOverlap, minChunkSize)

	return chunks.map((chunkContent, index) => ({
		index,
		content: chunkContent,
		tokenCount: countTokens(chunkContent)
	}))
}

export const createAgenticChunkerPlugin = (): ChunkerPlugin => ({
	name: 'agentic',
	createChunker: () => agenticChunker
})

export const registerAgenticChunker = (): void => {
	registerChunkerPlugin(createAgenticChunkerPlugin())
}

registerAgenticChunker()
