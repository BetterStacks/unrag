/**
 * Debug WebSocket client.
 *
 * This client connects to the debug server running in the user's application
 * and receives real-time debug events. It's used by the debug TUI.
 */

import type { DebugEvent } from "@registry/core/debug-events";
import type {
  DebugClientConfig,
  DebugConnection,
  DebugConnectionStatus,
  DebugCommand,
  DebugCommandResult,
  ServerMessage,
  ClientMessage,
} from "./types";

// Default configuration values
const DEFAULT_URL = "ws://localhost:3847";
const DEFAULT_RECONNECT = true;
const DEFAULT_RECONNECT_DELAY = 1000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

type PendingRequest = {
  resolve: (result: DebugCommandResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

/**
 * Connect to a debug server and return a connection interface.
 */
export function connectDebugClient(config?: DebugClientConfig): DebugConnection {
  const url = config?.url ?? DEFAULT_URL;
  const shouldReconnect = config?.reconnect ?? DEFAULT_RECONNECT;
  const reconnectDelay = config?.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;
  const maxReconnectAttempts = config?.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;

  let status: DebugConnectionStatus = "connecting";
  let sessionId: string | undefined;
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const eventHandlers = new Set<(event: DebugEvent) => void>();
  const statusHandlers = new Set<(status: DebugConnectionStatus) => void>();
  const pendingRequests = new Map<string, PendingRequest>();

  function updateStatus(newStatus: DebugConnectionStatus) {
    status = newStatus;
    for (const handler of statusHandlers) {
      try {
        handler(status);
      } catch {
        // Ignore handler errors
      }
    }
  }

  function handleEvent(event: DebugEvent) {
    for (const handler of eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  function handleMessage(data: string) {
    try {
      const message = JSON.parse(data) as ServerMessage;

      switch (message.type) {
        case "welcome":
          sessionId = message.sessionId;
          // Replay buffered events
          for (const event of message.bufferedEvents) {
            handleEvent(event);
          }
          break;

        case "event":
          handleEvent(message.event);
          break;

        case "result":
          const pending = pendingRequests.get(message.requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingRequests.delete(message.requestId);
            pending.resolve(message.result);
          }
          break;
      }
    } catch {
      // Ignore malformed messages
    }
  }

  function connect() {
    if (ws) {
      ws.close();
    }

    updateStatus("connecting");

    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        reconnectAttempts = 0;
        updateStatus("connected");
      };

      ws.onmessage = (event) => {
        handleMessage(event.data as string);
      };

      ws.onclose = () => {
        ws = null;
        sessionId = undefined;

        // Reject all pending requests
        for (const [id, pending] of pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("Connection closed"));
          pendingRequests.delete(id);
        }

        if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
          updateStatus("reconnecting");
          reconnectTimer = setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, reconnectDelay);
        } else {
          updateStatus("disconnected");
        }
      };

      ws.onerror = () => {
        updateStatus("error");
      };
    } catch {
      updateStatus("error");
      if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
        reconnectTimer = setTimeout(() => {
          reconnectAttempts++;
          connect();
        }, reconnectDelay);
      }
    }
  }

  // Start initial connection
  connect();

  const connection: DebugConnection = {
    get status() {
      return status;
    },

    get sessionId() {
      return sessionId;
    },

    onEvent(handler) {
      eventHandlers.add(handler);
      return () => {
        eventHandlers.delete(handler);
      };
    },

    onStatusChange(handler) {
      statusHandlers.add(handler);
      return () => {
        statusHandlers.delete(handler);
      };
    },

    async sendCommand(command: DebugCommand): Promise<DebugCommandResult> {
      if (!ws || status !== "connected") {
        return {
          type: command.type,
          success: false,
          error: "Not connected to debug server",
        } as DebugCommandResult;
      }

      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();

        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId);
          reject(new Error("Command timed out"));
        }, 30000); // 30 second timeout

        pendingRequests.set(requestId, { resolve, reject, timeout });

        const message: ClientMessage = {
          type: "command",
          requestId,
          command,
        };

        ws!.send(JSON.stringify(message));
      });
    },

    disconnect() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (ws) {
        ws.close(1000, "Client disconnecting");
        ws = null;
      }

      // Reject all pending requests
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Client disconnected"));
        pendingRequests.delete(id);
      }

      eventHandlers.clear();
      statusHandlers.clear();
      updateStatus("disconnected");
    },
  };

  return connection;
}

/**
 * Create a debug client that auto-reconnects.
 * This is a convenience function for the TUI.
 */
export function createAutoReconnectClient(
  url?: string,
  onEvent?: (event: DebugEvent) => void,
  onStatusChange?: (status: DebugConnectionStatus) => void
): DebugConnection {
  const client = connectDebugClient({
    url,
    reconnect: true,
    reconnectDelay: 1000,
    maxReconnectAttempts: Infinity,
  });

  if (onEvent) {
    client.onEvent(onEvent);
  }

  if (onStatusChange) {
    client.onStatusChange(onStatusChange);
  }

  return client;
}
