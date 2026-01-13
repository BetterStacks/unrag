/**
 * Header component displaying title, connection status, and session info.
 */

import React from "react";
import { Box, Text } from "ink";
import type { DebugConnectionStatus } from "../../types";
import { chars, statusColor, statusLabel, theme, truncate } from "../theme";
import { Logo } from "./Logo";

type HeaderProps = {
  title: string;
  status: DebugConnectionStatus;
  sessionId?: string;
  columns: number;
  rows: number;
};

export function Header({ title, status, sessionId, columns, rows }: HeaderProps) {
  const label = statusLabel(status);
  const color = statusColor(status);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {/* ASCII logo (responsive downsample) */}
      <Logo columns={columns} rows={rows} />

      {/* Status strip */}
      <Box
        marginTop={1}
        width="100%"
        backgroundColor={theme.accentBg}
        paddingX={1}
        justifyContent="space-between"
      >
        <Text color="black" bold>
          {title.toUpperCase()}
        </Text>

        <Box gap={2}>
          {sessionId && (
            <Text color="black">
              session {truncate(sessionId, 8)}
            </Text>
          )}
          <Box backgroundColor={color} paddingX={1}>
            <Text color="black" bold>
              {chars.dot} {label.toUpperCase()}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default Header;
