/**
 * Debug WebSocket server.
 *
 * This server runs in the user's application when UNRAG_DEBUG=true.
 * It broadcasts debug events to connected TUI clients and handles
 * debug commands for interactive inspection.
 */

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

type ClientLike = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

type DebugServerInstance = DebugServer & {
  // bun runtime
  bunServer: ReturnType<typeof Bun.serve> | null;
  // node runtime
  nodeHttpServer: import("node:http").Server | null;
  nodeWss: { close: (cb?: () => void) => void } | null;
  clients: Set<ClientLike>;
  unsubscribe: (() => void) | null;
  startTime: number;
};

function hasBunServe(): boolean {
  return typeof (globalThis as any).Bun?.serve === "function";
}

async function createClientId(): Promise<string> {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const { randomUUID } = await import("node:crypto");
  return randomUUID();
}

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
  const clients = new Set<ClientLike>();
  const startTime = Date.now();

  const instance: DebugServerInstance = {
    port,
    host,
    clientCount: 0,
    bunServer: null,
    nodeHttpServer: null,
    nodeWss: null,
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

      if (instance.nodeWss) {
        await new Promise<void>((resolve) => instance.nodeWss!.close(() => resolve()));
        instance.nodeWss = null;
      }
      if (instance.nodeHttpServer) {
        await new Promise<void>((resolve) => instance.nodeHttpServer!.close(() => resolve()));
        instance.nodeHttpServer = null;
      }

      serverInstance = null;
    },
  };

  // Subscribe to debug events
  instance.unsubscribe = emitter.onEvent((event) => {
    instance.broadcast(event);
  });

  // Start the WebSocket server (Bun or Node)
  try {
    if (hasBunServe()) {
      const BunRef = (globalThis as any).Bun as typeof Bun;
      instance.bunServer = BunRef.serve({
        port,
        hostname: host,
        fetch(req, server) {
          const upgraded = server.upgrade(req, {
            data: { id: "bun" },
          });
          if (upgraded) return undefined;
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

            clients.add(ws as unknown as ClientLike);
            instance.clientCount = clients.size;

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
              const text =
                typeof rawMessage === "string" ? rawMessage : rawMessage.toString();
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
            clients.delete(ws as unknown as ClientLike);
            instance.clientCount = clients.size;
            console.log(`[unrag:debug] Client disconnected (${clients.size}/${maxClients})`);
          },
        },
      });
    } else {
      // Node runtime fallback (Next.js, etc.). Requires `ws`.
      let Ws: any;
      try {
        Ws = await import("ws");
      } catch {
        throw new Error(
          "[unrag:debug] Node runtime detected but 'ws' is not installed. Install it in your app: `bun add ws` (or `npm i ws`)."
        );
      }

      const { createServer } = await import("node:http");
      const httpServer = createServer();
      const WebSocketServer = Ws.WebSocketServer ?? Ws.Server;
      const wss = new WebSocketServer({ server: httpServer, maxPayload: 1024 * 1024 });

      wss.on("connection", async (ws: any) => {
        if (clients.size >= maxClients) {
          ws.close(1013, "Maximum clients reached");
          return;
        }

        clients.add(ws as ClientLike);
        instance.clientCount = clients.size;

        const welcome: ServerMessage = {
          type: "welcome",
          sessionId: emitter.getSessionId(),
          bufferedEvents: emitter.getBuffer(),
        };
        ws.send(JSON.stringify(welcome));

        console.log(`[unrag:debug] Client connected (${clients.size}/${maxClients})`);

        ws.on("message", (raw: any) => {
          try {
            const text = typeof raw === "string" ? raw : raw.toString();
            const message = JSON.parse(text) as ClientMessage;
            if (message.type !== "command") return;

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
          } catch {
            // ignore malformed
          }
        });

        ws.on("close", () => {
          clients.delete(ws as ClientLike);
          instance.clientCount = clients.size;
          console.log(`[unrag:debug] Client disconnected (${clients.size}/${maxClients})`);
        });
      });

      await new Promise<void>((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, host, () => resolve());
      });

      instance.nodeHttpServer = httpServer;
      instance.nodeWss = wss;
    }

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
