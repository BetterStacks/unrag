/**
 * Dashboard component showing overview statistics and recent events.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { DebugEvent } from "@registry/core/debug-events";
import type { DebugConnection } from "../../types";
import { EventRow } from "./EventRow";
import { MetricCard } from "./MetricCard";
import { Sparkline } from "./Sparkline";
import { chars, hr, theme } from "../theme";

type DashboardProps = {
  events: DebugEvent[];
  connection: DebugConnection;
};

type Stats = {
  ingest: { count: number; lastMs?: number };
  retrieve: { count: number; lastMs?: number };
  rerank: { count: number; lastMs?: number };
  delete: { count: number; lastMs?: number };
  errors: number;
  latencyHistory: number[];
};

function computeStats(events: DebugEvent[]): Stats {
  const stats: Stats = {
    ingest: { count: 0 },
    retrieve: { count: 0 },
    rerank: { count: 0 },
    delete: { count: 0 },
    errors: 0,
    latencyHistory: [],
  };

  for (const event of events) {
    switch (event.type) {
      case "ingest:complete":
        stats.ingest.count++;
        stats.ingest.lastMs = event.totalDurationMs;
        stats.latencyHistory.push(event.totalDurationMs);
        break;
      case "retrieve:complete":
        stats.retrieve.count++;
        stats.retrieve.lastMs = event.totalDurationMs;
        stats.latencyHistory.push(event.totalDurationMs);
        break;
      case "rerank:complete":
        stats.rerank.count++;
        stats.rerank.lastMs = event.totalMs;
        stats.latencyHistory.push(event.totalMs);
        break;
      case "delete:complete":
        stats.delete.count++;
        stats.delete.lastMs = event.durationMs;
        stats.latencyHistory.push(event.durationMs);
        break;
      case "ingest:error":
        stats.errors++;
        break;
    }
  }

  // Keep only last 30 latency points
  stats.latencyHistory = stats.latencyHistory.slice(-30);

  return stats;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Box marginBottom={1}>
      <Text backgroundColor={theme.border} color={theme.fg} bold>
        {" "}{chars.section} {title.toUpperCase()}{" "}
      </Text>
    </Box>
  );
}

export function Dashboard({ events, connection }: DashboardProps) {
  const stats = useMemo(() => computeStats(events), [events]);
  const recentEvents = useMemo(() => events.slice(-10).reverse(), [events]);

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Stats row */}
      <Box flexDirection="column">
        <SectionHeader title="Operations" />
        <Box gap={3} paddingX={1} paddingY={1}>
          <MetricCard title="INGEST" count={stats.ingest.count} lastMs={stats.ingest.lastMs} color={theme.ingest} />
          <MetricCard title="RETRIEVE" count={stats.retrieve.count} lastMs={stats.retrieve.lastMs} color={theme.retrieve} />
          <MetricCard title="RERANK" count={stats.rerank.count} lastMs={stats.rerank.lastMs} color={theme.rerank} />
          <MetricCard title="DELETE" count={stats.delete.count} lastMs={stats.delete.lastMs} color={theme.delete} />
          {stats.errors > 0 && (
            <Box gap={1}>
              <Text backgroundColor={theme.error} color="white" bold>
                {" "}{chars.cross} {stats.errors} ERRORS{" "}
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Latency sparkline */}
      {stats.latencyHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <SectionHeader title="Latency" />
          <Box paddingX={1}>
            <Sparkline data={stats.latencyHistory} width={60} />
          </Box>
        </Box>
      )}

      {/* Recent events */}
      <Box flexDirection="column" marginTop={1}>
        <SectionHeader title="Recent Events" />
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.borderActive}
          paddingX={1}
          paddingY={0}
        >
          {recentEvents.length === 0 ? (
            <Text color={theme.muted}>
              Waiting for events…
            </Text>
          ) : (
            recentEvents.map((event, i) => (
              <EventRow key={`${event.timestamp}-${i}`} event={event} compact />
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default Dashboard;
