import {resolveChunkingOptions, registerChunkerPlugin} from '@registry/core/chunking'
import type {
	ChunkText,
	Chunker,
	ChunkerPlugin,
	ChunkingOptions,
	Metadata,
	MetadataValue
} from '@registry/core/types'
import {requireOptional} from '@registry/chunkers/_shared/optional'
import {countTokens, mergeSplits} from '@registry/chunkers/_shared/text'

type TreeSitterModule = {
	default?: new () => {
		setLanguage: (lang: unknown) => void
		parse: (input: string) => {
			rootNode: {
				namedChildren: Array<{
					type: string
					startIndex: number
					endIndex: number
				}>
			}
		}
	}
}

type LanguageModule = {
	default?: unknown
	typescript?: unknown
	javascript?: unknown
	tsx?: unknown
	jsx?: unknown
}

const DEFAULT_LANGUAGE = 'typescript'

const normalizeLanguage = (language?: string): string => {
	const normalized = (language ?? '').toLowerCase().trim()
	if (normalized === 'ts' || normalized === 'tsx' || normalized === 'typescript') {
		return 'typescript'
	}
	if (normalized === 'js' || normalized === 'jsx' || normalized === 'javascript') {
		return 'javascript'
	}
	if (normalized === 'py' || normalized === 'python') {
		return 'python'
	}
	if (normalized === 'go' || normalized === 'golang') {
		return 'go'
	}
	return DEFAULT_LANGUAGE
}

const EXTENSION_LANGUAGE: Record<string, string> = {
	ts: 'typescript',
	tsx: 'typescript',
	js: 'javascript',
	jsx: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	py: 'python',
	go: 'go'
}

const detectLanguageFromPath = (value?: string): string | undefined => {
	if (!value) {
		return undefined
	}
	const cleaned = value.split(/[?#]/)[0] ?? ''
	if (!cleaned) {
		return undefined
	}
	const base = cleaned.split(/[\\/]/).pop() ?? cleaned
	if (!base) {
		return undefined
	}
	const match = base.toLowerCase().match(/\.([a-z0-9]+)$/)
	if (!match?.[1]) {
		return undefined
	}
	const detected = EXTENSION_LANGUAGE[match[1]]
	return detected ?? undefined
}

const extractString = (value: MetadataValue | MetadataValue[] | undefined) => {
	if (typeof value === 'string') {
		return value
	}
	if (Array.isArray(value)) {
		const found = value.find((item) => typeof item === 'string')
		return typeof found === 'string' ? found : undefined
	}
	return undefined
}

const detectLanguageFromMetadata = (metadata?: Metadata) => {
	if (!metadata) {
		return undefined
	}
	const keys = [
		'path',
		'filePath',
		'filepath',
		'filename',
		'fileName',
		'name',
		'sourcePath'
	]
	for (const key of keys) {
		const candidate = extractString(metadata[key])
		const detected = detectLanguageFromPath(candidate)
		if (detected) {
			return detected
		}
	}
	return undefined
}

const MAJOR_TYPES: Record<string, Set<string>> = {
	typescript: new Set([
		'function_declaration',
		'class_declaration',
		'interface_declaration',
		'type_alias_declaration',
		'enum_declaration',
		'lexical_declaration'
	]),
	javascript: new Set([
		'function_declaration',
		'class_declaration',
		'lexical_declaration'
	]),
	python: new Set([
		'function_definition',
		'class_definition',
		'decorated_definition'
	]),
	go: new Set(['function_declaration', 'method_declaration', 'type_declaration'])
}

const loadParser = () => {
	const ParserModule = requireOptional<TreeSitterModule>({
		id: 'tree-sitter',
		installHint: 'bunx unrag add chunker code',
		chunkerName: 'code'
	})
	return (ParserModule.default ?? ParserModule) as unknown as new () => {
		setLanguage: (lang: unknown) => void
		parse: (input: string) => {
			rootNode: {
				namedChildren: Array<{
					type: string
					startIndex: number
					endIndex: number
				}>
			}
		}
	}
}

const loadLanguage = (language: string) => {
	if (language === 'typescript') {
		const module = requireOptional<LanguageModule>({
			id: 'tree-sitter-typescript',
			installHint: 'bunx unrag add chunker code',
			chunkerName: 'code'
		})
		return module.typescript ?? module.tsx ?? module.default ?? module
	}
	if (language === 'javascript') {
		const module = requireOptional<LanguageModule>({
			id: 'tree-sitter-javascript',
			installHint: 'bunx unrag add chunker code',
			chunkerName: 'code'
		})
		return module.javascript ?? module.jsx ?? module.default ?? module
	}
	if (language === 'python') {
		const module = requireOptional<LanguageModule>({
			id: 'tree-sitter-python',
			installHint: 'bunx unrag add chunker code',
			chunkerName: 'code'
		})
		return module.default ?? module
	}
	const module = requireOptional<LanguageModule>({
		id: 'tree-sitter-go',
		installHint: 'bunx unrag add chunker code',
		chunkerName: 'code'
	})
	return module.default ?? module
}

export const codeChunker: Chunker = (
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

	const inferred =
		detectLanguageFromMetadata(options.metadata) ??
		detectLanguageFromPath(options.sourceId)
	const language = normalizeLanguage(options.language ?? inferred)
	const fallbackMajorTypes = MAJOR_TYPES[DEFAULT_LANGUAGE] ?? new Set()
	const majorTypes = MAJOR_TYPES[language] ?? fallbackMajorTypes

	let blocks: string[] = []
	try {
		const Parser = loadParser()
		const parser = new Parser()
		const lang = loadLanguage(language)
		parser.setLanguage(lang)

		const tree = parser.parse(content)
		const children = tree.rootNode.namedChildren

		let cursor = 0
		for (const child of children) {
			if (!majorTypes.has(child.type)) {
				continue
			}

			const prefix = content.slice(cursor, child.startIndex)
			if (prefix.trim()) {
				blocks.push(prefix)
			}

			const block = content.slice(child.startIndex, child.endIndex)
			if (block.trim()) {
				blocks.push(block)
			}
			cursor = child.endIndex
		}

		const tail = content.slice(cursor)
		if (tail.trim()) {
			blocks.push(tail)
		}
	} catch {
		blocks = [content]
	}

	if (blocks.length === 0) {
		blocks = [content]
	}

	const chunks = mergeSplits(blocks, chunkSize, chunkOverlap, minChunkSize)

	return chunks.map((chunkContent, index) => ({
		index,
		content: chunkContent,
		tokenCount: countTokens(chunkContent)
	}))
}

export const createCodeChunkerPlugin = (): ChunkerPlugin => ({
	name: 'code',
	createChunker: () => codeChunker
})

export const registerCodeChunker = (): void => {
	registerChunkerPlugin(createCodeChunkerPlugin())
}

registerCodeChunker()
