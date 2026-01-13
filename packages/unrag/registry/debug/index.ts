/**
 * Debug battery module.
 *
 * Install via `unrag add battery debug`.
 *
 * Two usage modes:
 * 1. In user's app: Enable with UNRAG_DEBUG=true to start event server
 * 2. CLI: Run `bunx unrag debug` to open the debug TUI
 *
 * @example
 * ```typescript
 * // In your app, set UNRAG_DEBUG=true before creating the context engine
 * // The debug server will automatically start on port 3847
 *
 * // Or manually control the server:
 * import { startDebugServer, stopDebugServer } from "@unrag/registry/debug";
 *
 * await startDebugServer({ port: 3847 });
 * // ... your app code ...
 * await stopDebugServer();
 * ```
 */

// Server exports (for user's app)
export { startDebugServer, stopDebugServer, getDebugServer } from "./server";

// Client exports (for debug TUI)
export { connectDebugClient, createAutoReconnectClient } from "./client";

// Type exports
export type {
  // Server types
  DebugServerConfig,
  DebugServer,
  // Client types
  DebugClientConfig,
  DebugConnection,
  DebugConnectionStatus,
  // Command types
  DebugCommand,
  DebugCommandType,
  QueryCommand,
  ListDocumentsCommand,
  GetDocumentCommand,
  DeleteDocumentCommand,
  StoreStatsCommand,
  PingCommand,
  ClearBufferCommand,
  GetBufferCommand,
  // Result types
  DebugCommandResult,
  QueryResult,
  ListDocumentsResult,
  GetDocumentResult,
  DeleteDocumentResult,
  StoreStatsResult,
  PingResult,
  ClearBufferResult,
  GetBufferResult,
  // Message types
  ServerMessage,
  ClientMessage,
} from "./types";

// Re-export event types for user reference
export type {
  DebugEvent,
  DebugEventType,
  DebugEventBase,
  IngestStartEvent,
  IngestChunkingCompleteEvent,
  IngestEmbeddingStartEvent,
  IngestEmbeddingBatchEvent,
  IngestEmbeddingCompleteEvent,
  IngestStorageCompleteEvent,
  IngestCompleteEvent,
  IngestErrorEvent,
  RetrieveStartEvent,
  RetrieveEmbeddingCompleteEvent,
  RetrieveDatabaseQueryCompleteEvent,
  RetrieveCompleteEvent,
  RerankStartEvent,
  RerankCompleteEvent,
  DeleteStartEvent,
  DeleteCompleteEvent,
} from "@registry/core/debug-events";
