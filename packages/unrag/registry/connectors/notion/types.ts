import type {AssetInput, IngestInput, Metadata} from '@registry/core'

/**
 * Opaque, JSON-serializable checkpoint for resuming a Notion stream.
 * Store this in your DB/KV and pass it back to `streamPages`.
 */
export type NotionCheckpoint = {
	/** Next index to process (0-based). */
	index: number
	/** Helpful for debugging/resume sanity checks. */
	pageId?: string
}

export type StreamNotionPagesInput = {
	/**
	 * Server-side Notion integration token.
	 * Keep this server-only (env var).
	 */
	token: string
	/** Notion page IDs or page URLs. */
	pageIds: string[]
	/**
	 * Optional namespace prefix, useful for multi-tenant apps:
	 * `tenant:acme:` -> `tenant:acme:notion:page:<id>`
	 */
	sourceIdPrefix?: string
	/**
	 * When true, if a page is not found/accessible, emit a delete event
	 * for the previously ingested document (exact sourceId).
	 */
	deleteOnNotFound?: boolean
	/**
	 * Optional max depth for block traversal (defaults to 4).
	 */
	maxDepth?: number
	/**
	 * Optional checkpoint to resume from.
	 */
	checkpoint?: NotionCheckpoint
}

export type NotionPageDocument = {
	sourceId: string
	content: string
	metadata: Metadata
	assets: AssetInput[]
}

export type BuildNotionPageIngestInputArgs = {
	pageId: string // normalized 32-hex (no dashes)
	content: string
	assets?: AssetInput[]
	metadata?: Metadata
	sourceIdPrefix?: string
}

export type BuildNotionPageIngestInputResult = IngestInput
