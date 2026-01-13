/**
 * Status bar component showing hints and current state.
 */

import React from "react";
import { Box, Text } from "ink";
import type { DebugConnectionStatus } from "../../types";
import { chars, statusColor, theme } from "../theme";

type StatusBarProps = {
  hint: string;
  eventCount: number;
  status: DebugConnectionStatus;
};

export function StatusBar({ hint, eventCount, status }: StatusBarProps) {
  const color = statusColor(status);

  return (
    <Box
      paddingX={2}
      paddingY={0}
      justifyContent="space-between"
      borderStyle="single"
      borderColor={theme.border}
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      {/* Left: keyboard hints */}
      <Box gap={2}>
        <Text color={theme.muted}>{hint}</Text>
      </Box>

      {/* Right: stats */}
      <Box gap={3}>
        <Text color={theme.fg} bold>
          {eventCount}
        </Text>
        <Text color={theme.muted}>events</Text>
        <Text color={theme.muted}>{chars.v}</Text>
        <Box gap={1}>
          <Text color={color} bold>
            {chars.dot}
          </Text>
          <Text color={theme.fg}>ws://localhost:3847</Text>
        </Box>
      </Box>
    </Box>
  );
}

export default StatusBar;
