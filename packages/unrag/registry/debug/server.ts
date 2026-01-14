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
} from "@registry/debug/types";
import { handleCommand } from "@registry/debug/commands";

// Default configuration values
const DEFAULT_PORT = 3847;
const DEFAULT_HOST = "localhost";
const DEFAULT_MAX_CLIENTS = 5;

// ---------------------------------------------------------------------------
// Structural types for runtime-agnostic WebSocket handling
// ---------------------------------------------------------------------------

/**
 * Minimal WebSocket client interface used by both Bun and Node.js runtimes.
 */
type WebSocketClient = {
  send: (data: string) => void;
  close: (code?: number, reason?: string | Uint8Array) => void;
};

/**
 * Minimal interface for Bun.serve() return type.
 * Defined structurally to avoid requiring Bun types at compile time.
 */
type BunServer = {
  stop: (closeActiveConnections?: boolean) => void;
};

/**
 * Minimal interface for Node.js WebSocket server (ws package).
 */
type NodeWebSocketServer = {
  close: (cb?: () => void) => void;
  on: (event: "connection", handler: (ws: NodeWebSocketClient) => void) => void;
};

/**
 * Minimal interface for Node.js WebSocket client (ws package).
 */
type NodeWebSocketClient = WebSocketClient & {
  on: {
    (event: "message", handler: (data: WsMessageData) => void): void;
    (event: "close", handler: () => void): void;
  };
};

/**
 * Extended debug server instance with runtime-specific server references.
 */
type DebugServerInstance = DebugServer & {
  bunServer: BunServer | null;
  nodeHttpServer: import("node:http").Server | null;
  nodeWss: NodeWebSocketServer | null;
  clients: Set<WebSocketClient>;
  unsubscribe: (() => void) | null;
  startTime: number;
};

/**
 * WebSocket message payload types we may receive from Bun and Node (ws).
 *
 * - Bun: string | ArrayBuffer
 * - ws: Buffer | ArrayBuffer | Buffer[] | string (depending on configuration)
 */
type WsMessageData = string | ArrayBuffer | Uint8Array | readonly Uint8Array[];

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

/**
 * Type guard for accessing Bun global when available.
 */
type GlobalWithBun = typeof globalThis & {
  Bun?: {
    serve: (config: BunServeConfig) => BunServer;
  };
};

/**
 * Bun serve configuration (minimal subset we use).
 */
type BunServeConfig = {
  port: number;
  hostname: string;
  fetch: (req: Request, server: BunServerContext) => Response | undefined;
  websocket: BunWebSocketHandlers;
};

type BunServerContext = {
  upgrade: (req: Request, options?: { data?: unknown }) => boolean;
};

type BunWebSocketHandlers = {
  open: (ws: WebSocketClient) => void;
  message: (ws: WebSocketClient, message: WsMessageData) => void;
  close: (ws: WebSocketClient) => void;
};

/**
 * Check if Bun.serve is available at runtime.
 */
function hasBunServe(): boolean {
  const g = globalThis as GlobalWithBun;
  return typeof g.Bun?.serve === "function";
}

/**
 * Get Bun.serve function with proper typing.
 */
function getBunServe(): ((config: BunServeConfig) => BunServer) | null {
  const g = globalThis as GlobalWithBun;
  return g.Bun?.serve ?? null;
}

function decodeWsMessage(raw: WsMessageData): string | null {
  if (typeof raw === "string") return raw;

  // Buffer is a Uint8Array subclass, so this covers Buffer too.
  if (raw instanceof Uint8Array) {
    return new TextDecoder().decode(raw);
  }

  if (raw instanceof ArrayBuffer) {
    return new TextDecoder().decode(raw);
  }

  if (isUint8ArrayArray(raw)) return decodeUint8ArrayChunks(raw);

  return null;
}

function isUint8ArrayArray(value: unknown): value is readonly Uint8Array[] {
  return Array.isArray(value) && value.every((v) => v instanceof Uint8Array);
}

function decodeUint8ArrayChunks(chunks: readonly Uint8Array[]): string {
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

// ---------------------------------------------------------------------------
// Server state
// ---------------------------------------------------------------------------

let serverInstance: DebugServerInstance | null = null;

// ---------------------------------------------------------------------------
// Server implementation
// ---------------------------------------------------------------------------

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
  const clients = new Set<WebSocketClient>();
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

  // Shared handler logic
  const handleOpen = (ws: WebSocketClient) => {
    if (clients.size >= maxClients) {
      ws.close(1013, "Maximum clients reached");
      return;
    }

    clients.add(ws);
    instance.clientCount = clients.size;

    const welcome: ServerMessage = {
      type: "welcome",
      sessionId: emitter.getSessionId(),
      bufferedEvents: emitter.getBuffer(),
    };
    ws.send(JSON.stringify(welcome));

    console.log(`[unrag:debug] Client connected (${clients.size}/${maxClients})`);
  };

  const handleMessage = (ws: WebSocketClient, rawMessage: WsMessageData) => {
    try {
      const text = decodeWsMessage(rawMessage);
      if (!text) return;
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
          .catch((error: unknown) => {
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
  };

  const handleClose = (ws: WebSocketClient) => {
    clients.delete(ws);
    instance.clientCount = clients.size;
    console.log(`[unrag:debug] Client disconnected (${clients.size}/${maxClients})`);
  };

  // Start the WebSocket server (Bun or Node)
  try {
    const bunServe = getBunServe();

    if (bunServe) {
      instance.bunServer = bunServe({
        port,
        hostname: host,
        fetch(req: Request, server: BunServerContext) {
          const upgraded = server.upgrade(req, { data: {} });
          if (upgraded) return undefined;
          return new Response("Upgrade Required", {
            status: 426,
            headers: { Upgrade: "websocket" },
          });
        },
        websocket: {
          open: handleOpen,
          message: handleMessage,
          close: handleClose,
        },
      });
    } else {
      // Node runtime fallback (Next.js, etc.). Requires `ws`.
      const wsModule = await loadWsModule();
      if (!wsModule) {
        throw new Error(
          "[unrag:debug] Node runtime detected but 'ws' is not installed. " +
            "Install it in your app: `npm install ws` or `bun add ws`."
        );
      }

      const { createServer } = await import("node:http");
      const httpServer = createServer();
      const WebSocketServer = wsModule.WebSocketServer ?? wsModule.Server;
      if (!WebSocketServer) {
        throw new Error(
          "[unrag:debug] Failed to load WebSocketServer from 'ws' module. " +
            "This may indicate an incompatible 'ws' version."
        );
      }
      const wss = new WebSocketServer({
        server: httpServer,
        maxPayload: 1024 * 1024,
      }) as NodeWebSocketServer;

      wss.on("connection", (ws: NodeWebSocketClient) => {
        handleOpen(ws);

        ws.on("message", (raw: WsMessageData) => handleMessage(ws, raw));

        ws.on("close", () => {
          handleClose(ws);
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
 * Dynamically load the `ws` module for Node.js environments.
 * Returns null if not available.
 */
async function loadWsModule(): Promise<WsModule | null> {
  try {
    // Dynamic import with string to prevent bundlers from including ws
    const moduleName = "ws";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as unknown;
    return normalizeWsModule(mod);
  } catch {
    return null;
  }
}

function normalizeWsModule(mod: unknown): WsModule | null {
  if (!mod || typeof mod !== "object") return null;

  const m = mod as Record<string, unknown>;
  const candidate = (m.default && typeof m.default === "object" ? (m.default as Record<string, unknown>) : m);

  const WebSocketServer = candidate.WebSocketServer;
  const Server = candidate.Server;

  const isCtor = (v: unknown): v is new (options: WsServerOptions) => NodeWebSocketServer =>
    typeof v === "function";

  const out: WsModule = {};
  if (isCtor(WebSocketServer)) out.WebSocketServer = WebSocketServer;
  if (isCtor(Server)) out.Server = Server;

  return out.WebSocketServer || out.Server ? out : null;
}

/**
 * Type for the `ws` module exports we use.
 */
type WsModule = {
  WebSocketServer?: new (options: WsServerOptions) => NodeWebSocketServer;
  Server?: new (options: WsServerOptions) => NodeWebSocketServer;
};

type WsServerOptions = {
  server: import("node:http").Server;
  maxPayload?: number;
};

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
