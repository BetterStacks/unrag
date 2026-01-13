/**
 * Debug command handlers.
 *
 * These handlers process commands sent from the debug TUI client
 * and return appropriate results.
 */

import type { DebugEmitter } from "@registry/core/debug-emitter";
import type {
  DebugCommand,
  DebugCommandResult,
  PingResult,
  ClearBufferResult,
  GetBufferResult,
  QueryResult,
  ListDocumentsResult,
  GetDocumentResult,
  DeleteDocumentResult,
  StoreStatsResult,
} from "@registry/debug/types";

/**
 * Handle a debug command and return the result.
 */
export async function handleCommand(
  command: DebugCommand,
  emitter: DebugEmitter,
  startTime: number
): Promise<DebugCommandResult> {
  switch (command.type) {
    case "ping":
      return handlePing(emitter, startTime);

    case "clear-buffer":
      return handleClearBuffer(emitter);

    case "get-buffer":
      return handleGetBuffer(emitter);

    case "query":
      return handleQuery(command);

    case "list-documents":
      return handleListDocuments(command);

    case "get-document":
      return handleGetDocument(command);

    case "delete-document":
      return handleDeleteDocument(command);

    case "store-stats":
      return handleStoreStats();

    default: {
      const _exhaustive: never = command;
      return {
        type: (command as DebugCommand).type,
        success: false,
        error: `Unknown command type: ${(command as DebugCommand).type}`,
      } as DebugCommandResult;
    }
  }
}

/**
 * Handle ping command.
 */
function handlePing(emitter: DebugEmitter, startTime: number): PingResult {
  return {
    type: "ping",
    success: true,
    sessionId: emitter.getSessionId(),
    uptime: Date.now() - startTime,
  };
}

/**
 * Handle clear-buffer command.
 */
function handleClearBuffer(emitter: DebugEmitter): ClearBufferResult {
  const buffer = emitter.getBuffer();
  const count = buffer.length;
  emitter.clearBuffer();

  return {
    type: "clear-buffer",
    success: true,
    clearedCount: count,
  };
}

/**
 * Handle get-buffer command.
 */
function handleGetBuffer(emitter: DebugEmitter): GetBufferResult {
  return {
    type: "get-buffer",
    success: true,
    events: emitter.getBuffer(),
  };
}

/**
 * Handle query command.
 * Note: This requires the context engine to be available.
 * For now, returns a placeholder - actual implementation needs
 * the context engine instance to be passed in.
 */
async function handleQuery(
  _command: { type: "query"; query: string; topK?: number; scope?: string }
): Promise<QueryResult> {
  // TODO: This needs access to the context engine instance.
  // For now, we return an error indicating this feature requires
  // the context engine to be registered with the debug server.
  return {
    type: "query",
    success: false,
    error:
      "Query command requires context engine integration. " +
      "Use the retrieve function directly in your application.",
  };
}

/**
 * Handle list-documents command.
 * Note: This requires store access which depends on the context engine.
 */
async function handleListDocuments(
  _command: { type: "list-documents"; prefix?: string; limit?: number; offset?: number }
): Promise<ListDocumentsResult> {
  // TODO: This needs access to the store instance.
  return {
    type: "list-documents",
    success: false,
    error:
      "List documents command requires store integration. " +
      "This feature will be available in a future update.",
  };
}

/**
 * Handle get-document command.
 */
async function handleGetDocument(
  _command: { type: "get-document"; sourceId: string }
): Promise<GetDocumentResult> {
  // TODO: This needs access to the store instance.
  return {
    type: "get-document",
    success: false,
    error:
      "Get document command requires store integration. " +
      "This feature will be available in a future update.",
  };
}

/**
 * Handle delete-document command.
 */
async function handleDeleteDocument(
  _command: { type: "delete-document"; sourceId?: string; sourceIdPrefix?: string }
): Promise<DeleteDocumentResult> {
  // TODO: This needs access to the store instance.
  return {
    type: "delete-document",
    success: false,
    error:
      "Delete document command requires store integration. " +
      "This feature will be available in a future update.",
  };
}

/**
 * Handle store-stats command.
 */
async function handleStoreStats(): Promise<StoreStatsResult> {
  // TODO: This needs access to the store instance.
  return {
    type: "store-stats",
    success: false,
    error:
      "Store stats command requires store integration. " +
      "This feature will be available in a future update.",
  };
}
