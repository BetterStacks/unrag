/**
 * Header component displaying title, connection status, and session info.
 */

import React from "react";
import { Box, Text } from "ink";
import type { DebugConnectionStatus } from "../../types";

type HeaderProps = {
  title: string;
  status: DebugConnectionStatus;
  sessionId?: string;
};

function getStatusDisplay(status: DebugConnectionStatus): {
  text: string;
  color: string;
} {
  switch (status) {
    case "connected":
      return { text: "Connected", color: "green" };
    case "connecting":
      return { text: "Connecting...", color: "yellow" };
    case "reconnecting":
      return { text: "Reconnecting...", color: "yellow" };
    case "disconnected":
      return { text: "Disconnected", color: "red" };
    case "error":
      return { text: "Error", color: "red" };
  }
}

export function Header({ title, status, sessionId }: HeaderProps) {
  const statusDisplay = getStatusDisplay(status);

  return (
    <Box
      borderStyle="single"
      borderColor="blue"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text bold color="blue">
          {title}
        </Text>
      </Box>

      <Box gap={2}>
        {sessionId && (
          <Text dimColor>
            Session: {sessionId.slice(0, 8)}...
          </Text>
        )}
        <Text>
          Status:{" "}
          <Text color={statusDisplay.color}>{statusDisplay.text}</Text>
        </Text>
      </Box>
    </Box>
  );
}

export default Header;
