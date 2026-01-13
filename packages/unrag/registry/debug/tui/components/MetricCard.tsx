/**
 * Metric card component for displaying operation statistics.
 */

import React from "react";
import { Box, Text } from "ink";

type MetricCardProps = {
  title: string;
  count: number;
  lastMs?: number;
  color: string;
};

export function MetricCard({ title, count, lastMs, color }: MetricCardProps) {
  return (
    <Box
      borderStyle="single"
      borderColor={color}
      paddingX={1}
      flexDirection="column"
      minWidth={16}
    >
      <Text bold color={color}>
        {title}
      </Text>
      <Text>
        Count: <Text bold>{count}</Text>
      </Text>
      {lastMs !== undefined && (
        <Text dimColor>Last: {lastMs.toFixed(0)}ms</Text>
      )}
    </Box>
  );
}

export default MetricCard;
