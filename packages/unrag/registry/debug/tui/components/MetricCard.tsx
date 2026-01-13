/**
 * Metric card component for displaying operation statistics.
 */

import React from "react";
import { Box, Text } from "ink";
import { chars, formatDuration, theme } from "../theme";

type MetricCardProps = {
  title: string;
  count: number;
  lastMs?: number;
  color: string;
};

export function MetricCard({ title, count, lastMs, color }: MetricCardProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={color}
      paddingX={1}
      minWidth={14}
    >
      <Text color={color} bold>{title}</Text>
      <Box gap={1}>
        <Text color={theme.fg} bold>{count}</Text>
        {lastMs !== undefined && (
          <Text color={theme.muted}>
            {formatDuration(lastMs)}
          </Text>
        )}
      </Box>
    </Box>
  );
}

export default MetricCard;
