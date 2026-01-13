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

export function Dashboard({ events, connection }: DashboardProps) {
  const stats = useMemo(() => computeStats(events), [events]);
  const recentEvents = useMemo(() => events.slice(-8).reverse(), [events]);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Connection Info */}
      <Box borderStyle="round" borderColor="blue" paddingX={1} flexDirection="column">
        <Text bold color="blue">
          Connection
        </Text>
        <Box gap={4} marginTop={1}>
          <Text>
            Status:{" "}
            <Text color={connection.status === "connected" ? "green" : "yellow"}>
              {connection.status}
            </Text>
          </Text>
          {connection.sessionId && (
            <Text dimColor>Session: {connection.sessionId.slice(0, 8)}...</Text>
          )}
        </Box>
      </Box>

      {/* Metrics Grid */}
      <Box gap={2}>
        <MetricCard
          title="Ingest"
          count={stats.ingest.count}
          lastMs={stats.ingest.lastMs}
          color="green"
        />
        <MetricCard
          title="Retrieve"
          count={stats.retrieve.count}
          lastMs={stats.retrieve.lastMs}
          color="cyan"
        />
        <MetricCard
          title="Rerank"
          count={stats.rerank.count}
          lastMs={stats.rerank.lastMs}
          color="magenta"
        />
        <MetricCard
          title="Delete"
          count={stats.delete.count}
          lastMs={stats.delete.lastMs}
          color="yellow"
        />
      </Box>

      {/* Errors */}
      {stats.errors > 0 && (
        <Box>
          <Text color="red">Errors: {stats.errors}</Text>
        </Box>
      )}

      {/* Latency Chart */}
      {stats.latencyHistory.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Latency (last 30 ops)</Text>
          <Sparkline data={stats.latencyHistory} width={50} />
        </Box>
      )}

      {/* Recent Events */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Recent Events</Text>
        {recentEvents.length === 0 ? (
          <Text dimColor>No events yet. Waiting for activity...</Text>
        ) : (
          <Box flexDirection="column">
            {recentEvents.map((event, i) => (
              <EventRow key={`${event.timestamp}-${i}`} event={event} compact />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default Dashboard;
