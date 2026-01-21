import type {
	ChunkText,
	Chunker,
	ChunkerPlugin,
	ChunkingConfig,
	ChunkingMethod,
	ChunkingOptions
} from '@registry/core/types'

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

const DEFAULT_CHUNK_SIZE = 200
const DEFAULT_CHUNK_OVERLAP = 40

export const defaultChunkingOptions: ChunkingOptions = {
	chunkSize: DEFAULT_CHUNK_SIZE,
	chunkOverlap: DEFAULT_CHUNK_OVERLAP
}

// ---------------------------------------------------------------------------
// Word chunker (legacy)
// ---------------------------------------------------------------------------

const splitWords = (content: string) =>
	content.trim().split(/\s+/).filter(Boolean)

/**
 * Word-based chunker (legacy).
 * Splits content by whitespace and creates fixed-size word chunks with overlap.
 */
export const wordChunker: Chunker = (
	content: string,
	options: ChunkingOptions
): ChunkText[] => {
	const {chunkSize, chunkOverlap} = options
	const words = splitWords(content)
	const chunks: ChunkText[] = []

	if (words.length === 0) {
		return chunks
	}

	let cursor = 0
	let index = 0

	const stride = Math.max(1, chunkSize - chunkOverlap)

	while (cursor < words.length) {
		const slice = words.slice(cursor, cursor + chunkSize)
		const chunkContent = slice.join(' ').trim()

		if (chunkContent.length === 0) {
			break
		}

		chunks.push({
			index,
			content: chunkContent,
			tokenCount: slice.length
		})

		cursor += stride
		index += 1
	}

	return chunks
}

// ---------------------------------------------------------------------------
// Recursive chunker (default)
// ---------------------------------------------------------------------------

/**
 * Default separator hierarchy for recursive chunking.
 * Tries to split on paragraph breaks first, then newlines, then sentences, then spaces.
 */
const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' ']

/**
 * Recursively split text using a hierarchy of separators.
 * This is the industry-standard approach used by LangChain and similar frameworks.
 */
const recursiveSplit = (
	text: string,
	separators: string[],
	chunkSize: number,
	chunkOverlap: number
): string[] => {
	const results: string[] = []

	if (text.length <= chunkSize) {
		return text.trim() ? [text.trim()] : []
	}

	// Find the first separator that exists in the text
	let separator = ''
	let nextSeparators = separators

	for (let i = 0; i < separators.length; i++) {
		const sep = separators[i]
		if (sep && text.includes(sep)) {
			separator = sep
			nextSeparators = separators.slice(i + 1)
			break
		}
	}

	// If no separator found, fall back to character splitting
	if (!separator) {
		const stride = Math.max(1, chunkSize - chunkOverlap)
		for (let i = 0; i < text.length; i += stride) {
			const chunk = text.slice(i, i + chunkSize).trim()
			if (chunk) {
				results.push(chunk)
			}
		}
		return results
	}

	// Split by the chosen separator
	const splits = text.split(separator)
	let currentChunk = ''

	for (const split of splits) {
		const piece = split.trim()
		if (!piece) continue

		const potentialChunk = currentChunk
			? currentChunk + separator + piece
			: piece

		if (potentialChunk.length <= chunkSize) {
			currentChunk = potentialChunk
		} else {
			// Current chunk is ready, push it
			if (currentChunk) {
				results.push(currentChunk)
			}

			// If piece itself is too large, recursively split it
			if (piece.length > chunkSize) {
				const subChunks = recursiveSplit(
					piece,
					nextSeparators,
					chunkSize,
					chunkOverlap
				)
				results.push(...subChunks)
				currentChunk = ''
			} else {
				currentChunk = piece
			}
		}
	}

	// Don't forget the last chunk
	if (currentChunk) {
		results.push(currentChunk)
	}

	return results
}

/**
 * Apply overlap to chunks by prepending content from the previous chunk.
 */
const applyOverlap = (
	chunks: string[],
	chunkOverlap: number
): string[] => {
	if (chunks.length <= 1 || chunkOverlap <= 0) {
		return chunks
	}

	const firstChunk = chunks[0]
	if (!firstChunk) {
		return chunks
	}

	const result: string[] = [firstChunk]

	for (let i = 1; i < chunks.length; i++) {
		const prevChunk = chunks[i - 1]
		const currentChunk = chunks[i]

		if (!prevChunk || !currentChunk) {
			continue
		}

		const overlapText = prevChunk.slice(-chunkOverlap)

		// Only add overlap if it doesn't start the same way
		if (!currentChunk.startsWith(overlapText.trim())) {
			result.push(overlapText.trim() + ' ' + currentChunk)
		} else {
			result.push(currentChunk)
		}
	}

	return result
}

/**
 * Recursive text splitter (default chunker).
 * Uses a hierarchy of separators to intelligently split text while preserving context.
 * Industry standard approach used by LangChain and similar frameworks.
 */
export const recursiveChunker: Chunker = (
	content: string,
	options: ChunkingOptions
): ChunkText[] => {
	const {chunkSize, chunkOverlap} = options

	if (!content.trim()) {
		return []
	}

	// Perform recursive splitting
	const rawChunks = recursiveSplit(
		content,
		DEFAULT_SEPARATORS,
		chunkSize,
		chunkOverlap
	)

	// Apply overlap between chunks
	const overlappedChunks = applyOverlap(rawChunks, chunkOverlap)

	// Convert to ChunkText format
	return overlappedChunks.map((chunkContent, index) => ({
		index,
		content: chunkContent,
		tokenCount: splitWords(chunkContent).length
	}))
}

// ---------------------------------------------------------------------------
// Default chunker (recursive)
// ---------------------------------------------------------------------------

/**
 * Default chunker - uses recursive splitting.
 * @deprecated Use `recursiveChunker` directly or `resolveChunker()` for config-based resolution.
 */
export const defaultChunker: Chunker = recursiveChunker

// ---------------------------------------------------------------------------
// Plugin registry
// ---------------------------------------------------------------------------

const loadedPlugins = new Map<string, ChunkerPlugin>()

/**
 * Register a chunker plugin.
 * Plugins are typically auto-registered when installed via `bunx unrag add chunker:<name>`.
 */
export const registerChunkerPlugin = (plugin: ChunkerPlugin): void => {
	loadedPlugins.set(plugin.name, plugin)
}

/**
 * Get a registered chunker plugin by name.
 */
export const getChunkerPlugin = (name: string): ChunkerPlugin | undefined => {
	return loadedPlugins.get(name)
}

/**
 * List all registered chunker plugins.
 */
export const listChunkerPlugins = (): string[] => {
	return Array.from(loadedPlugins.keys())
}

// ---------------------------------------------------------------------------
// Built-in chunkers registry
// ---------------------------------------------------------------------------

const builtInChunkers: Record<string, Chunker> = {
	recursive: recursiveChunker,
	word: wordChunker
}

// ---------------------------------------------------------------------------
// Chunker resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a chunker based on the chunking configuration.
 *
 * @param config - Chunking configuration from unrag.config.ts
 * @returns A chunker function
 * @throws Error if the specified method is not found (plugin not installed)
 */
export const resolveChunker = (config?: ChunkingConfig): Chunker => {
	// Default to recursive if no config
	if (!config || !config.method) {
		return recursiveChunker
	}

	const {method, chunker} = config

	// Handle custom chunker
	if (method === 'custom') {
		if (!chunker) {
			throw new Error(
				'Chunking method "custom" requires a chunker function in config.chunker'
			)
		}
		return chunker
	}

	// Check built-in chunkers
	const builtIn = builtInChunkers[method]
	if (builtIn) {
		return builtIn
	}

	// Check plugins
	const plugin = loadedPlugins.get(method)
	if (plugin) {
		return plugin.createChunker(config.options)
	}

	// Method not found - provide helpful error message
	throw new Error(
		`Chunker "${method}" not found.\n` +
		`Run: bunx unrag add chunker:${method}`
	)
}

/**
 * Check if a chunking method is available (built-in or plugin installed).
 */
export const isChunkerAvailable = (method: ChunkingMethod): boolean => {
	if (method === 'custom') return true
	if (method in builtInChunkers) return true
	return loadedPlugins.has(method)
}

/**
 * Get information about available chunkers.
 */
export const getAvailableChunkers = (): {
	builtIn: string[]
	plugins: string[]
} => ({
	builtIn: Object.keys(builtInChunkers),
	plugins: Array.from(loadedPlugins.keys())
})

// ---------------------------------------------------------------------------
// Options resolution
// ---------------------------------------------------------------------------

export const resolveChunkingOptions = (
	overrides?: Partial<ChunkingOptions>
): ChunkingOptions => ({
	...defaultChunkingOptions,
	...overrides
})
