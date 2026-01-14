/**
 * Docs Explorer tab: browse stored documents and inspect chunks.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { DebugConnection, DebugCommandResult } from "@registry/debug/types";
import { chars, clamp, theme, truncate } from "@registry/debug/tui/theme";
import { useTerminalSize } from "@registry/debug/tui/hooks/useTerminalSize";

type DocsProps = {
  connection: DebugConnection;
};

type Mode = "idle" | "editingPrefix" | "confirmDelete";
type Focus = "docs" | "chunks";

function canDocs(connection: DebugConnection): boolean {
  return Array.isArray(connection.capabilities) && connection.capabilities.includes("docs");
}

function approxTokens(text: string): number {
  const s = (text ?? "").trim();
  if (!s) return 0;
  return s.split(/\s+/g).length;
}

function histogram(values: number[], buckets: number[]): Array<{ label: string; count: number }> {
  const sorted = [...buckets].sort((a, b) => a - b);
  const counts = new Array(sorted.length + 1).fill(0);
  for (const v of values) {
    const i = sorted.findIndex((b) => v < b);
    counts[i === -1 ? sorted.length : i] += 1;
  }
  const labels: string[] = [];
  for (let i = 0; i < sorted.length + 1; i++) {
    if (i === 0) labels.push(`<${sorted[0]}`);
    else if (i === sorted.length) labels.push(`${sorted[i - 1]}+`);
    else labels.push(`${sorted[i - 1]}–${sorted[i] - 1}`);
  }
  return labels.map((label, i) => ({ label, count: counts[i] ?? 0 }));
}

function Bars({
  rows,
  width,
}: {
  rows: Array<{ label: string; count: number }>;
  width: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const labelW = Math.min(10, Math.max(6, ...rows.map((r) => r.label.length)));
  const barW = clamp(width - labelW - 6, 6, 40);
  return (
    <Box flexDirection="column">
      {rows.map((r) => {
        const n = Math.round((r.count / max) * barW);
        const bar = chars.fullBlock.repeat(Math.max(0, n));
        return (
          <Box key={r.label} gap={1}>
            <Text color={theme.muted}>{r.label.padStart(labelW)}</Text>
            <Text color={theme.accent}>{bar.padEnd(barW)}</Text>
            <Text color={theme.muted}>{String(r.count).padStart(3)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

export function Docs({ connection }: DocsProps) {
  const { columns, rows } = useTerminalSize();
  const canSplit = columns >= 120;
  const docsCapable = canDocs(connection);

  const [mode, setMode] = useState<Mode>("idle");
  const [focus, setFocus] = useState<Focus>("docs");
  const [prefix, setPrefix] = useState("");
  const [limit] = useState(30);
  const [offset, setOffset] = useState(0);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [selectedChunkIndex, setSelectedChunkIndex] = useState(0);

  const [docsRes, setDocsRes] = useState<DebugCommandResult | null>(null);
  const [docRes, setDocRes] = useState<DebugCommandResult | null>(null);
  const [statsRes, setStatsRes] = useState<DebugCommandResult | null>(null);

  const pendingDeleteSourceIdRef = useRef<string | null>(null);

  const documents = useMemo(() => {
    if (docsRes?.type !== "list-documents" || !docsRes.success) return [];
    return docsRes.documents ?? [];
  }, [docsRes]);

  const total = useMemo(() => {
    if (docsRes?.type !== "list-documents" || !docsRes.success) return 0;
    return docsRes.total ?? 0;
  }, [docsRes]);

  const selectedDoc = documents[Math.min(selectedDocIndex, Math.max(0, documents.length - 1))];
  const selectedSourceId = selectedDoc?.sourceId ?? null;

  const doc = useMemo(() => {
    if (docRes?.type !== "get-document" || !docRes.success) return undefined;
    return docRes.document;
  }, [docRes]);

  const chunks = doc?.chunks ?? [];
  const boundedChunkIndex = Math.min(selectedChunkIndex, Math.max(0, chunks.length - 1));
  const selectedChunk = chunks[boundedChunkIndex];

  const refreshList = async () => {
    setDocsRes(null);
    const res = await connection.sendCommand({
      type: "list-documents",
      prefix: prefix.trim() || undefined,
      limit,
      offset,
    });
    setDocsRes(res);
  };

  const refreshStats = async () => {
    setStatsRes(null);
    const res = await connection.sendCommand({ type: "store-stats" });
    setStatsRes(res);
  };

  const refreshDocument = async (sourceId: string) => {
    setDocRes(null);
    const res = await connection.sendCommand({ type: "get-document", sourceId });
    setDocRes(res);
  };

  // Initial load (and refresh when paging/filter changes)
  useEffect(() => {
    if (!docsCapable) return;
    void refreshStats();
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsCapable, limit, offset, prefix]);

  // Load selected doc details
  useEffect(() => {
    if (!docsCapable) return;
    if (!selectedSourceId) return;
    setSelectedChunkIndex(0);
    void refreshDocument(selectedSourceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsCapable, selectedSourceId]);

  useEffect(() => {
    setSelectedDocIndex(0);
  }, [offset, prefix]);

  useInput((input, key) => {
    if (!docsCapable) return;

    if (mode === "confirmDelete") {
      if (input === "y") {
        const sourceId = pendingDeleteSourceIdRef.current;
        pendingDeleteSourceIdRef.current = null;
        setMode("idle");
        if (sourceId) {
          void (async () => {
            await connection.sendCommand({ type: "delete-document", sourceId });
            await refreshStats();
            await refreshList();
          })();
        }
        return;
      }
      if (input === "n" || key.escape) {
        pendingDeleteSourceIdRef.current = null;
        setMode("idle");
        return;
      }
      return;
    }

    if (input === "\t") {
      setFocus((f) => (f === "docs" ? "chunks" : "docs"));
      return;
    }

    if (input === "f") {
      setMode((m) => (m === "editingPrefix" ? "idle" : "editingPrefix"));
      return;
    }
    if (input === "r") {
      void refreshStats();
      void refreshList();
      if (selectedSourceId) void refreshDocument(selectedSourceId);
      return;
    }

    if (mode === "editingPrefix") {
      if (key.return) {
        setMode("idle");
        return;
      }
      if (key.backspace || key.delete) {
        setPrefix((p) => p.slice(0, -1));
        return;
      }
      if (input && input.length === 1 && !key.ctrl && !key.meta) {
        setPrefix((p) => p + input);
        return;
      }
      return;
    }

    if (input === "[" && offset > 0) {
      setOffset((o) => Math.max(0, o - limit));
      return;
    }
    if (input === "]" && offset + limit < total) {
      setOffset((o) => o + limit);
      return;
    }

    if (input === "d" && selectedSourceId) {
      pendingDeleteSourceIdRef.current = selectedSourceId;
      setMode("confirmDelete");
      return;
    }

    const up = key.upArrow || input === "k";
    const down = key.downArrow || input === "j";
    if (!up && !down) return;

    if (focus === "docs") {
      const max = Math.max(0, documents.length - 1);
      setSelectedDocIndex((i) => (up ? Math.max(0, i - 1) : Math.min(max, i + 1)));
    } else {
      const max = Math.max(0, chunks.length - 1);
      setSelectedChunkIndex((i) => (up ? Math.max(0, i - 1) : Math.min(max, i + 1)));
    }
  });

  const stats = statsRes?.type === "store-stats" && statsRes.success ? statsRes.stats : undefined;
  const docsErr = docsRes && docsRes.type === "list-documents" && !docsRes.success ? docsRes.error : undefined;
  const docErr = docRes && docRes.type === "get-document" && !docRes.success ? docRes.error : undefined;

  const chunkTokenCounts = useMemo(() => {
    return chunks.map((c) => approxTokens(c.content ?? ""));
  }, [chunks]);

  const tokenHist = useMemo(() => histogram(chunkTokenCounts, [50, 100, 200, 400, 800]), [chunkTokenCounts]);
  const anyContent = useMemo(() => chunks.some((c) => (c.content ?? "").trim().length > 0), [chunks]);

  const headerHint =
    mode === "confirmDelete"
      ? "Confirm delete: y / n"
      : mode === "editingPrefix"
        ? "Editing prefix: type, ⏎ to apply"
        : "tab focus · f filter · r refresh · d delete · [/] page · j/k navigate";

  return (
    <Box flexDirection="column" flexGrow={1} paddingY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Box gap={1}>
          <Text backgroundColor={theme.border} color={theme.fg}>
            {" "}DOCS{" "}
          </Text>
          <Text color={theme.muted}>{headerHint}</Text>
        </Box>
        <Box gap={2}>
          <Text color={theme.muted}>prefix:</Text>
          <Text color={mode === "editingPrefix" ? theme.accent : theme.fg} bold={mode === "editingPrefix"}>
            {prefix.trim() ? prefix.trim() : "—"}
          </Text>
        </Box>
      </Box>

      {!docsCapable ? (
        <Box borderStyle="round" borderColor={theme.borderActive} paddingX={1} paddingY={1}>
          <Text color={theme.warning}>
            {chars.cross} Server does not advertise docs capability. In your app, call{" "}
            <Text bold color={theme.fg}>
              {"`registerUnragDebug({ engine, storeInspector })`"}
            </Text>
            .
          </Text>
        </Box>
      ) : (
        <>
          {/* Store stats */}
          <Box borderStyle="round" borderColor={theme.border} paddingX={1} paddingY={0} marginBottom={1}>
            {stats ? (
              <Box gap={2} flexWrap="wrap">
                <Text color={theme.muted}>adapter</Text>
                <Text color={theme.fg} bold>
                  {stats.adapter}
                </Text>
                <Text color={theme.muted}>vectors</Text>
                <Text color={theme.fg} bold>
                  {stats.totalVectors ?? "—"}
                </Text>
                <Text color={theme.muted}>dim</Text>
                <Text color={theme.fg} bold>
                  {stats.embeddingDimension ?? "—"}
                </Text>
                {stats.tables?.map((t) => (
                  <Text key={t.name} color={theme.muted}>
                    {t.name}:{String(t.rowCount)}
                  </Text>
                ))}
              </Box>
            ) : statsRes?.type === "store-stats" && !statsRes.success ? (
              <Text color={theme.error}>
                {chars.cross} {statsRes.error ?? "Failed to load store stats"}
              </Text>
            ) : (
              <Text color={theme.muted}>Loading store stats…</Text>
            )}
          </Box>

          {/* Main */}
          <Box flexDirection={canSplit ? "row" : "column"} flexGrow={1} gap={2}>
            {/* Doc list */}
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor={focus === "docs" ? theme.borderActive : theme.border}
              paddingX={1}
              flexGrow={1}
              width={canSplit ? Math.floor(columns * 0.48) : undefined}
            >
              <Box justifyContent="space-between" marginBottom={1}>
                <Text backgroundColor={theme.border} color={theme.fg}>
                  {" "}DOCUMENTS{" "}
                </Text>
                <Text color={theme.muted}>
                  {total > 0 ? `${offset + 1}-${Math.min(offset + limit, total)} of ${total}` : "—"}
                </Text>
              </Box>

              {docsErr && (
                <Text color={theme.error} bold>
                  {chars.cross} {docsErr}
                </Text>
              )}

              {documents.length === 0 && !docsErr && (
                <Text color={theme.muted}>
                  {docsRes ? "No documents found." : "Loading documents…"}
                </Text>
              )}

              {documents.slice(0, Math.max(6, rows - 14)).map((d, i) => {
                const isSel = i === Math.min(selectedDocIndex, Math.max(0, documents.length - 1));
                return (
                  <Box key={`${d.sourceId}-${i}`} gap={1}>
                    <Text color={isSel ? theme.accent : theme.muted} bold={isSel}>
                      {isSel ? chars.pointer : " "}
                    </Text>
                    <Text color={theme.fg} bold={isSel}>
                      {truncate(d.sourceId, canSplit ? 48 : 36)}
                    </Text>
                    <Text color={theme.muted}>·</Text>
                    <Text color={theme.muted}>{String(d.chunkCount).padStart(3)} chunks</Text>
                    {d.createdAt && (
                      <>
                        <Text color={theme.muted}>·</Text>
                        <Text color={theme.muted}>{truncate(d.createdAt, 19)}</Text>
                      </>
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* Detail */}
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor={focus === "chunks" ? theme.borderActive : theme.border}
              paddingX={1}
              flexGrow={1}
              width={canSplit ? Math.floor(columns * 0.52) : undefined}
            >
              <Box justifyContent="space-between" marginBottom={1}>
                <Box gap={1}>
                  <Text backgroundColor={theme.accent} color="black" bold>
                    {" "}DETAILS{" "}
                  </Text>
                  <Text color={theme.muted}>{selectedSourceId ? truncate(selectedSourceId, 42) : "—"}</Text>
                </Box>
                <Text color={theme.muted}>
                  {doc ? `${chunks.length} chunks` : docRes ? "—" : "Loading…"}
                </Text>
              </Box>

              {docErr && (
                <Text color={theme.error} bold>
                  {chars.cross} {docErr}
                </Text>
              )}

              {!doc && !docErr && <Text color={theme.muted}>{selectedSourceId ? "Loading document…" : "Select a document."}</Text>}

              {doc && (
                <Box flexDirection="column" gap={1}>
                  {!anyContent && (
                    <Text color={theme.warning}>
                      {chars.cross} Chunks have no stored `content`. Your store adapter may not persist text content.
                    </Text>
                  )}

                  <Box flexDirection="column">
                    <Text color={theme.muted}>chunk token histogram (approx)</Text>
                    <Bars rows={tokenHist} width={canSplit ? Math.floor(columns * 0.48) : Math.max(40, columns - 8)} />
                  </Box>

                  <Box flexDirection="column">
                    <Text color={theme.muted}>
                      chunks ({focus === "chunks" ? "focused" : "tab to focus"})
                    </Text>
                    {chunks.slice(0, 10).map((c, i) => {
                      const isSel = i === boundedChunkIndex;
                      const tok = chunkTokenCounts[i] ?? 0;
                      return (
                        <Box key={`${c.id}-${i}`} gap={1}>
                          <Text color={isSel ? theme.accent : theme.muted} bold={isSel}>
                            {isSel ? chars.pointer : " "}
                          </Text>
                          <Text color={theme.muted}>{String(c.sequence).padStart(3)}</Text>
                          <Text color={theme.muted}>·</Text>
                          <Text color={theme.muted}>{String(tok).padStart(4)} tok</Text>
                          <Text color={theme.fg} bold={isSel}>
                            {truncate((c.content ?? "").replace(/\s+/g, " ").trim(), canSplit ? 72 : 44)}
                          </Text>
                        </Box>
                      );
                    })}
                  </Box>

                  <Box flexDirection="column">
                    <Text color={theme.muted}>selected chunk</Text>
                    <Box borderStyle="round" borderColor={theme.border} paddingX={1}>
                      <Text color={theme.fg}>{selectedChunk?.content?.trim() ? selectedChunk.content : "—"}</Text>
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

export default Docs;

