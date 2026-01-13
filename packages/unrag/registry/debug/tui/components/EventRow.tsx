/**
 * Single event row component for list display.
 */

import React from "react";
import { Box, Text } from "ink";
import type { DebugEvent } from "@registry/core/debug-events";
import { chars, eventTypeColor, eventTypeIcon, formatTime, truncate, theme, pad } from "../theme";

type EventRowProps = {
  event: DebugEvent;
  selected?: boolean;
  compact?: boolean;
};

function getEventSummary(event: DebugEvent): string {
  switch (event.type) {
    case "ingest:start":
      return `${event.sourceId} (${event.contentLength}b)`;
    case "ingest:chunking-complete":
      return `${event.chunkCount} chunks · ${event.durationMs.toFixed(0)}ms`;
    case "ingest:embedding-start":
      return `${event.chunkCount} chunks → ${event.embeddingProvider}`;
    case "ingest:embedding-batch":
      return `batch ${event.batchIndex + 1}/${event.batchSize} · ${event.durationMs.toFixed(0)}ms`;
    case "ingest:embedding-complete":
      return `${event.totalEmbeddings} embeddings · ${event.durationMs.toFixed(0)}ms`;
    case "ingest:storage-complete":
      return `${event.chunksStored} stored · ${event.durationMs.toFixed(0)}ms`;
    case "ingest:complete":
      return `${event.totalChunks} chunks · ${event.totalDurationMs.toFixed(0)}ms`;
    case "ingest:error":
      return truncate(event.error, 50);

    case "retrieve:start":
      return `"${truncate(event.query, 24)}" k=${event.topK}`;
    case "retrieve:embedding-complete":
      return `dim=${event.embeddingDimension} · ${event.durationMs.toFixed(0)}ms`;
    case "retrieve:database-complete":
      return `${event.resultsCount} results · ${event.durationMs.toFixed(0)}ms`;
    case "retrieve:complete":
      return `${event.resultsCount}/${event.topK} · ${event.totalDurationMs.toFixed(0)}ms`;

    case "rerank:start":
      return `${event.candidateCount} → ${event.rerankerName}`;
    case "rerank:complete":
      return `${event.inputCount}→${event.outputCount} · ${event.totalMs.toFixed(0)}ms`;

    case "delete:start":
      return `${event.mode}: ${event.value}`;
    case "delete:complete":
      return `${event.mode} · ${event.durationMs.toFixed(0)}ms`;

    default:
      return "";
  }
}

export function EventRow({ event, selected = false, compact = false }: EventRowProps) {
  const color = eventTypeColor(event.type);
  const icon = eventTypeIcon(event.type);
  const time = formatTime(event.timestamp);
  const summary = getEventSummary(event);
  
  // Extract just the action part (e.g., "complete" from "ingest:complete")
  const [category, action] = event.type.split(":");
  const shortType = `${category}:${action || ""}`;

  if (compact) {
    return (
      <Box>
        <Text color={theme.muted}>{time}</Text>
        <Text color={color} bold> {icon} </Text>
        <Text color={color}>{pad(shortType, 20)}</Text>
        <Text color={theme.muted}>{truncate(summary, 50)}</Text>
      </Box>
    );
  }

  // Full row with selection highlight
  if (selected) {
    return (
      <Box backgroundColor={theme.accent}>
        <Text color="black" bold>
          {chars.arrow} {time} {icon} {pad(shortType, 22)}{truncate(summary, 60)}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={theme.muted}>  {time}</Text>
      <Text color={color} bold> {icon} </Text>
      <Text color={theme.fg}>{pad(shortType, 22)}</Text>
      <Text color={theme.muted}>{truncate(summary, 60)}</Text>
    </Box>
  );
}

export default EventRow;
