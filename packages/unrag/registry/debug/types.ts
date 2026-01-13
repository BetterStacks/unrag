/**
 * Debug battery types.
 *
 * These types define the configuration and interfaces for the debug panel
 * and WebSocket communication between the user's app and the debug TUI.
 */

import type { DebugEvent } from "@registry/core/debug-events";

// Re-export event types for convenience
export type { DebugEvent, DebugEventType } from "@registry/core/debug-events";

/**
 * Configuration for the debug WebSocket server.
 */
export type DebugServerConfig = {
  /** Port to listen on. @default 3847 */
  port?: number;
  /** Host to bind to. @default "localhost" */
  host?: string;
  /** Maximum number of connected clients. @default 5 */
  maxClients?: number;
};

/**
 * Debug server instance interface.
 */
export type DebugServer = {
  /** Port the server is listening on */
  port: number;
  /** Host the server is bound to */
  host: string;
  /** Number of currently connected clients */
  clientCount: number;
  /** Broadcast an event to all connected clients */
  broadcast: (event: DebugEvent) => void;
  /** Stop the server and disconnect all clients */
  stop: () => Promise<void>;
};

/**
 * Configuration for the debug WebSocket client.
 */
export type DebugClientConfig = {
  /** WebSocket URL to connect to. @default "ws://localhost:3847" */
  url?: string;
  /** Whether to auto-reconnect on disconnect. @default true */
  reconnect?: boolean;
  /** Delay between reconnection attempts in ms. @default 1000 */
  reconnectDelay?: number;
  /** Maximum reconnection attempts. @default 10 */
  maxReconnectAttempts?: number;
};

/**
 * Connection status.
 */
export type DebugConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

/**
 * Debug client connection interface.
 */
export type DebugConnection = {
  /** Current connection status */
  status: DebugConnectionStatus;
  /** Session ID from the connected server (available when connected) */
  sessionId?: string;
  /** Register an event handler. Returns unsubscribe function. */
  onEvent: (handler: (event: DebugEvent) => void) => () => void;
  /** Register a status change handler. Returns unsubscribe function. */
  onStatusChange: (handler: (status: DebugConnectionStatus) => void) => () => void;
  /** Send a command to the server and get a response. */
  sendCommand: (command: DebugCommand) => Promise<DebugCommandResult>;
  /** Disconnect from the server. */
  disconnect: () => void;
};

// ============================================================================
// Debug Commands
// ============================================================================

/**
 * Query command - execute a retrieve operation.
 */
export type QueryCommand = {
  type: "query";
  query: string;
  topK?: number;
  scope?: string;
};

/**
 * List documents command.
 */
export type ListDocumentsCommand = {
  type: "list-documents";
  prefix?: string;
  limit?: number;
  offset?: number;
};

/**
 * Get document details command.
 */
export type GetDocumentCommand = {
  type: "get-document";
  sourceId: string;
};

/**
 * Delete document command.
 */
export type DeleteDocumentCommand = {
  type: "delete-document";
  sourceId?: string;
  sourceIdPrefix?: string;
};

/**
 * Store stats command.
 */
export type StoreStatsCommand = {
  type: "store-stats";
};

/**
 * Ping command for connection testing.
 */
export type PingCommand = {
  type: "ping";
};

/**
 * Clear event buffer command.
 */
export type ClearBufferCommand = {
  type: "clear-buffer";
};

/**
 * Get buffered events command.
 */
export type GetBufferCommand = {
  type: "get-buffer";
};

/**
 * Union of all debug commands.
 */
export type DebugCommand =
  | QueryCommand
  | ListDocumentsCommand
  | GetDocumentCommand
  | DeleteDocumentCommand
  | StoreStatsCommand
  | PingCommand
  | ClearBufferCommand
  | GetBufferCommand;

/**
 * Command type strings.
 */
export type DebugCommandType = DebugCommand["type"];

// ============================================================================
// Command Results
// ============================================================================

/**
 * Base result type.
 */
export type DebugCommandResultBase = {
  success: boolean;
  error?: string;
};

/**
 * Query result.
 */
export type QueryResult = DebugCommandResultBase & {
  type: "query";
  chunks?: Array<{
    id: string;
    content: string;
    score: number;
    sourceId: string;
    documentId: string;
    metadata: Record<string, unknown>;
  }>;
  durations?: {
    embeddingMs: number;
    retrievalMs: number;
    totalMs: number;
  };
};

/**
 * List documents result.
 */
export type ListDocumentsResult = DebugCommandResultBase & {
  type: "list-documents";
  documents?: Array<{
    sourceId: string;
    chunkCount: number;
    createdAt?: string;
  }>;
  total?: number;
};

/**
 * Get document result.
 */
export type GetDocumentResult = DebugCommandResultBase & {
  type: "get-document";
  document?: {
    sourceId: string;
    chunks: Array<{
      id: string;
      content: string;
      sequence: number;
      metadata: Record<string, unknown>;
    }>;
    metadata: Record<string, unknown>;
  };
};

/**
 * Delete document result.
 */
export type DeleteDocumentResult = DebugCommandResultBase & {
  type: "delete-document";
  deletedCount?: number;
};

/**
 * Store stats result.
 */
export type StoreStatsResult = DebugCommandResultBase & {
  type: "store-stats";
  stats?: {
    adapter: string;
    database?: string;
    schema?: string;
    tables?: Array<{
      name: string;
      rowCount: number;
      size?: number;
    }>;
    embeddingDimension?: number;
    totalVectors?: number;
  };
};

/**
 * Ping result.
 */
export type PingResult = DebugCommandResultBase & {
  type: "ping";
  sessionId?: string;
  uptime?: number;
};

/**
 * Clear buffer result.
 */
export type ClearBufferResult = DebugCommandResultBase & {
  type: "clear-buffer";
  clearedCount?: number;
};

/**
 * Get buffer result.
 */
export type GetBufferResult = DebugCommandResultBase & {
  type: "get-buffer";
  events?: DebugEvent[];
};

/**
 * Union of all command results.
 */
export type DebugCommandResult =
  | QueryResult
  | ListDocumentsResult
  | GetDocumentResult
  | DeleteDocumentResult
  | StoreStatsResult
  | PingResult
  | ClearBufferResult
  | GetBufferResult;

// ============================================================================
// WebSocket Message Types
// ============================================================================

/**
 * Message from server to client.
 */
export type ServerMessage =
  | { type: "event"; event: DebugEvent }
  | { type: "welcome"; sessionId: string; bufferedEvents: DebugEvent[] }
  | { type: "result"; requestId: string; result: DebugCommandResult };

/**
 * Message from client to server.
 */
export type ClientMessage =
  | { type: "command"; requestId: string; command: DebugCommand };
