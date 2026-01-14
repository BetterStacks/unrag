/**
 * Eval tab: run an eval dataset and view a compact summary.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { DebugConnection, DebugCommandResult } from "@registry/debug/types";
import { chars, formatDuration, theme, truncate } from "@registry/debug/tui/theme";
import { useTerminalSize } from "@registry/debug/tui/hooks/useTerminalSize";
import { Sparkline } from "@registry/debug/tui/components/Sparkline";
import { useHotkeysLock } from "@registry/debug/tui/context/HotkeysLock";

type EvalProps = {
  connection: DebugConnection;
};

type Mode = "idle" | "editingDataset" | "running";

function canEval(connection: DebugConnection): boolean {
  return Array.isArray(connection.capabilities) && connection.capabilities.includes("eval");
}

function canQuery(connection: DebugConnection): boolean {
  return Array.isArray(connection.capabilities) && connection.capabilities.includes("query");
}

function fmt(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

export function Eval({ connection }: EvalProps) {
  const { columns } = useTerminalSize();
  const canSplit = columns >= 120;
  const evalCapable = canEval(connection);
  const queryCapable = canQuery(connection);

  const [mode, setMode] = useState<Mode>("idle");
  useHotkeysLock(mode === "editingDataset");
  const [datasetPath, setDatasetPath] = useState(".unrag/eval/datasets/sample.json");
  const [runMode, setRunMode] = useState<"auto" | "retrieve" | "retrieve+rerank">("auto");
  const [topK, setTopK] = useState<number | undefined>(undefined);
  const [includeNdcg, setIncludeNdcg] = useState(false);
  const [res, setRes] = useState<DebugCommandResult | null>(null);

  const run = async () => {
    setMode("running");
    setRes(null);
    try {
      const r = await connection.sendCommand({
        type: "run-eval",
        datasetPath,
        ...(runMode === "auto" ? {} : { mode: runMode }),
        ...(typeof topK === "number" ? { topK } : {}),
        ...(includeNdcg ? { includeNdcg: true } : {}),
        // Guardrails: keep dangerous flags off in the TUI for now.
        allowAssets: false,
        allowNonEvalPrefix: false,
        confirmedDangerousDelete: false,
      });
      setRes(r);
    } finally {
      setMode("idle");
    }
  };

  useEffect(() => {
    if (connection.status !== "connected") return;
    // no auto-run (avoid accidental deletes/ingest)
  }, [connection.status]);

  useInput((input, key) => {
    // While editing, swallow all shortcuts so typing is safe.
    if (mode === "editingDataset") {
      if (key.escape || (key.ctrl && input === "x")) {
        setMode("idle");
        return;
      }
      if (key.return) {
        setMode("idle");
        return;
      }
      if (key.backspace || key.delete) {
        setDatasetPath((p) => p.slice(0, -1));
        return;
      }
      if (input && input.length === 1 && !key.ctrl && !key.meta) {
        setDatasetPath((p) => p + input);
        return;
      }
      return;
    }

    if (!evalCapable) return;

    if (input === "e") {
      setMode("editingDataset");
      return;
    }
    if (input === "r") {
      void run();
      return;
    }
    if (input === "m") {
      setRunMode((m) => (m === "auto" ? "retrieve" : m === "retrieve" ? "retrieve+rerank" : "auto"));
      return;
    }
    if (input === "n") {
      setIncludeNdcg((v) => !v);
      return;
    }
    if (input === "+") {
      setTopK((k) => (typeof k === "number" ? Math.min(50, k + 1) : 10));
      return;
    }
    if (input === "-") {
      setTopK((k) => (typeof k === "number" ? Math.max(1, k - 1) : 10));
      return;
    }
  });

  const out = useMemo(() => (res?.type === "run-eval" ? res : undefined), [res]);
  const summary = out?.success ? out.summary : undefined;

  return (
    <Box flexDirection="column" flexGrow={1} paddingY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Box gap={1}>
          <Text backgroundColor={theme.border} color={theme.fg}>
            {" "}EVAL{" "}
          </Text>
          <Text color={theme.muted}>
            {mode === "editingDataset"
              ? "editing: type · esc/^x exit · ⏎ apply"
              : "r run · e edit dataset · m mode · +/- topK · n nDCG"}
          </Text>
        </Box>
        <Text color={theme.muted}>
          mode <Text color={theme.fg} bold>{runMode}</Text> · topK{" "}
          <Text color={theme.fg} bold>{typeof topK === "number" ? topK : "auto"}</Text>
          · ndcg <Text color={theme.fg} bold>{String(includeNdcg)}</Text>
        </Text>
      </Box>

      {!evalCapable ? (
        <Box borderStyle="round" borderColor={theme.borderActive} paddingX={1} paddingY={1}>
          <Text color={theme.warning}>
            {chars.cross}{" "}
            {connection.status !== "connected"
              ? "Not connected to server yet."
              : queryCapable
                ? "Eval module isn't installed in your Unrag."
                : "Engine isn't registered for debug commands yet."}
          </Text>
          {connection.status === "connected" && queryCapable && (
            <Text color={theme.muted}>
              {chars.arrow} Install:{" "}
              <Text bold color={theme.fg}>
                {"`unrag add battery eval`"}
              </Text>{" "}
              then restart the app.
            </Text>
          )}
          {connection.status === "connected" && !queryCapable && (
            <Text color={theme.muted}>
              {chars.arrow} Ensure you’re on the latest debug battery (engine auto-registers when UNRAG_DEBUG=true), or call{" "}
              <Text bold color={theme.fg}>
                {"`registerUnragDebug({ engine })`"}
              </Text>
              .
            </Text>
          )}
        </Box>
      ) : (
        <>
          <Box borderStyle="round" borderColor={theme.borderActive} paddingX={1} marginBottom={1}>
            <Box gap={1}>
              <Text color={theme.muted}>dataset</Text>
              <Text color={mode === "editingDataset" ? theme.accent : theme.fg} bold={mode === "editingDataset"}>
                {datasetPath || " "}
              </Text>
              {mode === "editingDataset" && <Text color={theme.muted}>▌</Text>}
            </Box>
          </Box>

          <Box flexDirection={canSplit ? "row" : "column"} flexGrow={1} gap={2}>
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor={theme.borderActive}
              paddingX={1}
              flexGrow={1}
              width={canSplit ? Math.floor(columns * 0.6) : undefined}
            >
              <Box justifyContent="space-between" marginBottom={1}>
                <Text backgroundColor={theme.border} color={theme.fg}>
                  {" "}SUMMARY{" "}
                </Text>
                {mode === "running" ? (
                  <Text color={theme.muted}>Running…</Text>
                ) : (
                  <Text color={theme.muted}>Press r to run</Text>
                )}
              </Box>

              {out && out.type === "run-eval" && !out.success && (
                <Text color={theme.error} bold>
                  {chars.cross} {out.error ?? "Eval failed"}
                </Text>
              )}

              {!summary ? (
                <Text color={theme.muted}>No results yet.</Text>
              ) : (
                <Box flexDirection="column" gap={1}>
                  <Box gap={1} flexWrap="wrap">
                    <Text color={summary.passed ? theme.ok : theme.error} bold>
                      {summary.passed ? `${chars.check} PASSED` : `${chars.cross} FAILED`}
                    </Text>
                    <Text color={theme.muted}>dataset</Text>
                    <Text color={theme.fg} bold>{summary.datasetId}</Text>
                    <Text color={theme.muted}>·</Text>
                    <Text color={theme.muted}>mode</Text>
                    <Text color={theme.fg} bold>{summary.config.mode}</Text>
                    <Text color={theme.muted}>·</Text>
                    <Text color={theme.muted}>topK</Text>
                    <Text color={theme.fg} bold>{summary.config.topK}</Text>
                  </Box>

                  <Box gap={1} flexWrap="wrap">
                    <Text color={theme.muted}>scope</Text>
                    <Text color={theme.fg}>{truncate(summary.config.scopePrefix, 50)}</Text>
                    <Text color={theme.muted}>·</Text>
                    <Text color={theme.muted}>created</Text>
                    <Text color={theme.fg}>{truncate(summary.createdAt, 19)}</Text>
                  </Box>

                  <Box gap={1} flexWrap="wrap">
                    <Text color={theme.muted}>embedding</Text>
                    <Text color={theme.fg} bold>{summary.engine.embeddingModel ?? "—"}</Text>
                    <Text color={theme.muted}>·</Text>
                    <Text color={theme.muted}>reranker</Text>
                    <Text color={theme.fg} bold>{summary.engine.rerankerName ?? "none"}</Text>
                  </Box>

                  <Box flexDirection="column">
                    <Text color={theme.muted}>retrieved (mean)</Text>
                    <Text color={theme.fg}>
                      recall {fmt(summary.aggregates.retrieved.mean.recallAtK)} · mrr {fmt(summary.aggregates.retrieved.mean.mrrAtK)} · hit{" "}
                      {fmt(summary.aggregates.retrieved.mean.hitAtK)}
                    </Text>
                    {summary.config.mode === "retrieve+rerank" && summary.aggregates.reranked && (
                      <>
                        <Text color={theme.muted}>reranked (mean)</Text>
                        <Text color={theme.fg}>
                          recall {fmt(summary.aggregates.reranked.mean.recallAtK)} · mrr {fmt(summary.aggregates.reranked.mean.mrrAtK)} · hit{" "}
                          {fmt(summary.aggregates.reranked.mean.hitAtK)}
                        </Text>
                      </>
                    )}
                  </Box>

                  <Box flexDirection="column">
                    <Text color={theme.muted}>timings p50/p95</Text>
                    <Text color={theme.fg}>
                      total {formatDuration(summary.timings.totalMs.p50)}/{formatDuration(summary.timings.totalMs.p95)} · retrieve{" "}
                      {formatDuration(summary.timings.retrieveTotalMs.p50)}/{formatDuration(summary.timings.retrieveTotalMs.p95)}
                      {summary.timings.rerankTotalMs
                        ? ` · rerank ${formatDuration(summary.timings.rerankTotalMs.p50)}/${formatDuration(summary.timings.rerankTotalMs.p95)}`
                        : ""}
                    </Text>
                  </Box>

                  {Array.isArray(summary.thresholdFailures) && summary.thresholdFailures.length > 0 && (
                    <Box flexDirection="column">
                      <Text color={theme.warning} bold>
                        {chars.cross} threshold failures
                      </Text>
                      {summary.thresholdFailures.slice(0, 6).map((f, i) => (
                        <Text key={`${i}-${f}`} color={theme.muted}>
                          {chars.arrow} {truncate(f, 92)}
                        </Text>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor={theme.border}
              paddingX={1}
              flexGrow={1}
              width={canSplit ? Math.floor(columns * 0.4) : undefined}
            >
              <Box marginBottom={1} gap={1}>
                <Text backgroundColor={theme.accent} color="black" bold>
                  {" "}CHARTS{" "}
                </Text>
                <Text color={theme.muted}>per-query</Text>
              </Box>

              {!summary?.charts ? (
                <Text color={theme.muted}>Run an eval to see charts.</Text>
              ) : (
                <Box flexDirection="column" gap={1}>
                  <Box flexDirection="column">
                    <Text color={theme.muted}>retrieved recall@k</Text>
                    <Sparkline
                      data={summary.charts.retrievedRecall}
                      width={Math.min(30, Math.max(16, Math.floor(columns / 6)))}
                      color={theme.accent}
                      showMinMax={false}
                      format={(v) => v.toFixed(2)}
                    />
                  </Box>
                  <Box flexDirection="column">
                    <Text color={theme.muted}>retrieved mrr@k</Text>
                    <Sparkline
                      data={summary.charts.retrievedMrr}
                      width={Math.min(30, Math.max(16, Math.floor(columns / 6)))}
                      color={theme.accent}
                      showMinMax={false}
                      format={(v) => v.toFixed(2)}
                    />
                  </Box>
                  {summary.config.mode === "retrieve+rerank" && summary.charts.rerankedRecall && summary.charts.rerankedMrr && (
                    <>
                      <Box flexDirection="column">
                        <Text color={theme.muted}>reranked recall@k</Text>
                        <Sparkline
                          data={summary.charts.rerankedRecall}
                          width={Math.min(30, Math.max(16, Math.floor(columns / 6)))}
                          color={theme.accent}
                          showMinMax={false}
                          format={(v) => v.toFixed(2)}
                        />
                      </Box>
                      <Box flexDirection="column">
                        <Text color={theme.muted}>reranked mrr@k</Text>
                        <Sparkline
                          data={summary.charts.rerankedMrr}
                          width={Math.min(30, Math.max(16, Math.floor(columns / 6)))}
                          color={theme.accent}
                          showMinMax={false}
                          format={(v) => v.toFixed(2)}
                        />
                      </Box>
                    </>
                  )}

                  {Array.isArray(summary.worst) && summary.worst.length > 0 && (
                    <Box flexDirection="column">
                      <Text color={theme.muted}>worst queries</Text>
                      {summary.worst.slice(0, 6).map((w) => (
                        <Text key={w.id} color={theme.fg}>
                          <Text color={theme.muted}>{truncate(w.id, 18)}</Text>{" "}
                          <Text color={theme.muted}>rec</Text> {fmt(w.recallAtK)}{" "}
                          <Text color={theme.muted}>mrr</Text> {fmt(w.mrrAtK)}
                        </Text>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

export default Eval;

