import {Tiktoken} from 'js-tiktoken/lite'
import o200k_base from 'js-tiktoken/ranks/o200k_base'
import type {
	ChunkText,
	Chunker,
	ChunkerPlugin,
	ChunkingConfig,
	ChunkingMethod,
	ChunkingOptions
} from '@registry/core/types'

// ---------------------------------------------------------------------------
// Tokenizer (GPT-5 / o200k_base encoding)
// ---------------------------------------------------------------------------

/**
 * Tokenizer using o200k_base encoding (GPT-5, GPT-4o, o1, o3, o4-mini, gpt-4.1).
 * This is the standard encoding for all modern OpenAI models.
 */
const encoder = new Tiktoken(o200k_base)

/**
 * Count tokens in text using o200k_base encoding.
 */
export const countTokens = (text: string): number => {
	return encoder.encode(text).length
}

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

const DEFAULT_CHUNK_SIZE = 512
const DEFAULT_CHUNK_OVERLAP = 50
const DEFAULT_MIN_CHUNK_SIZE = 24

/**
 * Enhanced separator hierarchy for recursive chunking.
 * Splits on larger semantic boundaries first, falls back to smaller ones.
 */
const DEFAULT_SEPARATORS = [
	'\n\n', // paragraphs
	'\n', // lines
	'. ', // sentences (period)
	'? ', // sentences (question)
	'! ', // sentences (exclamation)
	'; ', // semicolon clauses
	': ', // colon clauses
	', ', // comma phrases
	' ', // words
	'' // characters (last resort)
]

export const defaultChunkingOptions: ChunkingOptions = {
	chunkSize: DEFAULT_CHUNK_SIZE,
	chunkOverlap: DEFAULT_CHUNK_OVERLAP,
	minChunkSize: DEFAULT_MIN_CHUNK_SIZE,
	separators: DEFAULT_SEPARATORS
}

// ---------------------------------------------------------------------------
// Token-based Recursive Chunker
// ---------------------------------------------------------------------------

/**
 * Split text by a separator, keeping the separator at the end of each piece.
 */
const splitWithSeparator = (text: string, separator: string): string[] => {
	if (separator === '') {
		// Character-level split
		return text.split('')
	}

	const parts = text.split(separator)
	const result: string[] = []

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]
		if (part === undefined) continue

		// Add separator back to the end of each part (except the last)
		if (i < parts.length - 1) {
			result.push(part + separator)
		} else if (part) {
			result.push(part)
		}
	}

	return result
}

/**
 * Merge small splits into chunks that respect the token limit.
 */
const mergeSplits = (
	splits: string[],
	chunkSize: number,
	chunkOverlap: number,
	minChunkSize: number
): string[] => {
	const chunks: string[] = []
	let currentChunk = ''
	let currentTokens = 0

	for (const split of splits) {
		const splitTokens = countTokens(split)

		// If adding this split would exceed chunk size
		if (currentTokens + splitTokens > chunkSize && currentChunk) {
			// Only add chunk if it meets minimum size
			if (currentTokens >= minChunkSize) {
				chunks.push(currentChunk.trim())
			}

			// Start new chunk with overlap from previous
			if (chunkOverlap > 0 && currentChunk) {
				const overlapText = getOverlapText(currentChunk, chunkOverlap)
				currentChunk = overlapText + split
				currentTokens = countTokens(currentChunk)
			} else {
				currentChunk = split
				currentTokens = splitTokens
			}
		} else {
			currentChunk += split
			currentTokens += splitTokens
		}
	}

	// Don't forget the last chunk
	if (currentChunk.trim() && currentTokens >= minChunkSize) {
		chunks.push(currentChunk.trim())
	} else if (currentChunk.trim() && chunks.length > 0) {
		// Merge small last chunk with previous
		const lastChunk = chunks.pop()
		if (lastChunk) {
			chunks.push((lastChunk + ' ' + currentChunk).trim())
		}
	} else if (currentChunk.trim()) {
		// Single chunk that's smaller than min - still include it
		chunks.push(currentChunk.trim())
	}

	return chunks
}

/**
 * Get overlap text from the end of a chunk.
 */
const getOverlapText = (text: string, overlapTokens: number): string => {
	const tokens = encoder.encode(text)
	if (tokens.length <= overlapTokens) {
		return text
	}

	const overlapTokenSlice = tokens.slice(-overlapTokens)
	try {
		return encoder.decode(overlapTokenSlice)
	} catch {
		// If decode fails, fall back to character-based overlap
		return text.slice(-overlapTokens * 4) // ~4 chars per token estimate
	}
}

/**
 * Recursively split text using a hierarchy of separators.
 */
const recursiveSplit = (
	text: string,
	separators: string[],
	chunkSize: number,
	chunkOverlap: number,
	minChunkSize: number
): string[] => {
	// Base case: text fits in chunk
	const textTokens = countTokens(text)
	if (textTokens <= chunkSize) {
		return text.trim() ? [text.trim()] : []
	}

	// Find the first separator that exists in the text
	let separatorToUse = ''
	let remainingSeparators = separators

	for (let i = 0; i < separators.length; i++) {
		const sep = separators[i]
		if (sep !== undefined && (sep === '' || text.includes(sep))) {
			separatorToUse = sep
			remainingSeparators = separators.slice(i + 1)
			break
		}
	}

	// Split by the chosen separator
	const splits = splitWithSeparator(text, separatorToUse)

	// Process splits - recursively split any that are too large
	const goodSplits: string[] = []

	for (const split of splits) {
		const splitTokens = countTokens(split)

		if (splitTokens <= chunkSize) {
			goodSplits.push(split)
		} else if (remainingSeparators.length > 0) {
			// Recursively split with finer separators
			const subSplits = recursiveSplit(
				split,
				remainingSeparators,
				chunkSize,
				chunkOverlap,
				minChunkSize
			)
			goodSplits.push(...subSplits)
		} else {
			// No more separators - force split by tokens
			goodSplits.push(...forceSplitByTokens(split, chunkSize, chunkOverlap))
		}
	}

	// Merge splits into chunks respecting size limits
	return mergeSplits(goodSplits, chunkSize, chunkOverlap, minChunkSize)
}

/**
 * Force split text by token count when no separators work.
 */
const forceSplitByTokens = (
	text: string,
	chunkSize: number,
	chunkOverlap: number
): string[] => {
	const tokens = encoder.encode(text)
	const chunks: string[] = []
	const stride = Math.max(1, chunkSize - chunkOverlap)

	for (let i = 0; i < tokens.length; i += stride) {
		const chunkTokens = tokens.slice(i, i + chunkSize)
		try {
			const chunk = encoder.decode(chunkTokens).trim()
			if (chunk) {
				chunks.push(chunk)
			}
		} catch {
			// Skip invalid token sequences
		}

		// Stop if we've processed all tokens
		if (i + chunkSize >= tokens.length) {
			break
		}
	}

	return chunks
}

/**
 * Token-based recursive text splitter (default chunker).
 *
 * Uses o200k_base encoding (GPT-5, GPT-4o, o1, o3, o4-mini, gpt-4.1) for accurate
 * token counting. Splits text using a hierarchy of separators to preserve semantic
 * boundaries while respecting token limits.
 *
 * Features:
 * - Accurate token counting using js-tiktoken with o200k_base encoding
 * - 10-level separator hierarchy (paragraphs → sentences → words → characters)
 * - Minimum chunk size threshold to avoid tiny chunks
 * - Token-based overlap for context preservation
 *
 * @example
 * ```typescript
 * const chunks = recursiveChunker(text, {
 *   chunkSize: 512,    // max tokens per chunk
 *   chunkOverlap: 50,  // overlap tokens between chunks
 *   minChunkSize: 24   // minimum tokens per chunk
 * })
 * ```
 */
export const recursiveChunker: Chunker = (
	content: string,
	options: ChunkingOptions
): ChunkText[] => {
	const {
		chunkSize,
		chunkOverlap,
		minChunkSize = DEFAULT_MIN_CHUNK_SIZE,
		separators = DEFAULT_SEPARATORS
	} = options

	if (!content.trim()) {
		return []
	}

	// Perform recursive splitting
	const chunks = recursiveSplit(
		content,
		separators,
		chunkSize,
		chunkOverlap,
		minChunkSize
	)

	// Convert to ChunkText format with accurate token counts
	return chunks.map((chunkContent, index) => ({
		index,
		content: chunkContent,
		tokenCount: countTokens(chunkContent)
	}))
}

/**
 * Token-based fixed-size chunker.
 *
 * Splits text strictly by token count with overlap, without recursive separators.
 */
export const tokenChunker: Chunker = (
	content: string,
	options: ChunkingOptions
): ChunkText[] => {
	const {
		chunkSize,
		chunkOverlap,
		minChunkSize = DEFAULT_MIN_CHUNK_SIZE
	} = options

	if (!content.trim()) {
		return []
	}

	const chunks = forceSplitByTokens(content, chunkSize, chunkOverlap)
	if (chunks.length > 1) {
		const last = chunks[chunks.length - 1]
		if (last && countTokens(last) < minChunkSize) {
			const prev = chunks[chunks.length - 2]
			chunks.splice(chunks.length - 2, 2, `${prev} ${last}`.trim())
		}
	}

	return chunks.map((chunkContent, index) => ({
		index,
		content: chunkContent,
		tokenCount: countTokens(chunkContent)
	}))
}

// ---------------------------------------------------------------------------
// Default chunker
// ---------------------------------------------------------------------------

/**
 * Default chunker - token-based recursive splitting.
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
	token: tokenChunker
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
