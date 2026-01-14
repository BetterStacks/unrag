/**
 * Debug event types for Unrag operations.
 *
 * These events are emitted when UNRAG_DEBUG=true, allowing real-time
 * debugging of RAG operations via the debug TUI.
 */

import type { RetrieveScope } from "@registry/core/types";

/**
 * Base type for all debug events.
 */
export type DebugEventBase = {
  /** Unix timestamp when the event was created */
  timestamp: number;
  /** Unique session identifier for this debug session */
  sessionId: string;
  /**
   * Correlation ID for a single high-level operation (ingest/retrieve/rerank/delete).
   * Used to group events into traces/waterfalls.
   */
  opId?: string;
  /**
   * Span ID for a sub-step within an operation (embedding, storage, db query, etc.).
   */
  spanId?: string;
  /**
   * Optional parent span ID (for hierarchical waterfalls).
   */
  parentSpanId?: string;
  /**
   * Optional high-level op name to simplify grouping/labeling.
   */
  opName?: "ingest" | "retrieve" | "rerank" | "delete" | "eval";
};

// ============================================================================
// Ingest Events
// ============================================================================

export type IngestStartEvent = DebugEventBase & {
  type: "ingest:start";
  sourceId: string;
  documentId: string;
  contentLength: number;
  assetCount: number;
};

export type IngestChunkingCompleteEvent = DebugEventBase & {
  type: "ingest:chunking-complete";
  sourceId: string;
  documentId: string;
  chunkCount: number;
  durationMs: number;
};

export type IngestEmbeddingStartEvent = DebugEventBase & {
  type: "ingest:embedding-start";
  sourceId: string;
  documentId: string;
  chunkCount: number;
  embeddingProvider: string;
};

export type IngestEmbeddingBatchEvent = DebugEventBase & {
  type: "ingest:embedding-batch";
  sourceId: string;
  documentId: string;
  batchIndex: number;
  batchSize: number;
  durationMs: number;
};

export type IngestEmbeddingCompleteEvent = DebugEventBase & {
  type: "ingest:embedding-complete";
  sourceId: string;
  documentId: string;
  totalEmbeddings: number;
  durationMs: number;
};

export type IngestStorageCompleteEvent = DebugEventBase & {
  type: "ingest:storage-complete";
  sourceId: string;
  documentId: string;
  chunksStored: number;
  durationMs: number;
};

export type IngestCompleteEvent = DebugEventBase & {
  type: "ingest:complete";
  sourceId: string;
  documentId: string;
  totalChunks: number;
  totalDurationMs: number;
  warnings: string[];
};

export type IngestErrorEvent = DebugEventBase & {
  type: "ingest:error";
  sourceId: string;
  documentId?: string;
  error: string;
};

// ============================================================================
// Retrieve Events
// ============================================================================

export type RetrieveStartEvent = DebugEventBase & {
  type: "retrieve:start";
  query: string;
  topK: number;
  scope?: RetrieveScope;
};

export type RetrieveEmbeddingCompleteEvent = DebugEventBase & {
  type: "retrieve:embedding-complete";
  query: string;
  embeddingProvider: string;
  embeddingDimension: number;
  durationMs: number;
};

export type RetrieveDatabaseQueryCompleteEvent = DebugEventBase & {
  type: "retrieve:database-complete";
  query: string;
  resultsCount: number;
  durationMs: number;
};

export type RetrieveCompleteEvent = DebugEventBase & {
  type: "retrieve:complete";
  query: string;
  resultsCount: number;
  topK: number;
  totalDurationMs: number;
  embeddingMs: number;
  retrievalMs: number;
};

// ============================================================================
// Rerank Events
// ============================================================================

export type RerankStartEvent = DebugEventBase & {
  type: "rerank:start";
  query: string;
  candidateCount: number;
  topK: number;
  rerankerName: string;
};

export type RerankCompleteEvent = DebugEventBase & {
  type: "rerank:complete";
  query: string;
  inputCount: number;
  outputCount: number;
  rerankMs: number;
  totalMs: number;
  rerankerName: string;
  model?: string;
};

// ============================================================================
// Delete Events
// ============================================================================

export type DeleteStartEvent = DebugEventBase & {
  type: "delete:start";
  mode: "sourceId" | "sourceIdPrefix";
  value: string;
};

export type DeleteCompleteEvent = DebugEventBase & {
  type: "delete:complete";
  mode: "sourceId" | "sourceIdPrefix";
  value: string;
  durationMs: number;
};

// ============================================================================
// Union Types
// ============================================================================

/**
 * All possible debug events.
 */
export type DebugEvent =
  // Ingest events
  | IngestStartEvent
  | IngestChunkingCompleteEvent
  | IngestEmbeddingStartEvent
  | IngestEmbeddingBatchEvent
  | IngestEmbeddingCompleteEvent
  | IngestStorageCompleteEvent
  | IngestCompleteEvent
  | IngestErrorEvent
  // Retrieve events
  | RetrieveStartEvent
  | RetrieveEmbeddingCompleteEvent
  | RetrieveDatabaseQueryCompleteEvent
  | RetrieveCompleteEvent
  // Rerank events
  | RerankStartEvent
  | RerankCompleteEvent
  // Delete events
  | DeleteStartEvent
  | DeleteCompleteEvent;

/**
 * All possible debug event type strings.
 */
export type DebugEventType = DebugEvent["type"];

/**
 * Helper to create a typed event without base fields.
 * Used by the debug emitter to add timestamp and sessionId.
 */
export type DebugEventPayload<T extends DebugEventType> = T extends DebugEventType
  ? Omit<Extract<DebugEvent, { type: T }>, "timestamp" | "sessionId">
  : never;
