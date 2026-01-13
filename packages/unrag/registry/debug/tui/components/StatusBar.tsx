/**
 * Status bar component showing hints and current state.
 */

import React from "react";
import { Box, Text } from "ink";
import type { DebugConnectionStatus } from "../../types";

type StatusBarProps = {
  hint: string;
  eventCount: number;
  status: DebugConnectionStatus;
};

export function StatusBar({ hint, eventCount, status }: StatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text dimColor>{hint}</Text>

      <Box gap={2}>
        <Text dimColor>Events: {eventCount}</Text>
        <Text dimColor>
          {status === "connected" ? "Live" : status}
        </Text>
      </Box>
    </Box>
  );
}

export default StatusBar;
