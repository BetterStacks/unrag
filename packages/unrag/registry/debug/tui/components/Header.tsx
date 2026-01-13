/**
 * Header component displaying title, connection status, and session info.
 */

import React from "react";
import { Box, Text } from "ink";
import type { DebugConnectionStatus } from "../../types";
import { chars, statusColor, statusLabel, theme, truncate } from "../theme";

type HeaderProps = {
  title: string;
  status: DebugConnectionStatus;
  sessionId?: string;
};

export function Header({ title, status, sessionId }: HeaderProps) {
  const label = statusLabel(status);
  const color = statusColor(status);

  return (
    <Box paddingX={2} paddingY={0} justifyContent="space-between" backgroundColor={theme.headerBg}>
      {/* Left: branding */}
      <Box gap={1}>
        <Text color="white" bold>
          {chars.section} UNRAG DEBUG
        </Text>
      </Box>

      {/* Right: session + status */}
      <Box gap={2}>
        {sessionId && (
          <Text color="white" dimColor>
            {truncate(sessionId, 8)}
          </Text>
        )}
        <Box gap={1}>
          <Text color={color} bold>
            {chars.dot}
          </Text>
          <Text color="white">{label.toUpperCase()}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export default Header;
