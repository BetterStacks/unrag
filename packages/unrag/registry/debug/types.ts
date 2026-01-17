/**
 * Debug battery types.
 *
 * These types define the configuration and interfaces for the debug panel
 * and WebSocket communication between the user's app and the debug TUI.
 */

import type {DebugEvent} from '@registry/core/debug-events'
import type {Metadata} from '@registry/core/types'

// Re-export event types for convenience
export type {DebugEvent, DebugEventType} from '@registry/core/debug-events'

// ============================================================================
// Protocol + capabilities
// ============================================================================

/**
 * Debug WebSocket protocol version.
 *
 * Increment when message formats change in a way that requires explicit
 * negotiation between client (TUI) and server (in-app debug server).
 */
export const DEBUG_PROTOCOL_VERSION = 2 as const

/**
 * Feature flags advertised by the server during handshake.
 * Keep these coarse-grained and additive.
 */
export type DebugCapability =
	| 'traces'
	| 'query'
	| 'ingest'
	| 'docs'
	| 'doctor'
	| 'eval'
	| 'storeInspector'

export type DebugServerInfo = {
	/** Server websocket endpoint as seen by the server. */
	endpoint?: string
	/** Process ID (when available). */
	pid?: number
	/** Optional app/runtime identifier (e.g. "node", "bun"). */
	runtime?: string
}

/**
 * Configuration for the debug WebSocket server.
 */
export type DebugServerConfig = {
	/** Port to listen on. @default 3847 */
	port?: number
	/** Host to bind to. @default "localhost" */
	host?: string
	/** Maximum number of connected clients. @default 5 */
	maxClients?: number
}

/**
 * Debug server instance interface.
 */
export type DebugServer = {
	/** Port the server is listening on */
	port: number
	/** Host the server is bound to */
	host: string
	/** Number of currently connected clients */
	clientCount: number
	/** Broadcast an event to all connected clients */
	broadcast: (event: DebugEvent) => void
	/** Stop the server and disconnect all clients */
	stop: () => Promise<void>
}

/**
 * Configuration for the debug WebSocket client.
 */
export type DebugClientConfig = {
	/** WebSocket URL to connect to. @default "ws://localhost:3847" */
	url?: string
	/** Whether to auto-reconnect on disconnect. @default true */
	reconnect?: boolean
	/** Delay between reconnection attempts in ms. @default 1000 */
	reconnectDelay?: number
	/** Maximum reconnection attempts. @default 10 */
	maxReconnectAttempts?: number
}

/**
 * Connection status.
 */
export type DebugConnectionStatus =
	| 'connecting'
	| 'connected'
	| 'disconnected'
	| 'reconnecting'
	| 'error'

/**
 * Debug client connection interface.
 */
export type DebugConnection = {
	/** Current connection status */
	status: DebugConnectionStatus
	/** Session ID from the connected server (available when connected) */
	sessionId?: string
	/** Negotiated protocol version (available after handshake). */
	protocolVersion?: number
	/** Server advertised capabilities (available after handshake). */
	capabilities?: DebugCapability[]
	/** Optional server info from handshake. */
	serverInfo?: DebugServerInfo
	/** Last connection/protocol error message (if any). */
	errorMessage?: string
	/** Register an event handler. Returns unsubscribe function. */
	onEvent: (handler: (event: DebugEvent) => void) => () => void
	/** Register a status change handler. Returns unsubscribe function. */
	onStatusChange: (
		handler: (status: DebugConnectionStatus) => void
	) => () => void
	/** Send a command to the server and get a response. */
	sendCommand: (command: DebugCommand) => Promise<DebugCommandResult>
	/** Disconnect from the server. */
	disconnect: () => void
}

// ============================================================================
// Debug Commands
// ============================================================================

/**
 * Query command - execute a retrieve operation.
 */
export type QueryCommand = {
	type: 'query'
	query: string
	topK?: number
	scope?: string
}

/**
 * List documents command.
 */
export type ListDocumentsCommand = {
	type: 'list-documents'
	prefix?: string
	limit?: number
	offset?: number
}

/**
 * Get document details command.
 */
export type GetDocumentCommand = {
	type: 'get-document'
	sourceId: string
}

/**
 * Delete document command.
 */
export type DeleteDocumentCommand = {
	type: 'delete-document'
	sourceId?: string
	sourceIdPrefix?: string
}

/**
 * Delete chunks command (by chunk IDs).
 *
 * This is a debug-panel affordance to surgically delete problematic chunks without
 * wiping an entire document/prefix.
 */
export type DeleteChunksCommand = {
	type: 'delete-chunks'
	chunkIds: string[]
}

/**
 * Ingest command - ingest a new document through the engine.
 *
 * Supports either inline content or reading content from a file path inside the app process.
 */
export type IngestCommand = {
	type: 'ingest'
	sourceId: string
	/** Inline content (small docs / quick tests). */
	content?: string
	/** File path to read in the app process (better for large docs / multiline). */
	contentPath?: string
	metadata?: Metadata
	chunking?: {
		chunkSize?: number
		chunkOverlap?: number
	}
}

/**
 * Store stats command.
 */
export type StoreStatsCommand = {
	type: 'store-stats'
}

/**
 * Doctor command - returns capability + configuration checks.
 */
export type DoctorCommand = {
	type: 'doctor'
}

/**
 * Run evaluation dataset (read from disk in the app process).
 */
export type RunEvalCommand = {
	type: 'run-eval'
	datasetPath: string
	mode?: 'retrieve' | 'retrieve+rerank'
	topK?: number
	rerankTopK?: number
	scopePrefix?: string
	ingest?: boolean
	cleanup?: 'none' | 'on-success' | 'always'
	includeNdcg?: boolean
	/**
	 * Safety guardrail: allow scope prefixes not starting with "eval:".
	 * Avoid enabling this unless you understand delete-by-prefix risk.
	 */
	allowNonEvalPrefix?: boolean
	/**
	 * Safety guardrail: explicit confirmation for non-eval delete-by-prefix.
	 */
	confirmedDangerousDelete?: boolean
	/**
	 * Safety guardrail: allow documents[].assets ingestion (URL fetch risk).
	 */
	allowAssets?: boolean
}

/**
 * Ping command for connection testing.
 */
export type PingCommand = {
	type: 'ping'
}

/**
 * Clear event buffer command.
 */
export type ClearBufferCommand = {
	type: 'clear-buffer'
}

/**
 * Get buffered events command.
 */
export type GetBufferCommand = {
	type: 'get-buffer'
}

/**
 * Union of all debug commands.
 */
export type DebugCommand =
	| QueryCommand
	| IngestCommand
	| ListDocumentsCommand
	| GetDocumentCommand
	| DeleteDocumentCommand
	| DeleteChunksCommand
	| StoreStatsCommand
	| DoctorCommand
	| RunEvalCommand
	| PingCommand
	| ClearBufferCommand
	| GetBufferCommand

/**
 * Command type strings.
 */
export type DebugCommandType = DebugCommand['type']

// ============================================================================
// Command Results
// ============================================================================

/**
 * Base result type.
 */
export type DebugCommandResultBase = {
	success: boolean
	error?: string
}

/**
 * Query result.
 */
export type QueryResult = DebugCommandResultBase & {
	type: 'query'
	chunks?: Array<{
		id: string
		content: string
		score: number
		sourceId: string
		documentId: string
		metadata: Record<string, unknown>
	}>
	durations?: {
		embeddingMs: number
		retrievalMs: number
		totalMs: number
	}
}

/**
 * List documents result.
 */
export type ListDocumentsResult = DebugCommandResultBase & {
	type: 'list-documents'
	documents?: Array<{
		sourceId: string
		chunkCount: number
		createdAt?: string
	}>
	total?: number
}

/**
 * Get document result.
 */
export type GetDocumentResult = DebugCommandResultBase & {
	type: 'get-document'
	document?: {
		sourceId: string
		chunks: Array<{
			id: string
			content: string
			sequence: number
			metadata: Record<string, unknown>
		}>
		metadata: Record<string, unknown>
	}
}

/**
 * Delete document result.
 */
export type DeleteDocumentResult = DebugCommandResultBase & {
	type: 'delete-document'
	deletedCount?: number
}

/**
 * Delete chunks result.
 */
export type DeleteChunksResult = DebugCommandResultBase & {
	type: 'delete-chunks'
	deletedCount?: number
}

/**
 * Ingest result.
 */
export type IngestResult = DebugCommandResultBase & {
	type: 'ingest'
	documentId?: string
	chunkCount?: number
	embeddingModel?: string
	warnings?: Array<{
		code: string
		message: string
		assetId?: string
		assetKind?: string
		stage?: string
	}>
	durations?: {
		totalMs: number
		chunkingMs: number
		embeddingMs: number
		storageMs: number
	}
}

/**
 * Store stats result.
 */
export type StoreStatsResult = DebugCommandResultBase & {
	type: 'store-stats'
	stats?: {
		adapter: string
		database?: string
		schema?: string
		tables?: Array<{
			name: string
			rowCount: number
			size?: number
		}>
		embeddingDimension?: number
		totalVectors?: number
	}
}

export type DoctorCheckStatus = 'ok' | 'warn' | 'error'

export type DoctorCheck = {
	id: string
	label: string
	status: DoctorCheckStatus
	detail?: string
	fix?: string
}

/**
 * Doctor result.
 */
export type DoctorResult = DebugCommandResultBase & {
	type: 'doctor'
	checks: DoctorCheck[]
	info?: {
		sessionId?: string
		uptimeMs?: number
		env?: {
			UNRAG_DEBUG?: string
		}
		runtime?: {
			registered: boolean
			registeredAt?: number
			hasEngine: boolean
			hasStoreInspector: boolean
			engineInfo?: {
				embedding: {
					name: string
					dimensions?: number
					supportsBatch: boolean
					supportsImage: boolean
				}
				storage: {
					storeChunkContent: boolean
					storeDocumentContent: boolean
				}
				defaults: {
					chunkSize: number
					chunkOverlap: number
				}
				extractorsCount: number
				rerankerName?: string
			}
		}
	}
}

export type EvalStageMetrics = {
	hitAtK: number
	recallAtK: number
	precisionAtK: number
	mrrAtK: number
	ndcgAtK?: number
}

export type RunEvalResult = DebugCommandResultBase & {
	type: 'run-eval'
	summary?: {
		datasetId: string
		createdAt: string
		config: {
			mode: 'retrieve' | 'retrieve+rerank'
			topK: number
			rerankTopK?: number
			scopePrefix: string
			ingest: boolean
			cleanup: 'none' | 'on-success' | 'always'
			includeNdcg: boolean
		}
		engine: {
			embeddingModel?: string
			rerankerName?: string
			rerankerModel?: string
		}
		passed?: boolean
		thresholdFailures?: string[]
		aggregates: {
			retrieved: {mean: EvalStageMetrics; median: EvalStageMetrics}
			reranked?: {mean: EvalStageMetrics; median: EvalStageMetrics}
		}
		timings: {
			embeddingMs: {p50: number; p95: number}
			retrievalMs: {p50: number; p95: number}
			retrieveTotalMs: {p50: number; p95: number}
			rerankMs?: {p50: number; p95: number}
			rerankTotalMs?: {p50: number; p95: number}
			totalMs: {p50: number; p95: number}
		}
		charts?: {
			retrievedRecall: number[]
			retrievedMrr: number[]
			rerankedRecall?: number[]
			rerankedMrr?: number[]
		}
		worst?: Array<{
			id: string
			recallAtK: number
			mrrAtK: number
		}>
	}
}

/**
 * Ping result.
 */
export type PingResult = DebugCommandResultBase & {
	type: 'ping'
	sessionId?: string
	uptime?: number
}

/**
 * Clear buffer result.
 */
export type ClearBufferResult = DebugCommandResultBase & {
	type: 'clear-buffer'
	clearedCount?: number
}

/**
 * Get buffer result.
 */
export type GetBufferResult = DebugCommandResultBase & {
	type: 'get-buffer'
	events?: DebugEvent[]
}

/**
 * Union of all command results.
 */
export type DebugCommandResult =
	| QueryResult
	| IngestResult
	| ListDocumentsResult
	| GetDocumentResult
	| DeleteDocumentResult
	| DeleteChunksResult
	| StoreStatsResult
	| DoctorResult
	| RunEvalResult
	| PingResult
	| ClearBufferResult
	| GetBufferResult

// ============================================================================
// WebSocket Message Types
// ============================================================================

export type DebugErrorCode =
	| 'protocol_mismatch'
	| 'bad_message'
	| 'not_ready'
	| 'unauthorized'

export type ServerErrorMessage = {
	type: 'error'
	code: DebugErrorCode
	message: string
	details?: Record<string, unknown>
}

export type ServerHelloMessage = {
	type: 'hello'
	protocolVersion: number
	capabilities: DebugCapability[]
	serverInfo?: DebugServerInfo
}

export type ClientHelloMessage = {
	type: 'hello'
	supportedProtocolVersions: number[]
	clientInfo?: Record<string, unknown>
}

/**
 * Message from server to client.
 */
export type ServerMessage =
	| ServerHelloMessage
	| {type: 'event'; event: DebugEvent}
	| {type: 'welcome'; sessionId: string; bufferedEvents: DebugEvent[]}
	| {type: 'result'; requestId: string; result: DebugCommandResult}
	| ServerErrorMessage

/**
 * Message from client to server.
 */
export type ClientMessage =
	| ClientHelloMessage
	| {type: 'command'; requestId: string; command: DebugCommand}
