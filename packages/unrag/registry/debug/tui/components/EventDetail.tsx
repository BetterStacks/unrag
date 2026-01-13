/**
 * Event detail component showing full event information.
 */

import React from "react";
import { Box, Text } from "ink";
import type { DebugEvent } from "@registry/core/debug-events";

type EventDetailProps = {
  event: DebugEvent;
};

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value);
}

function KeyValue({ label, value }: { label: string; value: unknown }) {
  return (
    <Box>
      <Text dimColor>{label.padEnd(20)}</Text>
      <Text>{formatValue(value)}</Text>
    </Box>
  );
}

export function EventDetail({ event }: EventDetailProps) {
  const timestamp = new Date(event.timestamp).toLocaleString();

  // Common fields
  const commonFields = (
    <>
      <KeyValue label="Type" value={event.type} />
      <KeyValue label="Timestamp" value={timestamp} />
      <KeyValue label="Session ID" value={event.sessionId} />
    </>
  );

  // Event-specific fields
  const specificFields = (() => {
    switch (event.type) {
      case "ingest:start":
        return (
          <>
            <KeyValue label="Source ID" value={event.sourceId} />
            <KeyValue label="Document ID" value={event.documentId} />
            <KeyValue label="Content Length" value={`${event.contentLength} bytes`} />
            <KeyValue label="Asset Count" value={event.assetCount} />
          </>
        );

      case "ingest:chunking-complete":
        return (
          <>
            <KeyValue label="Source ID" value={event.sourceId} />
            <KeyValue label="Document ID" value={event.documentId} />
            <KeyValue label="Chunk Count" value={event.chunkCount} />
            <KeyValue label="Duration" value={`${event.durationMs.toFixed(2)}ms`} />
          </>
        );

      case "ingest:embedding-start":
        return (
          <>
            <KeyValue label="Source ID" value={event.sourceId} />
            <KeyValue label="Document ID" value={event.documentId} />
            <KeyValue label="Chunk Count" value={event.chunkCount} />
            <KeyValue label="Provider" value={event.embeddingProvider} />
          </>
        );

      case "ingest:embedding-batch":
        return (
          <>
            <KeyValue label="Source ID" value={event.sourceId} />
            <KeyValue label="Document ID" value={event.documentId} />
            <KeyValue label="Batch Index" value={event.batchIndex} />
            <KeyValue label="Batch Size" value={event.batchSize} />
            <KeyValue label="Duration" value={`${event.durationMs.toFixed(2)}ms`} />
          </>
        );

      case "ingest:embedding-complete":
        return (
          <>
            <KeyValue label="Source ID" value={event.sourceId} />
            <KeyValue label="Document ID" value={event.documentId} />
            <KeyValue label="Total Embeddings" value={event.totalEmbeddings} />
            <KeyValue label="Duration" value={`${event.durationMs.toFixed(2)}ms`} />
          </>
        );

      case "ingest:storage-complete":
        return (
          <>
            <KeyValue label="Source ID" value={event.sourceId} />
            <KeyValue label="Document ID" value={event.documentId} />
            <KeyValue label="Chunks Stored" value={event.chunksStored} />
            <KeyValue label="Duration" value={`${event.durationMs.toFixed(2)}ms`} />
          </>
        );

      case "ingest:complete":
        return (
          <>
            <KeyValue label="Source ID" value={event.sourceId} />
            <KeyValue label="Document ID" value={event.documentId} />
            <KeyValue label="Total Chunks" value={event.totalChunks} />
            <KeyValue label="Total Duration" value={`${event.totalDurationMs.toFixed(2)}ms`} />
            {event.warnings.length > 0 && (
              <KeyValue label="Warnings" value={event.warnings.join(", ")} />
            )}
          </>
        );

      case "ingest:error":
        return (
          <>
            <KeyValue label="Source ID" value={event.sourceId} />
            {event.documentId && <KeyValue label="Document ID" value={event.documentId} />}
            <Box flexDirection="column" marginTop={1}>
              <Text color="red" bold>
                Error:
              </Text>
              <Text color="red">{event.error}</Text>
            </Box>
          </>
        );

      case "retrieve:start":
        return (
          <>
            <KeyValue label="Query" value={event.query} />
            <KeyValue label="Top K" value={event.topK} />
            {event.scope && <KeyValue label="Scope" value={event.scope} />}
          </>
        );

      case "retrieve:embedding-complete":
        return (
          <>
            <KeyValue label="Query" value={event.query} />
            <KeyValue label="Provider" value={event.embeddingProvider} />
            <KeyValue label="Dimension" value={event.embeddingDimension} />
            <KeyValue label="Duration" value={`${event.durationMs.toFixed(2)}ms`} />
          </>
        );

      case "retrieve:database-complete":
        return (
          <>
            <KeyValue label="Query" value={event.query} />
            <KeyValue label="Results Count" value={event.resultsCount} />
            <KeyValue label="Duration" value={`${event.durationMs.toFixed(2)}ms`} />
          </>
        );

      case "retrieve:complete":
        return (
          <>
            <KeyValue label="Query" value={event.query} />
            <KeyValue label="Results" value={`${event.resultsCount}/${event.topK}`} />
            <KeyValue label="Total Duration" value={`${event.totalDurationMs.toFixed(2)}ms`} />
            <KeyValue label="Embedding Time" value={`${event.embeddingMs.toFixed(2)}ms`} />
            <KeyValue label="Retrieval Time" value={`${event.retrievalMs.toFixed(2)}ms`} />
          </>
        );

      case "rerank:start":
        return (
          <>
            <KeyValue label="Query" value={event.query} />
            <KeyValue label="Candidates" value={event.candidateCount} />
            <KeyValue label="Top K" value={event.topK} />
            <KeyValue label="Reranker" value={event.rerankerName} />
          </>
        );

      case "rerank:complete":
        return (
          <>
            <KeyValue label="Query" value={event.query} />
            <KeyValue label="Input Count" value={event.inputCount} />
            <KeyValue label="Output Count" value={event.outputCount} />
            <KeyValue label="Reranker" value={event.rerankerName} />
            {event.model && <KeyValue label="Model" value={event.model} />}
            <KeyValue label="Rerank Time" value={`${event.rerankMs.toFixed(2)}ms`} />
            <KeyValue label="Total Time" value={`${event.totalMs.toFixed(2)}ms`} />
          </>
        );

      case "delete:start":
        return (
          <>
            <KeyValue label="Mode" value={event.mode} />
            <KeyValue label="Value" value={event.value} />
          </>
        );

      case "delete:complete":
        return (
          <>
            <KeyValue label="Mode" value={event.mode} />
            <KeyValue label="Value" value={event.value} />
            <KeyValue label="Duration" value={`${event.durationMs.toFixed(2)}ms`} />
          </>
        );

      default:
        return null;
    }
  })();

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={1}
    >
      <Text bold color="cyan">
        Event Details
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {commonFields}
        <Box marginY={1}>
          <Text dimColor>{"─".repeat(40)}</Text>
        </Box>
        {specificFields}
      </Box>
    </Box>
  );
}

export default EventDetail;
