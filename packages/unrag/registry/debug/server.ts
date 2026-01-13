/**
 * Debug WebSocket server.
 *
 * This server runs in the user's application when UNRAG_DEBUG=true.
 * It broadcasts debug events to connected TUI clients and handles
 * debug commands for interactive inspection.
 */

import type { ServerWebSocket } from "bun";
import type { DebugEvent } from "@registry/core/debug-events";
import { getDebugEmitter } from "@registry/core/debug-emitter";
import type {
  DebugServerConfig,
  DebugServer,
  ClientMessage,
  ServerMessage,
  DebugCommandResult,
} from "./types";
import { handleCommand } from "./commands";

// Default configuration values
const DEFAULT_PORT = 3847;
const DEFAULT_HOST = "localhost";
const DEFAULT_MAX_CLIENTS = 5;

// Global server instance
let serverInstance: DebugServerInstance | null = null;

type ClientData = {
  id: string;
};

type DebugServerInstance = DebugServer & {
  bunServer: ReturnType<typeof Bun.serve> | null;
  clients: Set<ServerWebSocket<ClientData>>;
  unsubscribe: (() => void) | null;
  startTime: number;
};

/**
 * Start the debug WebSocket server.
 * If UNRAG_DEBUG is not enabled, this is a no-op.
 */
export async function startDebugServer(
  config?: DebugServerConfig
): Promise<DebugServer | null> {
  const emitter = getDebugEmitter();

  // Only start if debugging is enabled
  if (!emitter.isEnabled()) {
    return null;
  }

  // Return existing server if already running
  if (serverInstance) {
    return serverInstance;
  }

  const port = config?.port ?? DEFAULT_PORT;
  const host = config?.host ?? DEFAULT_HOST;
  const maxClients = config?.maxClients ?? DEFAULT_MAX_CLIENTS;
  const clients = new Set<ServerWebSocket<ClientData>>();
  const startTime = Date.now();

  const instance: DebugServerInstance = {
    port,
    host,
    clientCount: 0,
    bunServer: null,
    clients,
    unsubscribe: null,
    startTime,

    broadcast: (event: DebugEvent) => {
      const message: ServerMessage = { type: "event", event };
      const data = JSON.stringify(message);
      for (const client of clients) {
        client.send(data);
      }
    },

    stop: async () => {
      if (instance.unsubscribe) {
        instance.unsubscribe();
        instance.unsubscribe = null;
      }

      for (const client of clients) {
        client.close(1000, "Server shutting down");
      }
      clients.clear();

      if (instance.bunServer) {
        instance.bunServer.stop();
        instance.bunServer = null;
      }

      serverInstance = null;
    },
  };

  // Subscribe to debug events
  instance.unsubscribe = emitter.onEvent((event) => {
    instance.broadcast(event);
  });

  // Start the WebSocket server
  try {
    instance.bunServer = Bun.serve<ClientData>({
      port,
      hostname: host,
      fetch(req, server) {
        // Upgrade HTTP connection to WebSocket
        const upgraded = server.upgrade(req, {
          data: { id: crypto.randomUUID() },
        });

        if (upgraded) {
          return undefined;
        }

        // Return 426 Upgrade Required for non-WebSocket requests
        return new Response("Upgrade Required", {
          status: 426,
          headers: { Upgrade: "websocket" },
        });
      },
      websocket: {
        open(ws) {
          if (clients.size >= maxClients) {
            ws.close(1013, "Maximum clients reached");
            return;
          }

          clients.add(ws);
          instance.clientCount = clients.size;

          // Send welcome message with session info and buffered events
          const welcome: ServerMessage = {
            type: "welcome",
            sessionId: emitter.getSessionId(),
            bufferedEvents: emitter.getBuffer(),
          };
          ws.send(JSON.stringify(welcome));

          console.log(`[unrag:debug] Client connected (${clients.size}/${maxClients})`);
        },

        message(ws, rawMessage) {
          try {
            const text = typeof rawMessage === "string" ? rawMessage : rawMessage.toString();
            const message = JSON.parse(text) as ClientMessage;

            if (message.type === "command") {
              handleCommand(message.command, emitter, instance.startTime)
                .then((result) => {
                  const response: ServerMessage = {
                    type: "result",
                    requestId: message.requestId,
                    result,
                  };
                  ws.send(JSON.stringify(response));
                })
                .catch((error) => {
                  const errorResult: DebugCommandResult = {
                    type: message.command.type,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                  } as DebugCommandResult;
                  const response: ServerMessage = {
                    type: "result",
                    requestId: message.requestId,
                    result: errorResult,
                  };
                  ws.send(JSON.stringify(response));
                });
            }
          } catch {
            // Ignore malformed messages
          }
        },

        close(ws) {
          clients.delete(ws);
          instance.clientCount = clients.size;
          console.log(`[unrag:debug] Client disconnected (${clients.size}/${maxClients})`);
        },
      },
    });

    serverInstance = instance;
    console.log(`[unrag:debug] Server started at ws://${host}:${port}`);

    return instance;
  } catch (error) {
    console.error(`[unrag:debug] Failed to start server:`, error);
    if (instance.unsubscribe) {
      instance.unsubscribe();
    }
    throw error;
  }
}

/**
 * Stop the debug server if running.
 */
export async function stopDebugServer(): Promise<void> {
  if (serverInstance) {
    await serverInstance.stop();
  }
}

/**
 * Get the current debug server instance, if running.
 */
export function getDebugServer(): DebugServer | null {
  return serverInstance;
}
