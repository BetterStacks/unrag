export type MetadataValue = string | number | boolean | null

export type Metadata = Record<
	string,
	MetadataValue | MetadataValue[] | undefined
>

/**
 * Standard fields for asset-related metadata.
 * These are added to chunk metadata when chunks are derived from assets.
 */
export interface AssetMetadataFields {
	assetKind?: 'image' | 'pdf' | 'audio' | 'video' | 'file'
	assetId?: string
	assetUri?: string
	assetMediaType?: string
	extractor?: string
}

/**
 * Type guard for checking if metadata contains required asset fields.
 */
export function hasAssetMetadata(
	metadata: Metadata
): metadata is Metadata &
	Required<Pick<AssetMetadataFields, 'assetKind' | 'assetId'>> {
	return (
		typeof metadata.assetKind === 'string' &&
		typeof metadata.assetId === 'string'
	)
}

export type Chunk = {
	id: string
	documentId: string
	sourceId: string
	index: number
	content: string
	tokenCount: number
	metadata: Metadata
	embedding?: number[]
	documentContent?: string
}

/**
 * Controls what text Unrag persists to the backing store.
 *
 * - `storeChunkContent`: whether to persist `chunks.content` (what you get back as `chunk.content` in retrieval).
 * - `storeDocumentContent`: whether to persist the full original document text (`documents.content`).
 *
 * Disabling these can be useful for privacy/compliance or when you have an external
 * content store and want Unrag to keep only embeddings + identifiers/metadata.
 */
export type ContentStorageConfig = {
	storeChunkContent: boolean
	storeDocumentContent: boolean
}

/**
 * Controls performance characteristics of embedding during ingest.
 *
 * These defaults are intentionally conservative to reduce rate-limit risk.
 */
export type EmbeddingProcessingConfig = {
	/**
	 * Maximum number of concurrent embedding requests.
	 * This applies to both text embedding (embed/embedMany) and image embedding (embedImage).
	 */
	concurrency: number
	/**
	 * Max number of text chunks per embedMany batch (when embedMany is supported).
	 * Ignored when the provider does not implement embedMany().
	 */
	batchSize: number
}

export type ChunkText = {
	index: number
	content: string
	tokenCount: number
}

/**
 * Chunking options for token-based recursive chunking.
 * All sizes are in TOKENS (not characters or words).
 */
export type ChunkingOptions = {
	/**
	 * Maximum chunk size in tokens.
	 * Default: 512
	 */
	chunkSize: number
	/**
	 * Number of overlapping tokens between consecutive chunks.
	 * Default: 50
	 */
	chunkOverlap: number
	/**
	 * Minimum chunk size in tokens. Chunks smaller than this will be merged.
	 * Default: 24
	 */
	minChunkSize?: number
	/**
	 * Custom separator hierarchy for recursive splitting.
	 * Default: ['\n\n', '\n', '. ', '? ', '! ', '; ', ': ', ', ', ' ', '']
	 */
	separators?: string[]
	/**
	 * Optional model override for LLM-driven chunkers (semantic/agentic).
	 */
	model?: string
	/**
	 * Optional language hint for code chunker (typescript, javascript, python, go).
	 */
	language?: string
	/**
	 * Source identifier for the current document (used for per-file inference).
	 */
	sourceId?: string
	/**
	 * Document metadata available during chunking.
	 */
	metadata?: Metadata
}

export type ChunkerResult = ChunkText[] | Promise<ChunkText[]>

export type Chunker = (
	content: string,
	options: ChunkingOptions
) => ChunkerResult

// ---------------------------------------------------------------------------
// Chunking method & plugin types
// ---------------------------------------------------------------------------

/**
 * Built-in chunking methods shipped with core.
 * Uses token-based recursive chunking with js-tiktoken (o200k_base encoding).
 */
export type BuiltInChunkingMethod = 'recursive' | 'token'

/**
 * Plugin chunking methods (installed via CLI).
 */
export type PluginChunkingMethod =
	| 'semantic'
	| 'markdown'
	| 'hierarchical'
	| 'code'
	| 'agentic'
	| 'late'
	| 'maxmin'
	| 'proposition'

/**
 * All supported chunking methods.
 */
export type ChunkingMethod =
	| BuiltInChunkingMethod
	| PluginChunkingMethod
	| 'custom'

/**
 * Chunking configuration for unrag.config.ts.
 */
export type ChunkingConfig = {
	/**
	 * Chunking method to use. Default: "recursive".
	 * Built-in: "recursive" (token-based recursive), "token" (fixed-size tokens)
	 * Plugins: "semantic", "markdown", "hierarchical", "code", "agentic", "late", "maxmin", "proposition"
	 */
	method?: ChunkingMethod
	/**
	 * Method-specific options. Shape depends on the chosen method.
	 */
	options?: ChunkingOptions & Record<string, unknown>
	/**
	 * Custom chunker function. Only used when method is "custom".
	 */
	chunker?: Chunker
}

/**
 * Plugin interface for chunker modules.
 * Installed via `bunx unrag add chunker:<name>`.
 */
export type ChunkerPlugin = {
	/** Unique name matching the method (e.g. "semantic", "markdown"). */
	name: string
	/** Create a chunker function with the given options. */
	createChunker: (
		options?: ChunkingOptions & Record<string, unknown>
	) => Chunker
}

/**
 * Data reference for an ingested asset.
 *
 * Prefer `bytes` when possible (most reliable). URLs are convenient for connectors
 * but require network fetch at ingest time (see assetProcessing.fetch safety settings).
 */
export type AssetData =
	| {
			kind: 'url'
			/** HTTPS URL to fetch the bytes from. */
			url: string
			/** Optional request headers (e.g. signed URLs). */
			headers?: Record<string, string>
			/**
			 * Optional media type hint.
			 * Useful when the URL doesn't have a stable extension (e.g. signed URLs).
			 */
			mediaType?: string
			/** Optional filename hint. */
			filename?: string
	  }
	| {
			kind: 'bytes'
			/** Raw bytes of the asset. */
			bytes: Uint8Array
			/** IANA media type (e.g. "application/pdf", "image/png"). */
			mediaType: string
			/** Optional filename hint. */
			filename?: string
	  }

export type AssetKind = 'image' | 'pdf' | 'audio' | 'video' | 'file'

/**
 * Non-text input attached to an ingested document.
 *
 * Connectors should emit stable `assetId`s (e.g. Notion block id) so downstream
 * systems can associate chunks back to their originating rich media.
 */
export type AssetInput = {
	/** Stable identifier within the document/source (e.g. block id). */
	assetId: string
	kind: AssetKind
	data: AssetData
	/**
	 * Optional stable-ish URI for debugging/display (may be the same as data.url).
	 * This value is stored in metadata; do not assume it will be fetchable later.
	 */
	uri?: string
	/**
	 * Optional text already known for the asset (caption/alt text).
	 * This can be embedded as normal text chunks and can also be passed to extractors.
	 */
	text?: string
	/** Optional per-asset metadata (merged into chunk metadata). */
	metadata?: Metadata
}

export type AssetPolicy = 'skip' | 'fail'

export type AssetFetchConfig = {
	/**
	 * When true, the engine may fetch asset bytes from URLs during ingest.
	 * Disable in high-security environments; provide `bytes` instead.
	 */
	enabled: boolean
	/**
	 * Optional allowlist of hostnames. When set, only these hosts can be fetched.
	 * Recommended to mitigate SSRF.
	 */
	allowedHosts?: string[]
	/** Hard cap on fetched bytes. */
	maxBytes: number
	/** Fetch timeout in milliseconds. */
	timeoutMs: number
	/** Extra headers to attach to all fetches (merged with per-asset headers). */
	headers?: Record<string, string>
}

export type PdfLlmExtractionConfig = {
	/**
	 * When enabled, PDFs are sent to an LLM to extract text, which is then chunked
	 * and embedded as normal text.
	 *
	 * Library default: false (cost-safe).
	 * Generated config template may set this to true for convenience.
	 */
	enabled: boolean
	/**
	 * AI Gateway model id (Vercel AI SDK), e.g. "google/gemini-2.0-flash".
	 * This must be a model that supports file inputs for PDF extraction.
	 */
	model: string
	/**
	 * Prompt used for extraction. Keep it deterministic: \"extract faithfully\".
	 * The output is later chunked and embedded.
	 */
	prompt: string
	/** LLM call timeout in milliseconds. */
	timeoutMs: number
	/** Hard cap on input PDF bytes. */
	maxBytes: number
	/** Hard cap on extracted text length (characters). */
	maxOutputChars: number
}

export type PdfTextLayerConfig = {
	/**
	 * When enabled, PDFs are processed by extracting the built-in text layer (when present).
	 * This is fast/cheap but won't work well for scanned/image-only PDFs.
	 */
	enabled: boolean
	/** Max PDF bytes to attempt text-layer extraction on. */
	maxBytes: number
	/** Hard cap on extracted text length (characters). */
	maxOutputChars: number
	/**
	 * Minimum extracted characters required to accept the result. If fewer chars are extracted,
	 * the extractor should return empty output so the pipeline can fall back to another extractor.
	 */
	minChars: number
	/**
	 * Optional cap on pages to read (defense-in-depth for huge PDFs).
	 * Extractors may ignore this when they can't reliably compute page count.
	 */
	maxPages?: number
}

export type PdfOcrConfig = {
	/**
	 * When enabled, PDFs are rendered to images and OCR'd.
	 * This is typically worker-only (needs binaries like poppler/tesseract or external services).
	 */
	enabled: boolean
	/** Max PDF bytes to attempt OCR on. */
	maxBytes: number
	/** Hard cap on extracted text length (characters). */
	maxOutputChars: number
	/** Minimum extracted characters required to accept the OCR output. */
	minChars: number
	/** Optional max pages to OCR (defense-in-depth). */
	maxPages?: number
	/** Optional path to `pdftoppm` (Poppler). */
	pdftoppmPath?: string
	/** Optional path to `tesseract`. */
	tesseractPath?: string
	/** DPI for rasterization (higher = better OCR, slower/larger). */
	dpi?: number
	/** Tesseract language code (e.g. "eng"). */
	lang?: string
}

export type ImageOcrConfig = {
	/** When enabled, images can be OCR'd into text chunks. */
	enabled: boolean
	/** Model id (AI Gateway) for vision OCR. */
	model: string
	/** Prompt used for deterministic OCR extraction. */
	prompt: string
	timeoutMs: number
	/** Hard cap on input bytes (enforced by fetch + extractor). */
	maxBytes: number
	/** Hard cap on extracted text length (characters). */
	maxOutputChars: number
}

export type ImageCaptionLlmConfig = {
	/** When enabled, images can have captions generated via a vision-capable LLM. */
	enabled: boolean
	model: string
	prompt: string
	timeoutMs: number
	maxBytes: number
	maxOutputChars: number
}

export type AudioTranscriptionConfig = {
	/** When enabled, audio assets can be transcribed into text chunks. */
	enabled: boolean
	/** Provider/model id (AI Gateway) for transcription. */
	model: string
	timeoutMs: number
	maxBytes: number
}

export type VideoTranscriptionConfig = {
	/** When enabled, video assets can be transcribed (audio track) into text chunks. */
	enabled: boolean
	model: string
	timeoutMs: number
	maxBytes: number
}

export type VideoFramesConfig = {
	/**
	 * When enabled, video frames can be sampled and processed (OCR/caption).
	 * This is typically worker-only (requires ffmpeg and significant runtime).
	 */
	enabled: boolean
	sampleFps: number
	maxFrames: number
	/** Optional path to ffmpeg binary (worker environments). */
	ffmpegPath?: string
	/** Hard cap on video bytes for frame sampling. */
	maxBytes: number
	/** Vision-capable model id (AI Gateway) for per-frame processing. */
	model: string
	/** Prompt to apply to each sampled frame. */
	prompt: string
	/** Timeout per frame analysis call. */
	timeoutMs: number
	/** Hard cap on total extracted text length (characters). */
	maxOutputChars: number
}

export type FileTextConfig = {
	/** When enabled, text-ish files (txt/md/html) can be extracted into chunks. */
	enabled: boolean
	maxBytes: number
	maxOutputChars: number
	minChars: number
}

export type FileDocxConfig = {
	enabled: boolean
	maxBytes: number
	maxOutputChars: number
	minChars: number
}

export type FilePptxConfig = {
	enabled: boolean
	maxBytes: number
	maxOutputChars: number
	minChars: number
}

export type FileXlsxConfig = {
	enabled: boolean
	maxBytes: number
	maxOutputChars: number
	minChars: number
}

export type AssetProcessingConfig = {
	/**
	 * What to do when an asset kind is present but unsupported (e.g. audio in v1).
	 * Recommended default: \"skip\".
	 */
	onUnsupportedAsset: AssetPolicy
	/** What to do when processing an asset fails (fetch/LLM errors). */
	onError: AssetPolicy
	/**
	 * Bounded concurrency for asset processing (extraction + any I/O).
	 * This does not affect text chunking/embedding batching.
	 */
	concurrency: number
	/**
	 * Optional hooks for observability (structured events).
	 * Prefer this over ad-hoc logging inside extractors.
	 */
	hooks?: {
		onEvent?: (event: AssetProcessingEvent) => void
	}
	/** Network fetch settings for URL-based assets. */
	fetch: AssetFetchConfig
	pdf: {
		textLayer: PdfTextLayerConfig
		llmExtraction: PdfLlmExtractionConfig
		ocr: PdfOcrConfig
	}
	image: {
		ocr: ImageOcrConfig
		captionLlm: ImageCaptionLlmConfig
	}
	audio: {
		transcription: AudioTranscriptionConfig
	}
	video: {
		transcription: VideoTranscriptionConfig
		frames: VideoFramesConfig
	}
	file: {
		text: FileTextConfig
		docx: FileDocxConfig
		pptx: FilePptxConfig
		xlsx: FileXlsxConfig
	}
}

export type AssetProcessingEvent =
	| {
			type: 'asset:start'
			sourceId: string
			documentId: string
			assetId: string
			assetKind: AssetKind
			assetUri?: string
			assetMediaType?: string
	  }
	| ({
			type: 'asset:skipped'
			sourceId: string
			documentId: string
	  } & IngestWarning)
	| {
			type: 'extractor:start'
			sourceId: string
			documentId: string
			assetId: string
			assetKind: AssetKind
			extractor: string
	  }
	| {
			type: 'extractor:success'
			sourceId: string
			documentId: string
			assetId: string
			assetKind: AssetKind
			extractor: string
			durationMs: number
			textItemCount: number
	  }
	| {
			type: 'extractor:error'
			sourceId: string
			documentId: string
			assetId: string
			assetKind: AssetKind
			extractor: string
			durationMs: number
			errorMessage: string
	  }

export type ExtractedTextItem = {
	/**
	 * A label describing the extraction output (e.g. \"fulltext\", \"ocr\", \"transcript\").
	 * Used only for metadata/debugging.
	 */
	label: string
	/** Extracted text content. This will be chunked and embedded as normal text. */
	content: string
	confidence?: number
	/**
	 * Optional range metadata produced by the extractor.
	 * This is stored in chunk metadata (if provided) for traceability.
	 */
	pageRange?: [number, number]
	timeRangeSec?: [number, number]
}

export type AssetExtractorResult = {
	texts: ExtractedTextItem[]
	/**
	 * Optional structured skip reason. Prefer returning `texts: []` + `skipped` when the
	 * extractor is configured off or cannot operate under current limits, without treating
	 * it as an error (so the pipeline can fall back to other extractors).
	 */
	skipped?: {
		code: string
		message: string
	}
	/**
	 * Extractor-produced metadata merged into chunk metadata.
	 * Useful for things like detected language, page count, etc.
	 */
	metadata?: Metadata
	diagnostics?: {
		model?: string
		tokens?: number
		seconds?: number
	}
}

export type AssetExtractorContext = {
	sourceId: string
	documentId: string
	documentMetadata: Metadata
	/** Engine-resolved asset processing config (defaults + overrides). */
	assetProcessing: AssetProcessingConfig
}

export type AssetExtractor = {
	/** Stable name used in metadata and routing (e.g. \"pdf:llm\"). */
	name: string
	/** Whether this extractor can handle a given asset input. */
	supports: (args: {asset: AssetInput; ctx: AssetExtractorContext}) => boolean
	/** Extract text outputs from the asset. */
	extract: (args: {
		asset: AssetInput
		ctx: AssetExtractorContext
	}) => Promise<AssetExtractorResult>
}

export type AssetProcessingPlanItem =
	| ({
			status: 'will_process'
			extractors: string[]
	  } & Pick<AssetInput, 'assetId' | 'kind' | 'uri'>)
	| ({
			status: 'will_skip'
			reason: IngestWarning['code']
	  } & Pick<AssetInput, 'assetId' | 'kind' | 'uri'>)

export type IngestPlanResult = {
	documentId: string
	sourceId: string
	assets: AssetProcessingPlanItem[]
	warnings: IngestWarning[]
}

/**
 * Deep partial for ergonomic overrides.
 * Used for engine defaults and per-ingest overrides.
 */
export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends Array<infer U>
		? U[]
		: T[K] extends object
			? DeepPartial<T[K]>
			: T[K]
}

export type EmbeddingInput = {
	text: string
	metadata: Metadata
	position: number
	sourceId: string
	documentId: string
}

export type ImageEmbeddingInput = {
	/** Image bytes or URL. */
	data: Uint8Array | string
	/** IANA media type (recommended when data is bytes). */
	mediaType?: string
	metadata: Metadata
	position: number
	sourceId: string
	documentId: string
	assetId?: string
}

type BaseEmbeddingConfig = {
	model?: string
	timeoutMs?: number
}

export type AiEmbeddingConfig = BaseEmbeddingConfig

export type OpenAiEmbeddingConfig = BaseEmbeddingConfig & {
	dimensions?: number
	user?: string
}

export type GoogleEmbeddingTaskType =
	| 'SEMANTIC_SIMILARITY'
	| 'CLASSIFICATION'
	| 'CLUSTERING'
	| 'RETRIEVAL_DOCUMENT'
	| 'RETRIEVAL_QUERY'
	| 'QUESTION_ANSWERING'
	| 'FACT_VERIFICATION'
	| 'CODE_RETRIEVAL_QUERY'

export type GoogleEmbeddingConfig = BaseEmbeddingConfig & {
	outputDimensionality?: number
	taskType?: GoogleEmbeddingTaskType
}

export type OpenRouterEmbeddingConfig = BaseEmbeddingConfig & {
	apiKey?: string
	baseURL?: string
	headers?: Record<string, string>
	referer?: string
	title?: string
}

export type AzureEmbeddingConfig = BaseEmbeddingConfig & {
	dimensions?: number
	user?: string
}

export type VertexEmbeddingTaskType =
	| 'SEMANTIC_SIMILARITY'
	| 'CLASSIFICATION'
	| 'CLUSTERING'
	| 'RETRIEVAL_DOCUMENT'
	| 'RETRIEVAL_QUERY'
	| 'QUESTION_ANSWERING'
	| 'FACT_VERIFICATION'
	| 'CODE_RETRIEVAL_QUERY'

export type VertexEmbeddingConfig = BaseEmbeddingConfig & {
	outputDimensionality?: number
	taskType?: VertexEmbeddingTaskType
	title?: string
	autoTruncate?: boolean
}

export type BedrockEmbeddingConfig = BaseEmbeddingConfig & {
	dimensions?: number
	normalize?: boolean
}

export type CohereEmbeddingConfig = BaseEmbeddingConfig & {
	inputType?:
		| 'search_document'
		| 'search_query'
		| 'classification'
		| 'clustering'
	truncate?: 'NONE' | 'START' | 'END'
}

export type MistralEmbeddingConfig = BaseEmbeddingConfig

export type TogetherEmbeddingConfig = BaseEmbeddingConfig

export type OllamaEmbeddingConfig = BaseEmbeddingConfig & {
	baseURL?: string
	headers?: Record<string, string>
}

type VoyageMultimodalTextValue = {
	text: string[]
}

type VoyageMultimodalImageValue = {
	image: string[]
}

type VoyageTextConfig = BaseEmbeddingConfig & {
	type?: 'text'
}

type VoyageMultimodalConfig = BaseEmbeddingConfig & {
	type: 'multimodal'
	text?: {
		value?: (text: string) => VoyageMultimodalTextValue
	}
	image?: {
		value?: (input: ImageEmbeddingInput) => VoyageMultimodalImageValue
	}
}

export type VoyageEmbeddingConfig = VoyageTextConfig | VoyageMultimodalConfig

export type EmbeddingProvider = {
	name: string
	dimensions?: number
	embed: (input: EmbeddingInput) => Promise<number[]>
	/**
	 * Optional batch embedding for performance.
	 * When present, the engine may embed text chunks in a single call.
	 */
	embedMany?: (inputs: EmbeddingInput[]) => Promise<number[][]>
	/**
	 * Optional image embedding for unified multimodal retrieval.
	 * Only used when the configured provider supports it.
	 */
	embedImage?: (input: ImageEmbeddingInput) => Promise<number[]>
}

export type DeleteInput =
	| {
			/** Delete a single logical document by exact `sourceId`. */
			sourceId: string
			sourceIdPrefix?: never
	  }
	| {
			/**
			 * Delete all logical documents whose `sourceId` starts with the prefix.
			 * This matches Unrag's prefix scoping behavior in retrieval.
			 */
			sourceId?: never
			sourceIdPrefix: string
	  }

/**
 * Scope for filtering retrieval results.
 * Used in both `RetrieveInput` and `VectorStore.query()`.
 */
export type RetrieveScope = {
	/** Filter to chunks whose sourceId starts with this prefix. */
	sourceId?: string
}

export type VectorStore = {
	/**
	 * Persist (replace) a single document's chunks.
	 *
	 * The store treats `chunks[0].sourceId` as the logical identifier for the document.
	 * Calling `upsert()` multiple times with the same `sourceId` replaces the previously
	 * stored content for that document (including when the chunk count changes).
	 *
	 * Returns the canonical `documentId` for the logical document. On first ingest this
	 * is a newly generated ID; on subsequent ingests for the same `sourceId` it returns
	 * the existing (stable) document ID.
	 *
	 * **Important**: This method requires a UNIQUE constraint on `documents.source_id`
	 * to guarantee idempotent upsert semantics under concurrent writes.
	 */
	upsert: (chunks: Chunk[]) => Promise<{documentId: string}>
	query: (params: {
		embedding: number[]
		topK: number
		scope?: RetrieveScope
	}) => Promise<Array<Chunk & {score: number}>>
	delete: (input: DeleteInput) => Promise<void>
}

export type IngestInput = {
	sourceId: string
	content: string
	metadata?: Metadata
	chunking?: Partial<ChunkingOptions>
	/** Optional rich media attached to the document. */
	assets?: AssetInput[]
	/**
	 * Per-ingest overrides for asset processing. Merged with engine defaults.
	 * Use this to toggle expensive features (like PDF LLM extraction) per run.
	 */
	assetProcessing?: DeepPartial<AssetProcessingConfig>
}

type IngestWarningBase<K extends AssetKind> = {
	message: string
	assetId: string
	assetKind: K
	assetUri?: string
	assetMediaType?: string
}

export type IngestWarning =
	| (IngestWarningBase<AssetKind> & {
			/**
			 * A rich media asset was encountered but no extractor exists for its kind.
			 * (Example: audio/video in v1.)
			 */
			code: 'asset_skipped_unsupported_kind'
	  })
	| (IngestWarningBase<AssetKind> & {
			/**
			 * An asset kind was encountered, but extraction for that kind is disabled by config.
			 * (Example: audio transcription disabled.)
			 */
			code: 'asset_skipped_extraction_disabled'
	  })
	| (IngestWarningBase<'pdf'> & {
			/**
			 * A PDF was encountered but PDF LLM extraction is disabled.
			 * Enable `assetProcessing.pdf.llmExtraction.enabled` to process PDFs.
			 */
			code: 'asset_skipped_pdf_llm_extraction_disabled'
	  })
	| (IngestWarningBase<'image'> & {
			/**
			 * An image was encountered but the embedding provider does not support image embedding
			 * AND the asset did not include a non-empty caption/alt text (`assets[].text`).
			 */
			code: 'asset_skipped_image_no_multimodal_and_no_caption'
	  })
	| (IngestWarningBase<'pdf'> & {
			/**
			 * PDF LLM extraction ran but produced no usable text.
			 * This is typically due to empty/scanned PDFs or model limitations.
			 */
			code: 'asset_skipped_pdf_empty_extraction'
	  })
	| (IngestWarningBase<AssetKind> & {
			/**
			 * Extraction ran but produced no usable text for the asset (non-PDF kinds).
			 * For PDFs, use `asset_skipped_pdf_empty_extraction`.
			 */
			code: 'asset_skipped_extraction_empty'
	  })
	| (IngestWarningBase<AssetKind> & {
			/**
			 * Asset processing failed, but policy allowed continuing (`assetProcessing.onError: "skip"`).
			 */
			code: 'asset_processing_error'
			stage: 'fetch' | 'extract' | 'embed' | 'unknown'
	  })

export type IngestResult = {
	documentId: string
	chunkCount: number
	embeddingModel: string
	/**
	 * Structured warnings emitted during ingestion.
	 * Use this to detect skipped rich media (unsupported kinds, disabled extraction, best-effort failures).
	 */
	warnings: IngestWarning[]
	durations: {
		totalMs: number
		chunkingMs: number
		embeddingMs: number
		storageMs: number
	}
}

export type RetrieveInput = {
	query: string
	topK?: number
	scope?: RetrieveScope
}

export type RetrieveResult = {
	chunks: Array<Chunk & {score: number}>
	embeddingModel: string
	durations: {
		totalMs: number
		embeddingMs: number
		retrievalMs: number
	}
}

// ---------------------------------------------------------------------------
// Reranker types
// ---------------------------------------------------------------------------

/**
 * A chunk with its retrieval score, used as input to reranking.
 */
export type RerankCandidate = Chunk & {score: number}

/**
 * Policy for handling missing reranker or missing candidate text.
 * - `throw`: raise an error (default)
 * - `skip`: return original candidates with a warning
 */
export type RerankPolicy = 'throw' | 'skip'

/**
 * Input to `engine.rerank()`.
 */
export type RerankInput = {
	/** The query to rerank candidates against. */
	query: string
	/** Candidates to rerank (typically from `engine.retrieve()`). */
	candidates: RerankCandidate[]
	/** Number of top items to return after reranking. Defaults to candidates.length. */
	topK?: number
	/** What to do if no reranker is configured. Default: 'throw'. */
	onMissingReranker?: RerankPolicy
	/** What to do if a candidate has empty/missing text. Default: 'throw'. */
	onMissingText?: RerankPolicy
	/**
	 * Optional hook to resolve text for a candidate when `chunk.content` is empty.
	 * Useful when `storeChunkContent: false` and text is stored externally.
	 */
	resolveText?: (candidate: RerankCandidate) => string | Promise<string>
}

/**
 * A single item in the rerank ranking output, tracking original position and rerank score.
 */
export type RerankRankingItem = {
	/** Original index in the candidates array. */
	index: number
	/** Score assigned by the reranker (if available). */
	rerankScore?: number
}

/**
 * Result of `engine.rerank()`.
 */
export type RerankResult = {
	/** Reranked chunks (top `topK`), in new order. */
	chunks: RerankCandidate[]
	/**
	 * Full ranking details for all candidates (useful for debugging/eval).
	 * Ordered by rerank rank (best first).
	 */
	ranking: RerankRankingItem[]
	/** Metadata about the reranker that was used. */
	meta: {
		rerankerName: string
		model?: string
	}
	/** Timing information. */
	durations: {
		rerankMs: number
		totalMs: number
	}
	/** Warnings emitted during reranking (e.g. missing text skipped). */
	warnings: string[]
}

/**
 * Arguments passed to the reranker's `rerank` method.
 */
export type RerankerRerankArgs = {
	query: string
	/** Document texts to rerank, in candidate order. */
	documents: string[]
}

/**
 * Result returned by a Reranker implementation.
 */
export type RerankerRerankResult = {
	/**
	 * Permutation of indices into the original documents array, ordered by relevance (best first).
	 * Length should equal documents.length.
	 */
	order: number[]
	/** Optional scores for each item in `order`. */
	scores?: number[]
	/** Model identifier (if available). */
	model?: string
}

/**
 * Reranker interface.
 *
 * Implementations transform a list of document texts + query into a relevance-ordered permutation.
 * The core engine uses this interface; battery modules provide concrete implementations.
 */
export type Reranker = {
	/** Stable name for this reranker (e.g. "cohere", "custom"). */
	name: string
	/** Rerank documents by relevance to the query. */
	rerank: (args: RerankerRerankArgs) => Promise<RerankerRerankResult>
}

/**
 * Higher-level (ergonomic) Unrag config wrapper.
 *
 * This is intentionally separate from `ContextEngineConfig`:
 * - `defaults.retrieval` is not part of the engine config; it's a convenience default for callers.
 * - `defaults.chunking` maps to the engine's `defaults` field.
 * - `embedding` is configured declaratively and can be turned into an `EmbeddingProvider`.
 */
export type UnragDefaultsConfig = {
	chunking?: Partial<ChunkingOptions>
	/**
	 * Embedding performance defaults (batching + concurrency).
	 * These map to the engine's `embeddingProcessing` config.
	 */
	embedding?: Partial<EmbeddingProcessingConfig>
	retrieval?: {
		topK?: number
	}
}

export type UnragEngineConfig = Omit<
	ContextEngineConfig,
	'embedding' | 'store' | 'defaults'
>

export type UnragEmbeddingConfig =
	| {
			provider: 'ai'
			config?: AiEmbeddingConfig
	  }
	| {
			provider: 'openai'
			config?: OpenAiEmbeddingConfig
	  }
	| {
			provider: 'google'
			config?: GoogleEmbeddingConfig
	  }
	| {
			provider: 'openrouter'
			config?: OpenRouterEmbeddingConfig
	  }
	| {
			provider: 'azure'
			config?: AzureEmbeddingConfig
	  }
	| {
			provider: 'vertex'
			config?: VertexEmbeddingConfig
	  }
	| {
			provider: 'bedrock'
			config?: BedrockEmbeddingConfig
	  }
	| {
			provider: 'cohere'
			config?: CohereEmbeddingConfig
	  }
	| {
			provider: 'mistral'
			config?: MistralEmbeddingConfig
	  }
	| {
			provider: 'together'
			config?: TogetherEmbeddingConfig
	  }
	| {
			provider: 'ollama'
			config?: OllamaEmbeddingConfig
	  }
	| {
			provider: 'voyage'
			config?: VoyageEmbeddingConfig
	  }
	| {
			provider: 'custom'
			/**
			 * Escape hatch for bringing your own embedding provider.
			 * Use this when you need a provider that is not backed by the AI SDK.
			 */
			create: () => EmbeddingProvider
	  }

export type DefineUnragConfigInput = {
	defaults?: UnragDefaultsConfig
	/**
	 * Chunking configuration.
	 * Controls how documents are split into chunks for embedding.
	 *
	 * @example
	 * ```typescript
	 * chunking: {
	 *   method: "recursive",  // default, uses js-tiktoken with o200k_base
	 *   options: {
	 *     chunkSize: 512,     // max tokens per chunk
	 *     chunkOverlap: 50,   // overlap tokens between chunks
	 *     minChunkSize: 24    // minimum tokens per chunk
	 *   }
	 * }
	 * ```
	 */
	chunking?: ChunkingConfig
	/**
	 * Engine configuration (everything except embedding/store/defaults).
	 * This is where you configure storage, asset processing, chunker/idGenerator, etc.
	 */
	engine?: UnragEngineConfig
	/**
	 * Embedding configuration. The engine's embedding provider is derived from this.
	 */
	embedding: UnragEmbeddingConfig
}

export type UnragCreateEngineRuntime = {
	store: VectorStore
	/**
	 * Optional runtime override/extension of extractors.
	 * - If you pass an array, it replaces the base extractors from `engine.extractors`.
	 * - If you pass a function, it receives the base extractors and should return the final array.
	 */
	extractors?:
		| AssetExtractor[]
		| ((base: AssetExtractor[]) => AssetExtractor[])
}

export type ContextEngineConfig = {
	embedding: EmbeddingProvider
	store: VectorStore
	defaults?: Partial<ChunkingOptions>
	chunker?: Chunker
	idGenerator?: () => string
	/**
	 * Optional extractor modules that can process non-text assets into text outputs.
	 * These are typically installed via `unrag add extractor <name>` and imported
	 * from your vendored module directory.
	 */
	extractors?: AssetExtractor[]
	/**
	 * Optional reranker for second-stage ranking after retrieval.
	 * Install via `unrag add battery reranker` and wire here.
	 */
	reranker?: Reranker
	/**
	 * Controls whether Unrag persists chunk/document text into the database.
	 * Defaults to storing both.
	 */
	storage?: Partial<ContentStorageConfig>
	/**
	 * Asset processing defaults. If omitted, rich media is ignored (except image
	 * captions, which can still be ingested via `assets[].text` if you choose).
	 */
	assetProcessing?: DeepPartial<AssetProcessingConfig>
	/**
	 * Embedding performance defaults for ingest (batching + concurrency).
	 */
	embeddingProcessing?: DeepPartial<EmbeddingProcessingConfig>
}

export type ResolvedContextEngineConfig = {
	embedding: EmbeddingProvider
	store: VectorStore
	defaults: ChunkingOptions
	chunker: Chunker
	idGenerator: () => string
	extractors: AssetExtractor[]
	/** Reranker is optional; if not configured, `engine.rerank()` will throw by default. */
	reranker?: Reranker
	storage: ContentStorageConfig
	assetProcessing: AssetProcessingConfig
	embeddingProcessing: EmbeddingProcessingConfig
}
