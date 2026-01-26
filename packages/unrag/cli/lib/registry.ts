import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {cancel, confirm, isCancel} from '@clack/prompts'
import {ensureDir, exists, listFilesRecursive} from './fs'
import type {EmbeddingProviderName, ExtractorName} from './packageJson'

export type RegistrySelection = {
	projectRoot: string
	registryRoot: string
	installDir: string // project-relative posix
	storeAdapter: 'drizzle' | 'prisma' | 'raw-sql'
	aliasBase: string // e.g. "@unrag"
	embeddingProvider?: EmbeddingProviderName
	full?: boolean
	withDocs?: boolean
	yes?: boolean // non-interactive
	overwrite?: 'skip' | 'force' // behavior when dest exists
	presetConfig?: {
		chunking?: {
			method?: string
			options?: {
				minChunkSize?: number
				model?: string
				language?: string
			}
		}
		defaults?: {
			chunking?: {chunkSize?: number; chunkOverlap?: number}
			retrieval?: {topK?: number}
		}
		embedding?: {
			provider?: string
			config?: {
				type?: 'text' | 'multimodal'
				model?: string
				timeoutMs?: number
			}
		}
		engine?: {
			storage?: {
				storeChunkContent?: boolean
				storeDocumentContent?: boolean
			}
			assetProcessing?: unknown
		}
	}
	chunkers?: string[]
	richMedia?: {
		enabled: boolean
		extractors: ExtractorName[]
	}
}

type FileMapping = {
	src: string // absolute
	dest: string // absolute
	transform?: (content: string) => string
}

const readText = (filePath: string) => readFile(filePath, 'utf8')

const toPosixPath = (p: string) => p.replace(/\\/g, '/')
const toProjectRelative = (projectRoot: string, absPath: string) =>
	toPosixPath(path.relative(projectRoot, absPath))

const writeText = async (filePath: string, content: string) => {
	await ensureDir(path.dirname(filePath))
	await writeFile(filePath, content, 'utf8')
}

const rewriteRegistryAliasImports = (content: string, aliasBase: string) => {
	// The registry sources are authored against an internal monorepo alias `@registry/*`.
	// When we vendor these sources into a user repo we must rewrite them to the user's configured
	// alias base (e.g. `@unrag/*` or `@rag/*`) so TS path mapping works.
	if (!content.includes('@registry')) {
		return content
	}
	// Most imports are `@registry/...`. Rewrite that form (and also handles `@registry/*`).
	return content.replaceAll('@registry/', `${aliasBase}/`)
}

const EXTRACTOR_FACTORY: Record<ExtractorName, string> = {
	'pdf-llm': 'createPdfLlmExtractor',
	'pdf-text-layer': 'createPdfTextLayerExtractor',
	'pdf-ocr': 'createPdfOcrExtractor',
	'image-ocr': 'createImageOcrExtractor',
	'image-caption-llm': 'createImageCaptionLlmExtractor',
	'audio-transcribe': 'createAudioTranscribeExtractor',
	'video-transcribe': 'createVideoTranscribeExtractor',
	'video-frames': 'createVideoFramesExtractor',
	'file-text': 'createFileTextExtractor',
	'file-docx': 'createFileDocxExtractor',
	'file-pptx': 'createFilePptxExtractor',
	'file-xlsx': 'createFileXlsxExtractor'
}

const EXTRACTOR_FLAG_KEYS: Record<ExtractorName, string[]> = {
	'pdf-text-layer': ['pdf_textLayer'],
	'pdf-llm': ['pdf_llmExtraction'],
	'pdf-ocr': ['pdf_ocr'],
	'image-ocr': ['image_ocr'],
	'image-caption-llm': ['image_captionLlm'],
	'audio-transcribe': ['audio_transcription'],
	'video-transcribe': ['video_transcription'],
	'video-frames': ['video_frames'],
	'file-text': ['file_text'],
	'file-docx': ['file_docx'],
	'file-pptx': ['file_pptx'],
	'file-xlsx': ['file_xlsx']
}

const _ALL_FLAG_KEYS = Array.from(
	new Set(Object.values(EXTRACTOR_FLAG_KEYS).flat())
).sort()

const _indentBlock = (text: string, spaces: number) => {
	const pad = ' '.repeat(spaces)
	return text
		.split('\n')
		.map((l) => (l ? pad + l : l))
		.join('\n')
}

const _ensureObject = (obj: Record<string, unknown>, key: string) => {
	const existing = obj[key]
	if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
		return existing as Record<string, unknown>
	}
	const next: Record<string, unknown> = {}
	obj[key] = next
	return next
}

const renderObjectLiteral = (
	value: Record<string, unknown>,
	indent: number
): string => {
	const pad = ' '.repeat(indent)
	const inner = Object.entries(value)
		.map(([key, val]) => {
			if (val && typeof val === 'object' && !Array.isArray(val)) {
				return `${pad}${key}: ${renderObjectLiteral(val as Record<string, unknown>, indent + 2)},`
			}
			return `${pad}${key}: ${JSON.stringify(val)},`
		})
		.join('\n')

	return `{\n${inner}\n${' '.repeat(Math.max(0, indent - 2))}}`
}

const EMBEDDING_PROVIDER_FILES: Record<EmbeddingProviderName, string> = {
	ai: 'embedding/ai.ts',
	openai: 'embedding/openai.ts',
	google: 'embedding/google.ts',
	openrouter: 'embedding/openrouter.ts',
	azure: 'embedding/azure.ts',
	vertex: 'embedding/vertex.ts',
	bedrock: 'embedding/bedrock.ts',
	cohere: 'embedding/cohere.ts',
	mistral: 'embedding/mistral.ts',
	together: 'embedding/together.ts',
	ollama: 'embedding/ollama.ts',
	voyage: 'embedding/voyage.ts'
}

const EMBEDDING_NEEDS_SHARED = new Set<EmbeddingProviderName>([
	'openai',
	'google',
	'openrouter',
	'azure',
	'vertex',
	'bedrock',
	'cohere',
	'mistral',
	'together',
	'ollama',
	'voyage'
])

const EMBEDDING_PROVIDER_FACTORY: Record<EmbeddingProviderName, string> = {
	ai: 'createAiEmbeddingProvider',
	openai: 'createOpenAiEmbeddingProvider',
	google: 'createGoogleEmbeddingProvider',
	openrouter: 'createOpenRouterEmbeddingProvider',
	azure: 'createAzureEmbeddingProvider',
	vertex: 'createVertexEmbeddingProvider',
	bedrock: 'createBedrockEmbeddingProvider',
	cohere: 'createCohereEmbeddingProvider',
	mistral: 'createMistralEmbeddingProvider',
	together: 'createTogetherEmbeddingProvider',
	ollama: 'createOllamaEmbeddingProvider',
	voyage: 'createVoyageEmbeddingProvider'
}

const renderEmbeddingProviders = (
	content: string,
	selection: RegistrySelection
) => {
	const provider = selection.embeddingProvider ?? 'ai'
	const full = Boolean(selection.full)
	const providers = full
		? (Object.keys(EMBEDDING_PROVIDER_FILES) as EmbeddingProviderName[])
		: [provider]

	const importLines = providers.map(
		(p) =>
			`import { ${EMBEDDING_PROVIDER_FACTORY[p]} } from "@registry/embedding/${p}";`
	)

	const caseLines = providers
		.map(
			(p) =>
				`case '${p}':\n      return ${EMBEDDING_PROVIDER_FACTORY[p]}(config.config);`
		)
		.join('\n')

	return content
		.replace('// __UNRAG_PROVIDER_IMPORTS__', importLines.join('\n'))
		.replace('// __UNRAG_PROVIDER_CASES__', caseLines)
}

const _replaceBetweenMarkers = (
	content: string,
	startMarker: string,
	endMarker: string,
	replacement: string
) => {
	const startIdx = content.indexOf(startMarker)
	const endIdx = content.indexOf(endMarker)
	if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
		return content
	}

	// Expand to whole lines so we don't leave indentation behind.
	const startLineStart = content.lastIndexOf('\n', startIdx)
	const start = startLineStart < 0 ? 0 : startLineStart + 1

	const endLineEnd = content.indexOf('\n', endIdx)
	const end = endLineEnd < 0 ? content.length : endLineEnd + 1

	return content.slice(0, start) + replacement + content.slice(end)
}

const renderUnragConfig = (content: string, selection: RegistrySelection) => {
	const installImportBase = `./${selection.installDir.replace(/\\/g, '/')}`
	const richMedia = selection.richMedia ?? {
		enabled: false,
		extractors: [] as ExtractorName[]
	}
	const selectedExtractors = Array.from(
		new Set(richMedia.extractors ?? [])
	).sort()
	const preset = selection.presetConfig
	const embeddingProvider =
		selection.embeddingProvider ??
		(typeof preset?.embedding?.provider === 'string'
			? (preset.embedding.provider as EmbeddingProviderName)
			: undefined) ??
		'ai'

	const baseImports = [
		`import { defineUnragConfig } from "${installImportBase}/core";`
	]

	const storeImports: string[] = []
	const storeCreateLines: string[] = []

	if (selection.storeAdapter === 'drizzle') {
		storeImports.push(
			`import { createDrizzleVectorStore } from "${installImportBase}/store/drizzle";`,
			`import { drizzle } from "drizzle-orm/node-postgres";`,
			`import { Pool } from "pg";`
		)
		storeCreateLines.push(
			'  const databaseUrl = process.env.DATABASE_URL;',
			'  if (!databaseUrl) {',
			'    throw new Error("DATABASE_URL is required");',
			'  }',
			'',
			'  const globalForUnrag = globalThis as unknown as {',
			'    __unragPool?: Pool;',
			'    __unragDrizzleDb?: ReturnType<typeof drizzle>;',
			'  };',
			'  const pool = globalForUnrag.__unragPool ?? new Pool({ connectionString: databaseUrl });',
			'  globalForUnrag.__unragPool = pool;',
			'',
			'  const db = globalForUnrag.__unragDrizzleDb ?? drizzle(pool);',
			'  globalForUnrag.__unragDrizzleDb = db;',
			'',
			'  const store = createDrizzleVectorStore(db);'
		)
	} else if (selection.storeAdapter === 'raw-sql') {
		storeImports.push(
			`import { createRawSqlVectorStore } from "${installImportBase}/store/raw-sql";`,
			`import { Pool } from "pg";`
		)
		storeCreateLines.push(
			'  const databaseUrl = process.env.DATABASE_URL;',
			'  if (!databaseUrl) {',
			'    throw new Error("DATABASE_URL is required");',
			'  }',
			'',
			'  const globalForUnrag = globalThis as unknown as {',
			'    __unragPool?: Pool;',
			'  };',
			'  const pool = globalForUnrag.__unragPool ?? new Pool({ connectionString: databaseUrl });',
			'  globalForUnrag.__unragPool = pool;',
			'',
			'  const store = createRawSqlVectorStore(pool);'
		)
	} else {
		storeImports.push(
			`import { createPrismaVectorStore } from "${installImportBase}/store/prisma";`,
			`import { PrismaClient } from "@prisma/client";`
		)
		storeCreateLines.push(
			'  const globalForUnrag = globalThis as unknown as {',
			'    __unragPrisma?: PrismaClient;',
			'  };',
			'  const prisma = globalForUnrag.__unragPrisma ?? new PrismaClient();',
			'  globalForUnrag.__unragPrisma = prisma;',
			'  const store = createPrismaVectorStore(prisma);'
		)
	}

	const extractorImports: string[] = []
	if (richMedia.enabled && selectedExtractors.length > 0) {
		for (const ex of selectedExtractors) {
			const factory = EXTRACTOR_FACTORY[ex]
			extractorImports.push(
				`import { ${factory} } from "${installImportBase}/extractors/${ex}";`
			)
		}
	}

	const chunkerImports = Array.from(
		new Set((selection.chunkers ?? []).map((c) => String(c).trim()))
	)
		.filter(Boolean)
		.sort()
		.map((chunker) => `import "${installImportBase}/chunkers/${chunker}";`)

	const importsBlock = [
		...baseImports,
		...storeImports,
		...chunkerImports,
		...extractorImports
	].join('\n')

	const createEngineBlock = [
		'export function createUnragEngine() {',
		...storeCreateLines,
		'',
		'  return unrag.createEngine({ store });',
		'}'
	].join('\n')

	let out = content
		.replace('// __UNRAG_IMPORTS__', importsBlock)
		.replace('// __UNRAG_CREATE_ENGINE__', createEngineBlock)

	// Remove `// @ts-nocheck` from user generated project
	out = out.replace(/^\s*\/\/\s*@ts-nocheck\s*\n+/m, '')

	// Apply preset defaults (chunking + retrieval) if provided.
	const presetChunkSize = preset?.defaults?.chunking?.chunkSize
	const presetChunkOverlap = preset?.defaults?.chunking?.chunkOverlap
	const presetTopK = preset?.defaults?.retrieval?.topK
	const presetChunkingMethod =
		typeof preset?.chunking?.method === 'string'
			? preset.chunking.method.trim()
			: undefined
	const presetMinChunkSize =
		typeof preset?.chunking?.options?.minChunkSize === 'number'
			? preset.chunking.options.minChunkSize
			: undefined
	const presetChunkerModel =
		typeof preset?.chunking?.options?.model === 'string'
			? preset.chunking.options.model.trim()
			: undefined
	const presetChunkerLanguage =
		typeof preset?.chunking?.options?.language === 'string'
			? preset.chunking.options.language.trim()
			: undefined

	if (typeof presetChunkSize === 'number') {
		out = out.replace(
			/chunkSize:\s*[\d_]+\s*,?\s*\/\/ __UNRAG_DEFAULT_chunkSize__/,
			`chunkSize: ${presetChunkSize}, // __UNRAG_DEFAULT_chunkSize__`
		)
	} else {
		out = out.replace(
			/chunkSize:\s*[\d_]+\s*,?\s*\/\/ __UNRAG_DEFAULT_chunkSize__/,
			'chunkSize: 200, // __UNRAG_DEFAULT_chunkSize__'
		)
	}
	if (typeof presetChunkOverlap === 'number') {
		out = out.replace(
			/chunkOverlap:\s*[\d_]+\s*,?\s*\/\/ __UNRAG_DEFAULT_chunkOverlap__/,
			`chunkOverlap: ${presetChunkOverlap}, // __UNRAG_DEFAULT_chunkOverlap__`
		)
	} else {
		out = out.replace(
			/chunkOverlap:\s*[\d_]+\s*,?\s*\/\/ __UNRAG_DEFAULT_chunkOverlap__/,
			'chunkOverlap: 40, // __UNRAG_DEFAULT_chunkOverlap__'
		)
	}
	if (typeof presetTopK === 'number') {
		out = out.replace(
			/topK:\s*[\d_]+\s*,?\s*\/\/ __UNRAG_DEFAULT_topK__/,
			`topK: ${presetTopK}, // __UNRAG_DEFAULT_topK__`
		)
	} else {
		out = out.replace(
			/topK:\s*[\d_]+\s*,?\s*\/\/ __UNRAG_DEFAULT_topK__/,
			'topK: 8, // __UNRAG_DEFAULT_topK__'
		)
	}

	// Chunking method (defaults to "recursive" in template).
	if (presetChunkingMethod) {
		out = out.replace(
			/method:\s*['"][^'"]*['"]\s*,?\s*\/\/ __UNRAG_CHUNKING_METHOD__/,
			`method: '${presetChunkingMethod}', // __UNRAG_CHUNKING_METHOD__`
		)
	}

	// Chunking options: minChunkSize is template-driven; model/language are inserted when provided.
	if (typeof presetMinChunkSize === 'number') {
		out = out.replace(
			/minChunkSize:\s*[\d_]+\s*,?\s*\/\/ __UNRAG_DEFAULT_minChunkSize__/,
			`minChunkSize: ${presetMinChunkSize} // __UNRAG_DEFAULT_minChunkSize__`
		)
	}

	const injectChunkingOption = (
		input: string,
		key: 'model' | 'language',
		value?: string
	) => {
		if (!value) {
			return input
		}
		// If key exists anywhere already, replace the first occurrence.
		const existing = new RegExp(`^([ \\t]*)${key}\\s*:\\s*[^\\n]*$`, 'm')
		if (existing.test(input)) {
			return input.replace(existing, (_m, indent: string) => {
				return `${indent}${key}: ${JSON.stringify(value)},`
			})
		}

		// Otherwise, insert inside the chunking.options block.
		const optionsRegex =
			/(chunking:\s*{[\s\S]*?options:\s*{)([\s\S]*?)(\n\s*}\s*,?)/m
		const match = input.match(optionsRegex)
		if (!match) {
			return input
		}
		const prefix = match[1] ?? ''
		const suffix = match[3] ?? ''
		let block = match[2] ?? ''
		const indentMatch = block.match(/\n([ \t]*)\w/)
		const indent = indentMatch?.[1] ?? '\t\t\t'
		// Insert after minChunkSize when present, else append.
		if (/^\s*minChunkSize\s*:/m.test(block)) {
			block = block.replace(
				/^\s*minChunkSize[^\n]*$/m,
				(line) => `${line.trimEnd().endsWith(',') ? line : `${line},`}\n${indent}${key}: ${JSON.stringify(value)},`
			)
		} else {
			block = `${block}\n${indent}${key}: ${JSON.stringify(value)},`
		}
		return input.replace(optionsRegex, `${prefix}${block}${suffix}`)
	}

	out = injectChunkingOption(out, 'model', presetChunkerModel)
	out = injectChunkingOption(out, 'language', presetChunkerLanguage)

	// Embedding config:
	// - Provider always comes from `selection.embeddingProvider` (or preset override, if provided).
	// - Preset can override model/timeout/type, but rich media should NOT implicitly flip embeddings to multimodal.
	const presetEmbeddingType = preset?.embedding?.config?.type
	const presetEmbeddingModel = preset?.embedding?.config?.model
	const presetEmbeddingTimeoutMs = preset?.embedding?.config?.timeoutMs

	out = out.replace(
		/^(\s*)provider:\s*['"][^'"]*['"],?\s*$/m,
		(_m, indent: string) => `${indent}provider: '${embeddingProvider}',`
	)

	const defaultModelByProvider: Record<string, string> = {
		ai: 'openai/text-embedding-3-small',
		openai: 'text-embedding-3-small',
		google: 'gemini-embedding-001',
		openrouter: 'text-embedding-3-small',
		azure: 'text-embedding-3-small',
		vertex: 'text-embedding-004',
		bedrock: 'amazon.titan-embed-text-v2:0',
		cohere: 'embed-english-v3.0',
		mistral: 'mistral-embed',
		together: 'togethercomputer/m2-bert-80M-2k-retrieval',
		ollama: 'nomic-embed-text',
		voyage: 'voyage-3.5-lite',
		custom: 'openai/text-embedding-3-small'
	}

	const resolvedEmbeddingModel = (() => {
		if (
			typeof presetEmbeddingModel === 'string' &&
			presetEmbeddingModel.trim().length > 0
		) {
			return presetEmbeddingModel.trim()
		}
		if (
			embeddingProvider === 'ai' &&
			presetEmbeddingType === 'multimodal'
		) {
			// Wizard default for multimodal via AI Gateway.
			return 'cohere/embed-v4.0'
		}
		return (
			defaultModelByProvider[embeddingProvider] ??
			'openai/text-embedding-3-small'
		)
	})()

	const normalizeModelForProvider = (model: string) => {
		if (embeddingProvider === 'ai') {
			return model
		}
		const prefix = `${embeddingProvider}/`
		return model.startsWith(prefix) ? model.slice(prefix.length) : model
	}

	const nextModel = normalizeModelForProvider(resolvedEmbeddingModel)
	out = out.replace(
		/^(\s*)model:\s*['"][^'"]*['"]\s*,?\s*\/\/ __UNRAG_EMBEDDING_MODEL__\s*$/m,
		(_m, indent: string) => `${indent}model: ${JSON.stringify(nextModel)},`
	)

	// Only opt-in to multimodal when explicitly requested by preset.
	if (presetEmbeddingType === 'multimodal') {
		if (
			!out.includes('type: "multimodal"') &&
			!out.includes('type: "text"')
		) {
			out = out.replace(
				'config: {\n      model:',
				`config: {\n      type: "multimodal",\n      model:`
			)
		} else {
			out = out.replace(
				/^\s*type:\s*".*?",\s*$/m,
				`      type: "multimodal",`
			)
		}
	}

	if (typeof presetEmbeddingTimeoutMs === 'number') {
		out = out.replace(
			/^(\s*)timeoutMs:\s*15_000\s*,?\s*\/\/ __UNRAG_EMBEDDING_TIMEOUT__\s*$/m,
			(_m, indent: string) =>
				`${indent}timeoutMs: ${presetEmbeddingTimeoutMs},`
		)
	} else {
		out = out.replace(
			/^(\s*)timeoutMs:\s*15_000\s*,?\s*\/\/ __UNRAG_EMBEDDING_TIMEOUT__\s*$/m,
			(_m, indent: string) => `${indent}timeoutMs: 15_000,`
		)
	}

	// Storage config (optional).
	const presetStoreChunkContent = preset?.engine?.storage?.storeChunkContent
	const presetStoreDocumentContent =
		preset?.engine?.storage?.storeDocumentContent
	if (typeof presetStoreChunkContent === 'boolean') {
		out = out.replace(
			/storeChunkContent:\s*true\s*,?\s*\/\/ __UNRAG_STORAGE_storeChunkContent__/,
			`storeChunkContent: ${presetStoreChunkContent},`
		)
	} else {
		out = out.replace(
			/storeChunkContent:\s*true\s*,?\s*\/\/ __UNRAG_STORAGE_storeChunkContent__/,
			'storeChunkContent: true,'
		)
	}
	if (typeof presetStoreDocumentContent === 'boolean') {
		out = out.replace(
			/storeDocumentContent:\s*true\s*,?\s*\/\/ __UNRAG_STORAGE_storeDocumentContent__/,
			`storeDocumentContent: ${presetStoreDocumentContent},`
		)
	} else {
		out = out.replace(
			/storeDocumentContent:\s*true\s*,?\s*\/\/ __UNRAG_STORAGE_storeDocumentContent__/,
			'storeDocumentContent: true,'
		)
	}

	// Asset processing: generate minimal overrides only when extractors are enabled.
	// If preset provides a full object, use it. Otherwise, omit assetProcessing entirely
	// for minimal installs, or generate minimal enable-only overrides when extractors are selected.
	const assetProcessingOverride = preset?.engine?.assetProcessing
	let assetProcessingBlock = ''

	if (
		assetProcessingOverride &&
		typeof assetProcessingOverride === 'object'
	) {
		// Preset provides full override - use it as-is
		const body = renderObjectLiteral(
			assetProcessingOverride as Record<string, unknown>,
			4
		)
		const bodyLines = body.split('\n')
		bodyLines.splice(
			bodyLines.length - 1,
			0,
			'    // __UNRAG_ASSET_PROCESSING_OVERRIDES__'
		)
		const bodyWithMarker = bodyLines.join('\n')
		assetProcessingBlock = `  assetProcessing: ${bodyWithMarker},\n`
	} else if (richMedia.enabled && selectedExtractors.length > 0) {
		// Generate minimal enable-only overrides for selected extractors
		const minimalOverrides: Record<string, unknown> = {}

		for (const ex of selectedExtractors) {
			const flagKeys = EXTRACTOR_FLAG_KEYS[ex] ?? []
			for (const flagKey of flagKeys) {
				// Map short flag keys to nested paths
				// e.g., "pdf_textLayer" -> { pdf: { textLayer: { enabled: true } } }
				if (flagKey === 'pdf_textLayer') {
					const pdf = _ensureObject(minimalOverrides, 'pdf')
					pdf.textLayer = {enabled: true}
				} else if (flagKey === 'pdf_llmExtraction') {
					const pdf = _ensureObject(minimalOverrides, 'pdf')
					pdf.llmExtraction = {enabled: true}
				} else if (flagKey === 'pdf_ocr') {
					const pdf = _ensureObject(minimalOverrides, 'pdf')
					pdf.ocr = {enabled: true}
				} else if (flagKey === 'image_ocr') {
					const image = _ensureObject(minimalOverrides, 'image')
					image.ocr = {enabled: true}
				} else if (flagKey === 'image_captionLlm') {
					const image = _ensureObject(minimalOverrides, 'image')
					image.captionLlm = {enabled: true}
				} else if (flagKey === 'audio_transcription') {
					const audio = _ensureObject(minimalOverrides, 'audio')
					audio.transcription = {enabled: true}
				} else if (flagKey === 'video_transcription') {
					const video = _ensureObject(minimalOverrides, 'video')
					video.transcription = {enabled: true}
				} else if (flagKey === 'video_frames') {
					const video = _ensureObject(minimalOverrides, 'video')
					video.frames = {enabled: true}
				} else if (flagKey === 'file_text') {
					const file = _ensureObject(minimalOverrides, 'file')
					file.text = {enabled: true}
				} else if (flagKey === 'file_docx') {
					const file = _ensureObject(minimalOverrides, 'file')
					file.docx = {enabled: true}
				} else if (flagKey === 'file_pptx') {
					const file = _ensureObject(minimalOverrides, 'file')
					file.pptx = {enabled: true}
				} else if (flagKey === 'file_xlsx') {
					const file = _ensureObject(minimalOverrides, 'file')
					file.xlsx = {enabled: true}
				}
			}
		}

		if (Object.keys(minimalOverrides).length > 0) {
			const body = renderObjectLiteral(minimalOverrides, 4)
			const bodyLines = body.split('\n')
			bodyLines.splice(
				bodyLines.length - 1,
				0,
				'    // __UNRAG_ASSET_PROCESSING_OVERRIDES__'
			)
			const bodyWithMarker = bodyLines.join('\n')
			assetProcessingBlock = `  assetProcessing: ${bodyWithMarker},\n`
		}
	}
	// If no extractors and no preset override, assetProcessingBlock remains empty (omitted)

	// Replace the marker line with the generated block (or remove it).
	// We include a leading comma so the block can be injected after the `extractors: [...]` property.
	out = out.replace(
		/^([ \t]*)\/\/ __UNRAG_ASSET_PROCESSING_OVERRIDES__\s*$/m,
		(_m: string, indent: string) => {
			if (!assetProcessingBlock) {
				return ''
			}
			return `${indent},\n${indent}${assetProcessingBlock.trimEnd()}`
		}
	)

	// Inject extractor list (or remove placeholder) without depending on exact indentation.
	out = out.replace(
		/^([ \t]*)\/\/ __UNRAG_EXTRACTORS__\s*$/m,
		(_m: string, indent: string) => {
			if (!(richMedia.enabled && selectedExtractors.length > 0)) {
				return ''
			}
			return selectedExtractors
				.map((ex) => `${indent}${EXTRACTOR_FACTORY[ex]}(),`)
				.join('\n')
		}
	)

	return out
}

const renderDocs = (content: string, selection: RegistrySelection) => {
	const notes: string[] = []
	const embeddingProvider = selection.embeddingProvider ?? 'ai'

	if (selection.storeAdapter === 'drizzle') {
		notes.push(
			'## Store adapter: Drizzle',
			'',
			'You can import the generated Drizzle schema module into your app’s main Drizzle schema to avoid duplicating table definitions.',
			'',
			'Example pattern:',
			'```ts',
			`import * as rag from "./${selection.installDir}/store/drizzle/schema";`,
			'',
			'export const schema = {',
			'  ...rag.schema,',
			'  // ...your app tables',
			'};',
			'```',
			'',
			'Then run Drizzle migrations from your app as usual.'
		)
	} else if (selection.storeAdapter === 'prisma') {
		notes.push(
			'## Store adapter: Prisma',
			'',
			'This adapter uses `prisma.$executeRaw` / `prisma.$queryRaw` so you can keep your Prisma models minimal or skip them entirely.',
			'',
			'If you want Prisma models, pgvector is typically represented as `Unsupported("vector")`.',
			'You can still run migrations however you prefer (SQL migrations are the simplest for pgvector).'
		)
	} else {
		notes.push(
			'## Store adapter: Raw SQL',
			'',
			'This adapter uses a `pg` Pool and parameterized SQL queries against the tables described above.',
			'It’s the most portable option when you don’t want ORM coupling.'
		)
	}

	const envLines: string[] = [
		'## Environment variables',
		'',
		'Add these to your environment:',
		'- `DATABASE_URL` (Postgres connection string)'
	]

	if (embeddingProvider === 'ai') {
		envLines.push(
			'- `AI_GATEWAY_API_KEY` (required by the AI SDK when using Vercel AI Gateway)',
			'- Optional: `AI_GATEWAY_MODEL` (defaults to `openai/text-embedding-3-small`)'
		)
	} else if (embeddingProvider === 'openai') {
		envLines.push(
			'- `OPENAI_API_KEY`',
			'- Optional: `OPENAI_EMBEDDING_MODEL` (defaults to `text-embedding-3-small`)'
		)
	} else if (embeddingProvider === 'google') {
		envLines.push(
			'- `GOOGLE_GENERATIVE_AI_API_KEY`',
			'- Optional: `GOOGLE_GENERATIVE_AI_EMBEDDING_MODEL` (defaults to `gemini-embedding-001`)'
		)
	} else if (embeddingProvider === 'openrouter') {
		envLines.push(
			'- `OPENROUTER_API_KEY`',
			'- Optional: `OPENROUTER_EMBEDDING_MODEL` (defaults to `text-embedding-3-small`)'
		)
	} else if (embeddingProvider === 'cohere') {
		envLines.push(
			'- `COHERE_API_KEY`',
			'- Optional: `COHERE_EMBEDDING_MODEL` (defaults to `embed-english-v3.0`)'
		)
	} else if (embeddingProvider === 'mistral') {
		envLines.push(
			'- `MISTRAL_API_KEY`',
			'- Optional: `MISTRAL_EMBEDDING_MODEL` (defaults to `mistral-embed`)'
		)
	} else if (embeddingProvider === 'together') {
		envLines.push(
			'- `TOGETHER_AI_API_KEY`',
			'- Optional: `TOGETHER_AI_EMBEDDING_MODEL` (defaults to `togethercomputer/m2-bert-80M-2k-retrieval`)'
		)
	} else if (embeddingProvider === 'voyage') {
		envLines.push(
			'- `VOYAGE_API_KEY`',
			'- Optional: `VOYAGE_MODEL` (defaults to `voyage-3.5-lite`)'
		)
	} else if (embeddingProvider === 'ollama') {
		envLines.push(
			'- Optional: `OLLAMA_EMBEDDING_MODEL` (defaults to `nomic-embed-text`)'
		)
	} else if (embeddingProvider === 'azure') {
		envLines.push(
			'- `AZURE_OPENAI_API_KEY`',
			'- `AZURE_RESOURCE_NAME`',
			'- Optional: `AZURE_EMBEDDING_MODEL` (defaults to `text-embedding-3-small`)'
		)
	} else if (embeddingProvider === 'vertex') {
		envLines.push(
			'- `GOOGLE_APPLICATION_CREDENTIALS` (when running outside GCP)',
			'- Optional: `GOOGLE_VERTEX_EMBEDDING_MODEL` (defaults to `text-embedding-004`)'
		)
	} else if (embeddingProvider === 'bedrock') {
		envLines.push(
			'- `AWS_REGION`',
			'- AWS credentials (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) when running outside AWS',
			'- Optional: `BEDROCK_EMBEDDING_MODEL` (defaults to `amazon.titan-embed-text-v2:0`)'
		)
	}

	// Replace the template env vars section with the provider-specific one.
	const withEnv = content.replace(
		/## Environment variables[\s\S]*?## Database requirements/,
		`${envLines.join('\n')}\n\n## Database requirements`
	)

	const withNotes = withEnv.replace(
		'<!-- __UNRAG_ADAPTER_NOTES__ -->',
		notes.join('\n')
	)
	return withNotes
		.replaceAll('@unrag/config', `${selection.aliasBase}/config`)
		.replaceAll('`@unrag/*`', `\`${selection.aliasBase}/*\``)
}

export async function copyRegistryFiles(
	selection: RegistrySelection
): Promise<string[]> {
	const toAbs = (projectRelative: string) =>
		path.join(selection.projectRoot, projectRelative)

	const installBaseAbs = toAbs(selection.installDir)

	const fileMappings: FileMapping[] = [
		// root config
		{
			src: path.join(selection.registryRoot, 'config/unrag.config.ts'),
			dest: toAbs('unrag.config.ts'),
			transform: (c) => renderUnragConfig(c, selection)
		},

		// core
		{
			src: path.join(selection.registryRoot, 'core/index.ts'),
			dest: path.join(installBaseAbs, 'core/index.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/assets.ts'),
			dest: path.join(installBaseAbs, 'core/assets.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/types.ts'),
			dest: path.join(installBaseAbs, 'core/types.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/connectors.ts'),
			dest: path.join(installBaseAbs, 'core/connectors.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/chunking.ts'),
			dest: path.join(installBaseAbs, 'core/chunking.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/config.ts'),
			dest: path.join(installBaseAbs, 'core/config.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/deep-merge.ts'),
			dest: path.join(installBaseAbs, 'core/deep-merge.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/context-engine.ts'),
			dest: path.join(installBaseAbs, 'core/context-engine.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/delete.ts'),
			dest: path.join(installBaseAbs, 'core/delete.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/ingest.ts'),
			dest: path.join(installBaseAbs, 'core/ingest.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/retrieve.ts'),
			dest: path.join(installBaseAbs, 'core/retrieve.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/rerank.ts'),
			dest: path.join(installBaseAbs, 'core/rerank.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/debug-emitter.ts'),
			dest: path.join(installBaseAbs, 'core/debug-emitter.ts')
		},
		{
			src: path.join(selection.registryRoot, 'core/debug-events.ts'),
			dest: path.join(installBaseAbs, 'core/debug-events.ts')
		},

		// extractor shared utilities (used by core ingestion and extractor modules)
		{
			src: path.join(
				selection.registryRoot,
				'extractors/_shared/fetch.ts'
			),
			dest: path.join(installBaseAbs, 'extractors/_shared/fetch.ts')
		},

		// embedding dispatcher (generated)
		{
			src: path.join(selection.registryRoot, 'embedding/providers.ts'),
			dest: path.join(installBaseAbs, 'embedding/providers.ts'),
			transform: (c) => renderEmbeddingProviders(c, selection)
		}
	]

	// Optional docs
	if (selection.withDocs) {
		fileMappings.push({
			src: path.join(selection.registryRoot, 'docs/unrag.md'),
			dest: path.join(installBaseAbs, 'unrag.md'),
			transform: (c) => renderDocs(c, selection)
		})
	}

	const richMediaEnabled = Boolean(selection.richMedia?.enabled)
	const fullScaffold = Boolean(selection.full)

	// Include extractor shared utilities only when needed.
	if (fullScaffold || richMediaEnabled) {
		fileMappings.push(
			{
				src: path.join(
					selection.registryRoot,
					'extractors/_shared/media.ts'
				),
				dest: path.join(installBaseAbs, 'extractors/_shared/media.ts')
			},
			{
				src: path.join(
					selection.registryRoot,
					'extractors/_shared/text.ts'
				),
				dest: path.join(installBaseAbs, 'extractors/_shared/text.ts')
			}
		)
	}

	// Embedding providers (slim by default, full on demand).
	const provider = selection.embeddingProvider ?? 'ai'
	const providers = fullScaffold
		? (Object.keys(EMBEDDING_PROVIDER_FILES) as EmbeddingProviderName[])
		: [provider]

	if (fullScaffold || EMBEDDING_NEEDS_SHARED.has(provider)) {
		fileMappings.push({
			src: path.join(selection.registryRoot, 'embedding/_shared.ts'),
			dest: path.join(installBaseAbs, 'embedding/_shared.ts')
		})
	}

	for (const p of providers) {
		const file = EMBEDDING_PROVIDER_FILES[p]
		fileMappings.push({
			src: path.join(selection.registryRoot, file),
			dest: path.join(installBaseAbs, file)
		})
	}

	// store
	if (selection.storeAdapter === 'drizzle') {
		fileMappings.push(
			{
				src: path.join(
					selection.registryRoot,
					'store/drizzle/index.ts'
				),
				dest: path.join(installBaseAbs, 'store/drizzle/index.ts')
			},
			{
				src: path.join(
					selection.registryRoot,
					'store/drizzle/schema.ts'
				),
				dest: path.join(installBaseAbs, 'store/drizzle/schema.ts')
			},
			{
				src: path.join(
					selection.registryRoot,
					'store/drizzle/store.ts'
				),
				dest: path.join(installBaseAbs, 'store/drizzle/store.ts')
			}
		)
	} else if (selection.storeAdapter === 'raw-sql') {
		fileMappings.push(
			{
				src: path.join(
					selection.registryRoot,
					'store/raw-sql/index.ts'
				),
				dest: path.join(installBaseAbs, 'store/raw-sql/index.ts')
			},
			{
				src: path.join(
					selection.registryRoot,
					'store/raw-sql/store.ts'
				),
				dest: path.join(installBaseAbs, 'store/raw-sql/store.ts')
			}
		)
	} else {
		fileMappings.push(
			{
				src: path.join(selection.registryRoot, 'store/prisma/index.ts'),
				dest: path.join(installBaseAbs, 'store/prisma/index.ts')
			},
			{
				src: path.join(selection.registryRoot, 'store/prisma/store.ts'),
				dest: path.join(installBaseAbs, 'store/prisma/store.ts')
			}
		)
	}

	const nonInteractive = Boolean(selection.yes) || !process.stdin.isTTY
	const overwritePolicy = selection.overwrite ?? 'skip'

	const managedFiles = fileMappings.map((mapping) =>
		toProjectRelative(selection.projectRoot, mapping.dest)
	)

	// overwrite handling
	for (const mapping of fileMappings) {
		if (!(await exists(mapping.src))) {
			throw new Error(`Registry file missing: ${mapping.src}`)
		}

		if (await exists(mapping.dest)) {
			if (overwritePolicy === 'force') {
				// always overwrite
			} else if (nonInteractive) {
				// never overwrite in non-interactive mode
				continue
			} else {
				const answer = await confirm({
					message: `Overwrite ${path.relative(selection.projectRoot, mapping.dest)}?`,
					initialValue: false
				})
				if (isCancel(answer)) {
					cancel('Cancelled.')
					return []
				}
				if (!answer) {
					continue
				}
			}
		}

		const raw = await readText(mapping.src)
		const transformed = mapping.transform ? mapping.transform(raw) : raw
		const content = rewriteRegistryAliasImports(
			transformed,
			selection.aliasBase
		)
		await writeText(mapping.dest, content)
	}

	return managedFiles
}

export type ConnectorSelection = {
	projectRoot: string
	registryRoot: string
	installDir: string // project-relative posix
	aliasBase: string // e.g. "@unrag"
	connector: string // e.g. "notion"
	yes?: boolean // non-interactive skip-overwrite
	overwrite?: 'skip' | 'force'
}

export async function copyConnectorFiles(
	selection: ConnectorSelection
): Promise<string[]> {
	const toAbs = (projectRelative: string) =>
		path.join(selection.projectRoot, projectRelative)

	const installBaseAbs = toAbs(selection.installDir)
	const connectorRegistryAbs = path.join(
		selection.registryRoot,
		'connectors',
		selection.connector
	)

	if (!(await exists(connectorRegistryAbs))) {
		throw new Error(
			`Unknown connector registry: ${path.relative(selection.registryRoot, connectorRegistryAbs)}`
		)
	}

	const files = await listFilesRecursive(connectorRegistryAbs)

	const destRootAbs = path.join(
		installBaseAbs,
		'connectors',
		selection.connector
	)

	const nonInteractive = Boolean(selection.yes) || !process.stdin.isTTY
	const overwritePolicy = selection.overwrite ?? 'skip'

	const managedFiles = new Set<string>()
	for (const src of files) {
		if (!(await exists(src))) {
			throw new Error(`Registry file missing: ${src}`)
		}

		const rel = path.relative(connectorRegistryAbs, src)
		const dest = path.join(destRootAbs, rel)

		if (await exists(dest)) {
			if (overwritePolicy === 'force') {
				// always overwrite
			} else if (nonInteractive) {
				continue
			}

			const answer = await confirm({
				message: `Overwrite ${path.relative(selection.projectRoot, dest)}?`,
				initialValue: false
			})
			if (isCancel(answer)) {
				cancel('Cancelled.')
				return []
			}
			if (!answer) {
				continue
			}
		}

		const raw = await readText(src)
		const content = rewriteRegistryAliasImports(raw, selection.aliasBase)
		await writeText(dest, content)
	}

	for (const src of files) {
		const rel = path.relative(connectorRegistryAbs, src)
		const dest = path.join(destRootAbs, rel)
		managedFiles.add(toProjectRelative(selection.projectRoot, dest))
	}

	return Array.from(managedFiles)
}

export type ExtractorSelection = {
	projectRoot: string
	registryRoot: string
	installDir: string // project-relative posix
	aliasBase: string // e.g. "@unrag"
	extractor: string // e.g. "pdf-llm"
	yes?: boolean // non-interactive skip-overwrite
	overwrite?: 'skip' | 'force'
}

export async function copyExtractorFiles(
	selection: ExtractorSelection
): Promise<string[]> {
	const toAbs = (projectRelative: string) =>
		path.join(selection.projectRoot, projectRelative)

	const installBaseAbs = toAbs(selection.installDir)
	const extractorRegistryAbs = path.join(
		selection.registryRoot,
		'extractors',
		selection.extractor
	)
	const sharedRegistryAbs = path.join(
		selection.registryRoot,
		'extractors',
		'_shared'
	)

	if (!(await exists(extractorRegistryAbs))) {
		throw new Error(
			`Unknown extractor registry: ${path.relative(selection.registryRoot, extractorRegistryAbs)}`
		)
	}

	const extractorFiles = await listFilesRecursive(extractorRegistryAbs)
	const sharedFiles = (await exists(sharedRegistryAbs))
		? await listFilesRecursive(sharedRegistryAbs)
		: []

	const destRootAbs = path.join(
		installBaseAbs,
		'extractors',
		selection.extractor
	)
	const sharedDestRootAbs = path.join(installBaseAbs, 'extractors', '_shared')

	const nonInteractive = Boolean(selection.yes) || !process.stdin.isTTY
	const overwritePolicy = selection.overwrite ?? 'skip'

	const shouldWrite = async (src: string, dest: string): Promise<boolean> => {
		if (!(await exists(dest))) {
			return true
		}

		if (overwritePolicy === 'force') {
			return true
		}

		// In non-interactive mode we never overwrite existing files.
		if (nonInteractive) {
			return false
		}

		// If the contents are identical, don't prompt.
		try {
			const [srcRaw, destRaw] = await Promise.all([
				readText(src),
				readText(dest)
			])
			const nextSrc = rewriteRegistryAliasImports(
				srcRaw,
				selection.aliasBase
			)
			if (nextSrc === destRaw) {
				return false
			}
		} catch {
			// If reads fail for any reason, fall back to prompting.
		}

		const answer = await confirm({
			message: `Overwrite ${path.relative(selection.projectRoot, dest)}?`,
			initialValue: false
		})
		if (isCancel(answer)) {
			cancel('Cancelled.')
			return false
		}
		return Boolean(answer)
	}

	const managedFiles = new Set<string>()

	// Copy extractor files.
	for (const src of extractorFiles) {
		if (!(await exists(src))) {
			throw new Error(`Registry file missing: ${src}`)
		}

		const rel = path.relative(extractorRegistryAbs, src)
		const dest = path.join(destRootAbs, rel)
		if (!(await shouldWrite(src, dest))) {
			continue
		}

		const raw = await readText(src)
		const content = rewriteRegistryAliasImports(raw, selection.aliasBase)
		await writeText(dest, content)
	}

	// Copy shared extractor utilities (if present).
	for (const src of sharedFiles) {
		if (!(await exists(src))) {
			throw new Error(`Registry file missing: ${src}`)
		}

		const rel = path.relative(sharedRegistryAbs, src)
		const dest = path.join(sharedDestRootAbs, rel)
		if (!(await shouldWrite(src, dest))) {
			continue
		}

		const raw = await readText(src)
		const content = rewriteRegistryAliasImports(raw, selection.aliasBase)
		await writeText(dest, content)
	}

	for (const src of extractorFiles) {
		const rel = path.relative(extractorRegistryAbs, src)
		const dest = path.join(destRootAbs, rel)
		managedFiles.add(toProjectRelative(selection.projectRoot, dest))
	}
	for (const src of sharedFiles) {
		const rel = path.relative(sharedRegistryAbs, src)
		const dest = path.join(sharedDestRootAbs, rel)
		managedFiles.add(toProjectRelative(selection.projectRoot, dest))
	}

	return Array.from(managedFiles)
}

export type ChunkerSelection = {
	projectRoot: string
	registryRoot: string
	installDir: string // project-relative posix
	aliasBase: string // e.g. "@unrag"
	chunker: string // e.g. "semantic"
	yes?: boolean // non-interactive skip-overwrite
	overwrite?: 'skip' | 'force'
}

export async function copyChunkerFiles(
	selection: ChunkerSelection
): Promise<string[]> {
	const toAbs = (projectRelative: string) =>
		path.join(selection.projectRoot, projectRelative)

	const installBaseAbs = toAbs(selection.installDir)
	const chunkerRegistryAbs = path.join(
		selection.registryRoot,
		'chunkers',
		selection.chunker
	)
	const sharedRegistryAbs = path.join(
		selection.registryRoot,
		'chunkers',
		'_shared'
	)

	if (!(await exists(chunkerRegistryAbs))) {
		throw new Error(
			`Unknown chunker registry: ${path.relative(selection.registryRoot, chunkerRegistryAbs)}`
		)
	}

	const chunkerFiles = await listFilesRecursive(chunkerRegistryAbs)
	const sharedFiles = (await exists(sharedRegistryAbs))
		? await listFilesRecursive(sharedRegistryAbs)
		: []

	const destRootAbs = path.join(installBaseAbs, 'chunkers', selection.chunker)
	const sharedDestRootAbs = path.join(installBaseAbs, 'chunkers', '_shared')

	const nonInteractive = Boolean(selection.yes) || !process.stdin.isTTY
	const overwritePolicy = selection.overwrite ?? 'skip'

	const shouldWrite = async (src: string, dest: string): Promise<boolean> => {
		if (!(await exists(dest))) {
			return true
		}

		if (overwritePolicy === 'force') {
			return true
		}

		if (nonInteractive) {
			return false
		}

		try {
			const [srcRaw, destRaw] = await Promise.all([
				readText(src),
				readText(dest)
			])
			const nextSrc = rewriteRegistryAliasImports(
				srcRaw,
				selection.aliasBase
			)
			if (nextSrc === destRaw) {
				return false
			}
		} catch {
			// Fall back to prompting below.
		}

		const answer = await confirm({
			message: `Overwrite ${path.relative(selection.projectRoot, dest)}?`,
			initialValue: false
		})
		if (isCancel(answer)) {
			cancel('Cancelled.')
			return false
		}
		return Boolean(answer)
	}

	const managedFiles = new Set<string>()

	for (const src of chunkerFiles) {
		if (!(await exists(src))) {
			throw new Error(`Registry file missing: ${src}`)
		}

		const rel = path.relative(chunkerRegistryAbs, src)
		const dest = path.join(destRootAbs, rel)
		if (!(await shouldWrite(src, dest))) {
			continue
		}

		const raw = await readText(src)
		const content = rewriteRegistryAliasImports(raw, selection.aliasBase)
		await writeText(dest, content)
	}

	for (const src of sharedFiles) {
		if (!(await exists(src))) {
			throw new Error(`Registry file missing: ${src}`)
		}

		const rel = path.relative(sharedRegistryAbs, src)
		const dest = path.join(sharedDestRootAbs, rel)
		if (!(await shouldWrite(src, dest))) {
			continue
		}

		const raw = await readText(src)
		const content = rewriteRegistryAliasImports(raw, selection.aliasBase)
		await writeText(dest, content)
	}

	for (const src of chunkerFiles) {
		const rel = path.relative(chunkerRegistryAbs, src)
		const dest = path.join(destRootAbs, rel)
		managedFiles.add(toProjectRelative(selection.projectRoot, dest))
	}
	for (const src of sharedFiles) {
		const rel = path.relative(sharedRegistryAbs, src)
		const dest = path.join(sharedDestRootAbs, rel)
		managedFiles.add(toProjectRelative(selection.projectRoot, dest))
	}

	return Array.from(managedFiles)
}

export type BatterySelection = {
	projectRoot: string
	registryRoot: string
	installDir: string // project-relative posix
	aliasBase: string // e.g. "@unrag"
	battery: string // e.g. "reranker"
	yes?: boolean // non-interactive skip-overwrite
	overwrite?: 'skip' | 'force'
}

export async function copyBatteryFiles(
	selection: BatterySelection
): Promise<string[]> {
	const toAbs = (projectRelative: string) =>
		path.join(selection.projectRoot, projectRelative)

	const installBaseAbs = toAbs(selection.installDir)

	// Batteries are stored in registry/<batteryName>/ (e.g., registry/rerank/)
	// but we install them as <installDir>/<batteryName>/ (e.g., lib/unrag/rerank/)
	const batteryRegistryDir =
		selection.battery === 'reranker' ? 'rerank' : selection.battery
	const batteryRegistryAbs = path.join(
		selection.registryRoot,
		batteryRegistryDir
	)

	if (!(await exists(batteryRegistryAbs))) {
		throw new Error(
			`Unknown battery registry: ${path.relative(selection.registryRoot, batteryRegistryAbs)}`
		)
	}

	const batteryFiles = await listFilesRecursive(batteryRegistryAbs)
	const filteredBatteryFiles = batteryFiles.filter((abs) => {
		// For the debug battery, only install the runtime (server/client/types/commands).
		// The Ink/React TUI is shipped with the CLI as a prebuilt bundle.
		if (batteryRegistryDir === 'debug') {
			const rel = path
				.relative(batteryRegistryAbs, abs)
				.replace(/\\/g, '/')
			if (rel === 'tui' || rel.startsWith('tui/')) {
				return false
			}
		}
		return true
	})

	const destRootAbs = path.join(installBaseAbs, batteryRegistryDir)

	const nonInteractive = Boolean(selection.yes) || !process.stdin.isTTY
	const overwritePolicy = selection.overwrite ?? 'skip'

	const shouldWrite = async (src: string, dest: string): Promise<boolean> => {
		if (!(await exists(dest))) {
			return true
		}

		if (overwritePolicy === 'force') {
			return true
		}

		// In non-interactive mode we never overwrite existing files.
		if (nonInteractive) {
			return false
		}

		// If the contents are identical, don't prompt.
		try {
			const [srcRaw, destRaw] = await Promise.all([
				readText(src),
				readText(dest)
			])
			const nextSrc = rewriteRegistryAliasImports(
				srcRaw,
				selection.aliasBase
			)
			if (nextSrc === destRaw) {
				return false
			}
		} catch {
			// If reads fail for any reason, fall back to prompting.
		}

		const answer = await confirm({
			message: `Overwrite ${path.relative(selection.projectRoot, dest)}?`,
			initialValue: false
		})
		if (isCancel(answer)) {
			cancel('Cancelled.')
			return false
		}
		return Boolean(answer)
	}

	const managedFiles = new Set<string>()

	// Copy battery files.
	for (const src of filteredBatteryFiles) {
		if (!(await exists(src))) {
			throw new Error(`Registry file missing: ${src}`)
		}

		const rel = path.relative(batteryRegistryAbs, src)
		const dest = path.join(destRootAbs, rel)
		if (!(await shouldWrite(src, dest))) {
			continue
		}

		const raw = await readText(src)
		const content = rewriteRegistryAliasImports(raw, selection.aliasBase)
		await writeText(dest, content)
	}

	for (const src of filteredBatteryFiles) {
		const rel = path.relative(batteryRegistryAbs, src)
		const dest = path.join(destRootAbs, rel)
		managedFiles.add(toProjectRelative(selection.projectRoot, dest))
	}

	return Array.from(managedFiles)
}
