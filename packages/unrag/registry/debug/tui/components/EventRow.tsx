/**
 * Single event row component for list display.
 */

import React from "react";
import { Box, Text } from "ink";
import type { DebugEvent } from "@registry/core/debug-events";

type EventRowProps = {
  event: DebugEvent;
  selected?: boolean;
  compact?: boolean;
};

function getEventColor(type: string): string {
  if (type.startsWith("ingest")) return "green";
  if (type.startsWith("retrieve")) return "cyan";
  if (type.startsWith("rerank")) return "magenta";
  if (type.startsWith("delete")) return "yellow";
  if (type.includes("error")) return "red";
  return "white";
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getEventSummary(event: DebugEvent): string {
  switch (event.type) {
    case "ingest:start":
      return `sourceId=${event.sourceId} content=${event.contentLength}b`;
    case "ingest:chunking-complete":
      return `${event.chunkCount} chunks in ${event.durationMs.toFixed(0)}ms`;
    case "ingest:embedding-start":
      return `${event.chunkCount} chunks via ${event.embeddingProvider}`;
    case "ingest:embedding-batch":
      return `batch ${event.batchIndex + 1} (${event.batchSize}) in ${event.durationMs.toFixed(0)}ms`;
    case "ingest:embedding-complete":
      return `${event.totalEmbeddings} embeddings in ${event.durationMs.toFixed(0)}ms`;
    case "ingest:storage-complete":
      return `${event.chunksStored} chunks stored in ${event.durationMs.toFixed(0)}ms`;
    case "ingest:complete":
      return `${event.totalChunks} chunks in ${event.totalDurationMs.toFixed(0)}ms`;
    case "ingest:error":
      return event.error.slice(0, 50);

    case "retrieve:start":
      return `"${event.query.slice(0, 30)}..." topK=${event.topK}`;
    case "retrieve:embedding-complete":
      return `dim=${event.embeddingDimension} in ${event.durationMs.toFixed(0)}ms`;
    case "retrieve:database-complete":
      return `${event.resultsCount} results in ${event.durationMs.toFixed(0)}ms`;
    case "retrieve:complete":
      return `${event.resultsCount}/${event.topK} in ${event.totalDurationMs.toFixed(0)}ms`;

    case "rerank:start":
      return `${event.candidateCount} candidates via ${event.rerankerName}`;
    case "rerank:complete":
      return `${event.inputCount} -> ${event.outputCount} in ${event.totalMs.toFixed(0)}ms`;

    case "delete:start":
      return `${event.mode}: ${event.value}`;
    case "delete:complete":
      return `${event.mode}: ${event.value} in ${event.durationMs.toFixed(0)}ms`;

    default:
      return "";
  }
}

export function EventRow({ event, selected = false, compact = false }: EventRowProps) {
  const color = getEventColor(event.type);
  const time = formatTimestamp(event.timestamp);
  const summary = getEventSummary(event);

  if (compact) {
    return (
      <Box>
        <Text dimColor>{time}</Text>
        <Text> </Text>
        <Text color={color}>{event.type.padEnd(25)}</Text>
        <Text dimColor> {summary.slice(0, 40)}</Text>
      </Box>
    );
  }

  return (
    <Box
      paddingX={1}
      borderStyle={selected ? "single" : undefined}
      borderColor={selected ? "cyan" : undefined}
    >
      <Text dimColor>{time}</Text>
      <Text> </Text>
      <Text color={color} bold={selected}>
        {event.type.padEnd(28)}
      </Text>
      <Text> </Text>
      <Text dimColor={!selected}>{summary}</Text>
    </Box>
  );
}

export default EventRow;
