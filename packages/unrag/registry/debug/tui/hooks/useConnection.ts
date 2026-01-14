/**
 * Hook for managing WebSocket connection to debug server.
 */

import { useState, useEffect, useRef } from "react";
import type {
  DebugCommandResult,
  DebugCommandType,
  DebugCapability,
  DebugConnection,
  DebugConnectionStatus,
  DebugServerInfo,
} from "@registry/debug/types";
import { connectDebugClient } from "@registry/debug/client";

const DEFAULT_URL = "ws://localhost:3847";

function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

function notConnectedResult(type: DebugCommandType): DebugCommandResult {
  const base = { success: false, error: "Not connected" } as const;
  switch (type) {
    case "query":
      return { type, ...base };
    case "ingest":
      return { type, ...base };
    case "list-documents":
      return { type, ...base };
    case "get-document":
      return { type, ...base };
    case "delete-document":
      return { type, ...base };
    case "delete-chunks":
      return { type, ...base };
    case "store-stats":
      return { type, ...base };
    case "doctor":
      return { type, ...base, checks: [] };
    case "run-eval":
      return { type, ...base };
    case "ping":
      return { type, ...base };
    case "clear-buffer":
      return { type, ...base };
    case "get-buffer":
      return { type, ...base };
    default:
      return assertNever(type);
  }
}

export function useConnection(url?: string): DebugConnection {
  const connectionRef = useRef<DebugConnection | null>(null);
  const [status, setStatus] = useState<DebugConnectionStatus>("connecting");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [protocolVersion, setProtocolVersion] = useState<number | undefined>();
  const [capabilities, setCapabilities] = useState<DebugCapability[] | undefined>();
  const [serverInfo, setServerInfo] = useState<DebugServerInfo | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    // Create connection on mount
    const connection = connectDebugClient({
      url: url ?? DEFAULT_URL,
      reconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: Infinity,
    });

    connectionRef.current = connection;

    // Subscribe to status changes
    const unsubStatus = connection.onStatusChange((newStatus) => {
      setStatus(newStatus);
      if (newStatus === "connected") {
        setSessionId(connection.sessionId);
        setProtocolVersion(connection.protocolVersion);
        setCapabilities(connection.capabilities);
        setServerInfo(connection.serverInfo);
        setErrorMessage(connection.errorMessage);
      } else if (newStatus === "disconnected" || newStatus === "error") {
        setSessionId(undefined);
        setProtocolVersion(undefined);
        setCapabilities(undefined);
        setServerInfo(undefined);
        setErrorMessage(connection.errorMessage);
      }
    });

    // Set initial status
    setStatus(connection.status);
    if (connection.sessionId) {
      setSessionId(connection.sessionId);
    }
    setProtocolVersion(connection.protocolVersion);
    setCapabilities(connection.capabilities);
    setServerInfo(connection.serverInfo);
    setErrorMessage(connection.errorMessage);

    // Cleanup on unmount
    return () => {
      unsubStatus();
      connection.disconnect();
    };
  }, [url]);

  // Return a stable connection interface
  return {
    get status() {
      return status;
    },
    get sessionId() {
      return sessionId;
    },
    get protocolVersion() {
      return protocolVersion;
    },
    get capabilities() {
      return capabilities;
    },
    get serverInfo() {
      return serverInfo;
    },
    get errorMessage() {
      return errorMessage;
    },
    onEvent: (handler) => {
      if (connectionRef.current) {
        return connectionRef.current.onEvent(handler);
      }
      return () => {};
    },
    onStatusChange: (handler) => {
      if (connectionRef.current) {
        return connectionRef.current.onStatusChange(handler);
      }
      return () => {};
    },
    sendCommand: async (command) => {
      if (connectionRef.current) {
        return connectionRef.current.sendCommand(command);
      }
      return notConnectedResult(command.type);
    },
    disconnect: () => {
      if (connectionRef.current) {
        connectionRef.current.disconnect();
      }
    },
  };
}

export default useConnection;
