/**
 * Debug event emitter for Unrag.
 *
 * When UNRAG_DEBUG=true, this module emits events that can be captured
 * by the debug TUI. Events are stored in a buffer and can be sent via
 * WebSocket when a debug client connects.
 *
 * This module is designed to be zero-cost when debugging is disabled:
 * - No WebSocket server is started
 * - emit() is a no-op
 * - No memory is allocated for event buffers
 */

import type { DebugEvent } from "@registry/core/debug-events";

/**
 * Payload for emitting a debug event (without timestamp and sessionId).
 */
export type DebugEventInput = Omit<DebugEvent, "timestamp" | "sessionId">;

/**
 * Configuration for the debug emitter.
 */
export type DebugEmitterConfig = {
  /** Whether debugging is enabled */
  enabled: boolean;
  /** Port for the WebSocket server (default: 3847) */
  port: number;
  /** Unique session identifier */
  sessionId: string;
  /** Maximum number of events to buffer (default: 1000) */
  maxBufferSize: number;
};

/**
 * Event handler callback type.
 */
export type DebugEventHandler = (event: DebugEvent) => void;

/**
 * The debug emitter interface.
 */
export type DebugEmitter = {
  /** Emit a debug event. No-op if debugging is disabled. */
  emit: (event: DebugEventInput) => void;
  /** Check if debugging is enabled. */
  isEnabled: () => boolean;
  /** Get the current session ID. */
  getSessionId: () => string;
  /** Register an event handler. Returns unsubscribe function. */
  onEvent: (handler: DebugEventHandler) => () => void;
  /** Get buffered events (for replay on client connect). */
  getBuffer: () => DebugEvent[];
  /** Clear the event buffer. */
  clearBuffer: () => void;
  /** Shutdown the emitter. */
  shutdown: () => void;
};

// Global singleton instance
let globalEmitter: DebugEmitter | null = null;

/**
 * Get the global debug emitter instance.
 * Creates a new instance if one doesn't exist.
 */
export function getDebugEmitter(): DebugEmitter {
  if (!globalEmitter) {
    globalEmitter = createDebugEmitter();
  }
  return globalEmitter;
}

/**
 * Reset the global emitter (for testing).
 */
export function resetDebugEmitter(): void {
  if (globalEmitter) {
    globalEmitter.shutdown();
    globalEmitter = null;
  }
}

/**
 * Create a new debug emitter instance.
 */
function createDebugEmitter(): DebugEmitter {
  const enabled = process.env.UNRAG_DEBUG === "true";
  const port = parseInt(process.env.UNRAG_DEBUG_PORT ?? "3847", 10);
  const maxBufferSize = parseInt(process.env.UNRAG_DEBUG_BUFFER_SIZE ?? "1000", 10);
  const sessionId = generateSessionId();

  // Only allocate buffer if debugging is enabled
  const buffer: DebugEvent[] = enabled ? [] : [];
  const handlers: Set<DebugEventHandler> = new Set();

  return {
    emit: (payload: DebugEventInput): void => {
      if (!enabled) return;

      const event: DebugEvent = {
        ...payload,
        timestamp: Date.now(),
        sessionId,
      } as DebugEvent;

      // Add to buffer (with size limit)
      buffer.push(event);
      if (buffer.length > maxBufferSize) {
        buffer.shift();
      }

      // Notify all handlers
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // Ignore handler errors to prevent disrupting the main flow
        }
      }
    },

    isEnabled: () => enabled,

    getSessionId: () => sessionId,

    onEvent: (handler: DebugEventHandler): (() => void) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    getBuffer: (): DebugEvent[] => {
      return [...buffer];
    },

    clearBuffer: (): void => {
      buffer.length = 0;
    },

    shutdown: (): void => {
      handlers.clear();
      buffer.length = 0;
    },
  };
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  // Use crypto.randomUUID if available, otherwise fall back to timestamp + random
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
