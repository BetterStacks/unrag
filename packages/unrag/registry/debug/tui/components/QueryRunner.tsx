/**
 * Query Runner tab: execute a retrieve command and inspect results.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { DebugConnection, DebugCommandResult } from "@registry/debug/types";
import { chars, formatDuration, theme, truncate } from "@registry/debug/tui/theme";
import { useTerminalSize } from "@registry/debug/tui/hooks/useTerminalSize";

type QueryRunnerProps = {
  connection: DebugConnection;
};

type Mode = "idle" | "editing" | "running" | "done" | "error";

function canQuery(connection: DebugConnection): boolean {
  return Array.isArray(connection.capabilities) && connection.capabilities.includes("query");
}

export function QueryRunner({ connection }: QueryRunnerProps) {
  const { columns } = useTerminalSize();
  const [mode, setMode] = useState<Mode>("idle");
  const [query, setQuery] = useState("how does unrag ingest work?");
  const [scope, setScope] = useState("");
  const [topK, setTopK] = useState(8);
  const [result, setResult] = useState<DebugCommandResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const canSplit = columns >= 120;

  const queryCapable = canQuery(connection);

  const chunks = useMemo(() => {
    if (result?.type !== "query" || !result.success) return [];
    return result.chunks ?? [];
  }, [result]);

  const durations = useMemo(() => {
    if (result?.type !== "query" || !result.success) return undefined;
    return result.durations;
  }, [result]);

  const maxIndex = Math.max(0, chunks.length - 1);
  const boundedIndex = Math.min(selectedIndex, maxIndex);
  const selected = chunks[boundedIndex];

  useEffect(() => {
    // keep selection in bounds when result changes
    setSelectedIndex(0);
  }, [chunks.length]);

  const run = async () => {
    setMode("running");
    setResult(null);
    try {
      const res = await connection.sendCommand({
        type: "query",
        query,
        topK,
        ...(scope.trim() ? { scope: scope.trim() } : {}),
      });
      setResult(res);
      setMode(res.success ? "done" : "error");
    } catch (err) {
      setResult({
        type: "query",
        success: false,
        error: err instanceof Error ? err.message : String(err),
      } as DebugCommandResult);
      setMode("error");
    }
  };

  useInput((input, key) => {
    if (!queryCapable) return;

    if (input === "e") {
      setMode((m) => (m === "editing" ? "idle" : "editing"));
      return;
    }
    if (input === "r") {
      void run();
      return;
    }
    if (mode === "editing") {
      // Minimal inline editor: type to append, backspace deletes, enter exits.
      if (key.return) {
        setMode("idle");
        return;
      }
      if (key.backspace || key.delete) {
        setQuery((q) => q.slice(0, -1));
        return;
      }
      if (input && input.length === 1 && !key.ctrl && !key.meta) {
        setQuery((q) => q + input);
        return;
      }
      return;
    }

    if (input === "+") setTopK((k) => Math.min(50, k + 1));
    if (input === "-") setTopK((k) => Math.max(1, k - 1));

    if (key.upArrow || input === "k") setSelectedIndex((p) => Math.max(0, p - 1));
    if (key.downArrow || input === "j") setSelectedIndex((p) => Math.min(maxIndex, p + 1));
  });

  return (
    <Box flexDirection="column" flexGrow={1} paddingY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Box gap={1}>
          <Text backgroundColor={theme.border} color={theme.fg}>
            {" "}QUERY{" "}
          </Text>
          {queryCapable ? (
            <Text color={theme.muted}>r run · e edit · +/- topK · j/k navigate</Text>
          ) : (
            <Text color={theme.warning}>
              {chars.cross} Server does not advertise query capability. Register engine with{" "}
              <Text bold color={theme.fg}>
                {"`registerUnragDebug({ engine })`"}
              </Text>
              .
            </Text>
          )}
        </Box>
        <Text color={theme.muted}>topK {topK}</Text>
      </Box>

      {/* Input panel */}
      <Box borderStyle="round" borderColor={theme.borderActive} paddingX={1} paddingY={0} marginBottom={1}>
        <Box flexDirection="column">
          <Box gap={1}>
            <Text color={theme.muted}>query</Text>
            <Text color={mode === "editing" ? theme.accent : theme.fg} bold={mode === "editing"}>
              {query || " "}
            </Text>
            {mode === "editing" && <Text color={theme.muted}>▌</Text>}
          </Box>
          <Box gap={1}>
            <Text color={theme.muted}>scope</Text>
            <Text color={theme.fg}>{scope.trim() ? scope.trim() : "—"}</Text>
            <Text color={theme.muted}>(set in code later)</Text>
          </Box>
        </Box>
      </Box>

      {/* Results */}
      <Box flexDirection={canSplit ? "row" : "column"} flexGrow={1} gap={2}>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.borderActive}
          paddingX={1}
          flexGrow={1}
          width={canSplit ? Math.floor(columns * 0.55) : undefined}
        >
          <Box marginBottom={1} gap={1}>
            <Text backgroundColor={theme.border} color={theme.fg}>
              {" "}RESULTS{" "}
            </Text>
            {durations && (
              <Text color={theme.muted}>
                total {formatDuration(durations.totalMs)} · embed {formatDuration(durations.embeddingMs)} · db{" "}
                {formatDuration(durations.retrievalMs)}
              </Text>
            )}
          </Box>

          {mode === "running" && <Text color={theme.muted}>Running…</Text>}

          {result?.type === "query" && !result.success && (
            <Text color={theme.error} bold>
              {chars.cross} {result.error ?? "Query failed"}
            </Text>
          )}

          {chunks.length === 0 && mode !== "running" && (!result || (result.type === "query" && result.success)) && (
            <Text color={theme.muted}>No results yet. Press r to run.</Text>
          )}

          {chunks.slice(0, 30).map((c, i) => {
            const isSel = i === boundedIndex;
            return (
              <Box key={`${c.id}-${i}`} gap={1}>
                <Text color={isSel ? theme.accent : theme.muted} bold={isSel}>
                  {isSel ? chars.pointer : " "}
                </Text>
                <Text color={theme.muted}>{c.score.toFixed(4)}</Text>
                <Text color={theme.fg} bold={isSel}>
                  {truncate(c.sourceId, 28)}
                </Text>
                <Text color={theme.muted}>·</Text>
                <Text color={theme.muted}>{truncate(c.documentId, 10)}</Text>
                <Text color={theme.fg}>{truncate(c.content ?? "", canSplit ? 60 : 36)}</Text>
              </Box>
            );
          })}
        </Box>

        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.border}
          paddingX={1}
          flexGrow={1}
          width={canSplit ? Math.floor(columns * 0.45) : undefined}
        >
          <Box marginBottom={1} gap={1}>
            <Text backgroundColor={theme.accent} color="black" bold>
              {" "}DETAILS{" "}
            </Text>
            <Text color={theme.muted}>{selected ? truncate(selected.id, 14) : "—"}</Text>
          </Box>

          {!selected ? (
            <Text color={theme.muted}>Select a result to inspect.</Text>
          ) : (
            <Box flexDirection="column" gap={1}>
              <Box gap={1}>
                <Text color={theme.muted}>source</Text>
                <Text color={theme.fg} bold>{selected.sourceId}</Text>
              </Box>
              <Box gap={1}>
                <Text color={theme.muted}>doc</Text>
                <Text color={theme.fg}>{selected.documentId}</Text>
              </Box>
              <Box gap={1}>
                <Text color={theme.muted}>score</Text>
                <Text color={theme.fg} bold>{selected.score.toFixed(6)}</Text>
              </Box>
              <Box flexDirection="column">
                <Text color={theme.muted}>content</Text>
                <Text color={theme.fg}>{selected.content || "—"}</Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default QueryRunner;

