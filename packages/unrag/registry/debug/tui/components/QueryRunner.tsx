/**
 * Query Runner tab: execute a retrieve command and inspect results.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { DebugConnection, DebugCommandResult } from "@registry/debug/types";
import { chars, clamp, formatDuration, theme, truncate } from "@registry/debug/tui/theme";
import { useTerminalSize } from "@registry/debug/tui/hooks/useTerminalSize";
import { useScrollWindow } from "@registry/debug/tui/hooks/useScrollWindow";
import { ScrollableText } from "@registry/debug/tui/components/ScrollableText";
import { useHotkeysLock } from "@registry/debug/tui/context/HotkeysLock";

type QueryRunnerProps = {
  connection: DebugConnection;
};

type Mode = "idle" | "editing" | "running" | "done" | "error";

function canQuery(connection: DebugConnection): boolean {
  return Array.isArray(connection.capabilities) && connection.capabilities.includes("query");
}

export function QueryRunner({ connection }: QueryRunnerProps) {
  const { columns, rows } = useTerminalSize();
  const [mode, setMode] = useState<Mode>("idle");
  useHotkeysLock(mode === "editing");
  const [query, setQuery] = useState("how does unrag ingest work?");
  const [scope, setScope] = useState("");
  const [topK, setTopK] = useState(8);
  const [result, setResult] = useState<DebugCommandResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contentScrollTop, setContentScrollTop] = useState(0);
  const canSplit = columns >= 120;
  const resultsPanelWidth = canSplit ? Math.floor(columns * 0.55) : columns;
  const resultsInnerWidth = Math.max(24, resultsPanelWidth - 6); // borders+padding
  const detailsPanelWidth = canSplit ? Math.floor(columns * 0.45) : columns;
  const detailsInnerWidth = Math.max(24, detailsPanelWidth - 6);

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
  const listViewportRows = Math.max(6, Math.min(28, rows - (canSplit ? 16 : 18)));
  const scroll = useScrollWindow({
    itemCount: chunks.length,
    selectedIndex: boundedIndex,
    viewportRows: listViewportRows,
    resetKey: `${chunks.length}:${topK}`,
  });

  useEffect(() => {
    // keep selection in bounds when result changes
    setSelectedIndex(0);
  }, [chunks.length]);
  useEffect(() => {
    setContentScrollTop(0);
  }, [selected?.id]);

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

    if (mode === "editing") {
      // Inline editor: type freely; Esc / Ctrl+X exits.
      if (key.escape || (key.ctrl && input === "x")) {
        setMode("idle");
        return;
      }
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

    if (input === "e") {
      setMode("editing");
      return;
    }
    if (input === "r") {
      void run();
      return;
    }

    // Scroll details content (like less)
    if (key.pageUp || (key.ctrl && input === "u")) {
      setContentScrollTop((t) => Math.max(0, t - 8));
      return;
    }
    if (key.pageDown || (key.ctrl && input === "d")) {
      setContentScrollTop((t) => t + 8);
      return;
    }
    if (key.home) {
      setContentScrollTop(0);
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
            <Text color={theme.muted}>
              {mode === "editing"
                ? "editing: type · esc/^x exit · ⏎ apply"
                : "r run · e edit · +/- topK · j/k navigate"}
            </Text>
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
          <Box marginBottom={1} justifyContent="space-between">
            <Box gap={1}>
              <Text backgroundColor={theme.border} color={theme.fg}>
                {" "}RESULTS{" "}
              </Text>
              {chunks.length > 0 && (
                <Text color={theme.muted}>
                  {scroll.windowStart + 1}-{scroll.windowEnd} of {chunks.length}
                </Text>
              )}
            </Box>
            {durations && (
              <Text color={theme.muted}>
                {truncate(
                  `total ${formatDuration(durations.totalMs)} · embed ${formatDuration(durations.embeddingMs)} · db ${formatDuration(durations.retrievalMs)}`,
                  Math.max(18, resultsInnerWidth - 24)
                )}
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

          {chunks.slice(scroll.windowStart, scroll.windowEnd).map((c, idx) => {
            const i = scroll.windowStart + idx;
            const isSel = i === boundedIndex;

            const scoreW = 7; // "0.6684"
            const docW = 10;
            let contentW = clamp(Math.floor(resultsInnerWidth * 0.46), 22, canSplit ? 80 : 44);
            let sourceW = resultsInnerWidth - (2 + scoreW + docW + contentW + 4);
            if (sourceW < 16) {
              const deficit = 16 - sourceW;
              contentW = Math.max(16, contentW - deficit);
              sourceW = resultsInnerWidth - (2 + scoreW + docW + contentW + 4);
            }

            const content = String(c.content ?? "").replace(/\s+/g, " ").trim();

            return (
              <Box key={`${c.id}-${i}`} gap={1}>
                <Box width={2}>
                  <Text color={isSel ? theme.accent : theme.muted} bold={isSel}>
                    {isSel ? chars.pointer : " "}
                  </Text>
                </Box>
                <Box width={scoreW}>
                  <Text color={theme.muted}>{c.score.toFixed(4).padStart(scoreW)}</Text>
                </Box>
                <Box width={Math.max(16, sourceW)} flexShrink={0}>
                  <Text color={theme.fg} bold={isSel}>
                    {truncate(c.sourceId, Math.max(16, sourceW))}
                  </Text>
                </Box>
                <Box width={docW} flexShrink={0}>
                  <Text color={theme.muted}>{truncate(c.documentId, docW)}</Text>
                </Box>
                <Box width={Math.max(16, contentW)} flexShrink={0}>
                  <Text color={theme.fg}>{truncate(content, Math.max(16, contentW))}</Text>
                </Box>
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
                <ScrollableText
                  text={selected.content}
                  width={detailsInnerWidth - 2}
                  // Keep conservative: details pane also contains metadata rows above.
                  height={clamp(rows - (canSplit ? 26 : 28), 4, 14)}
                  scrollTop={contentScrollTop}
                  borderColor={theme.border}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default QueryRunner;

