/**
 * Doctor tab: actionable environment + configuration checks.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { DebugConnection, DebugCommandResult, DoctorCheck } from "@registry/debug/types";
import { chars, formatDuration, theme, truncate } from "@registry/debug/tui/theme";
import { useTerminalSize } from "@registry/debug/tui/hooks/useTerminalSize";
import { useScrollWindow } from "@registry/debug/tui/hooks/useScrollWindow";

type DoctorProps = {
  connection: DebugConnection;
};

function statusColor(status: DoctorCheck["status"]): string {
  if (status === "ok") return theme.ok;
  if (status === "warn") return theme.warning;
  return theme.error;
}

function statusIcon(status: DoctorCheck["status"]): string {
  if (status === "ok") return chars.check;
  if (status === "warn") return chars.dot;
  return chars.cross;
}

export function Doctor({ connection }: DoctorProps) {
  const { columns, rows } = useTerminalSize();
  const canSplit = columns >= 120;

  const [res, setRes] = useState<DebugCommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const run = async () => {
    setLoading(true);
    try {
      const r = await connection.sendCommand({ type: "doctor" });
      setRes(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connection.status !== "connected") return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.status]);

  const doctor = useMemo(() => {
    if (res?.type !== "doctor") return undefined;
    return res;
  }, [res]);

  const checks = doctor?.success ? doctor.checks : [];
  const maxIndex = Math.max(0, checks.length - 1);
  const boundedIndex = Math.min(selectedIndex, maxIndex);
  const selectedCheck = checks[boundedIndex];
  const listViewportRows = Math.max(8, Math.min(26, rows - (canSplit ? 16 : 18)));
  const scroll = useScrollWindow({
    itemCount: checks.length,
    selectedIndex: boundedIndex,
    viewportRows: listViewportRows,
    resetKey: String(res?.type === "doctor" && res.success ? res.checks.length : 0),
  });
  useInput((input, key) => {
    if (input === "r") {
      void run();
      return;
    }
    if (key.upArrow || input === "k") setSelectedIndex((p) => Math.max(0, p - 1));
    if (key.downArrow || input === "j") setSelectedIndex((p) => Math.min(maxIndex, p + 1));
  });

  const summary = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let err = 0;
    for (const c of checks) {
      if (c.status === "ok") ok++;
      else if (c.status === "warn") warn++;
      else err++;
    }
    return { ok, warn, err };
  }, [checks]);

  const info = doctor?.success ? doctor.info : undefined;
  const engineInfo = info?.runtime?.engineInfo;

  return (
    <Box flexDirection="column" flexGrow={1} paddingY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Box gap={1}>
          <Text backgroundColor={theme.border} color={theme.fg}>
            {" "}DOCTOR{" "}
          </Text>
          <Text color={theme.muted}>
            r refresh · j/k navigate · checks are non-invasive
          </Text>
        </Box>
        <Box gap={2}>
          <Text color={theme.muted}>status</Text>
          <Text color={connection.status === "connected" ? theme.ok : theme.warning} bold>
            {connection.status}
          </Text>
        </Box>
      </Box>

      <Box flexDirection={canSplit ? "row" : "column"} flexGrow={1} gap={2}>
        {/* Checks */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.borderActive}
          paddingX={1}
          flexGrow={1}
          width={canSplit ? Math.floor(columns * 0.55) : undefined}
        >
          <Box justifyContent="space-between" marginBottom={1}>
            <Box gap={1}>
              <Text backgroundColor={theme.border} color={theme.fg}>
                {" "}CHECKS{" "}
              </Text>
              {loading && <Text color={theme.muted}>Running…</Text>}
            </Box>
            <Text color={theme.muted}>
              {summary.ok} ok · {summary.warn} warn · {summary.err} err
            </Text>
          </Box>

          {doctor && doctor.type === "doctor" && !doctor.success && (
            <Text color={theme.error} bold>
              {chars.cross} {doctor.error ?? "Doctor failed"}
            </Text>
          )}

          {!doctor && connection.status === "connected" && (
            <Text color={theme.muted}>Press r to run checks.</Text>
          )}

          {checks.length === 0 ? (
            <Text color={theme.muted}>No checks yet.</Text>
          ) : (
            <>
              {checks.slice(scroll.windowStart, scroll.windowEnd).map((c, idx) => {
                const i = scroll.windowStart + idx;
                const isSel = i === boundedIndex;
                return (
                  <Box key={c.id} gap={1}>
                    <Text color={isSel ? theme.accent : theme.muted} bold={isSel}>
                      {isSel ? chars.pointer : " "}
                    </Text>
                    <Text color={statusColor(c.status)} bold>
                      {statusIcon(c.status)}
                    </Text>
                    <Text color={theme.fg} bold={isSel}>
                      {truncate(c.label, canSplit ? 52 : 36)}
                    </Text>
                    {c.detail && (
                      <Text color={theme.muted}>
                        {chars.arrow} {truncate(c.detail, canSplit ? 52 : 28)}
                      </Text>
                    )}
                  </Box>
                );
              })}
              <Text color={theme.muted}>
                {scroll.windowStart + 1}-{scroll.windowEnd} of {checks.length}
              </Text>
            </>
          )}
        </Box>

        {/* Info */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.border}
          paddingX={1}
          flexGrow={1}
          width={canSplit ? Math.floor(columns * 0.45) : undefined}
        >
          <Box marginBottom={1} gap={1}>
            <Text backgroundColor={theme.accent} color="black" bold>
              {" "}INFO{" "}
            </Text>
            <Text color={theme.muted}>handshake + runtime snapshot</Text>
          </Box>

          <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
              <Text color={theme.muted}>selected check</Text>
              <Box borderStyle="single" borderColor={selectedCheck ? statusColor(selectedCheck.status) : theme.border} paddingX={1}>
                {!selectedCheck ? (
                  <Text color={theme.muted}>—</Text>
                ) : (
                  <Box flexDirection="column">
                    <Text color={theme.fg} bold>
                      {statusIcon(selectedCheck.status)} {selectedCheck.label}
                    </Text>
                    {selectedCheck.detail && (
                      <Text color={theme.muted}>
                        {chars.arrow} {truncate(selectedCheck.detail, 120)}
                      </Text>
                    )}
                    {selectedCheck.fix && (
                      <Text color={theme.warning}>
                        {chars.arrow} Fix: {truncate(selectedCheck.fix, 120)}
                      </Text>
                    )}
                  </Box>
                )}
              </Box>
            </Box>

            <Box gap={1} flexWrap="wrap">
              <Text color={theme.muted}>protocol</Text>
              <Text color={theme.fg} bold>
                {connection.protocolVersion ?? "—"}
              </Text>
              <Text color={theme.muted}>session</Text>
              <Text color={theme.fg} bold>
                {connection.sessionId ?? info?.sessionId ?? "—"}
              </Text>
            </Box>

            <Box gap={1} flexWrap="wrap">
              <Text color={theme.muted}>capabilities</Text>
              <Text color={theme.fg}>
                {(connection.capabilities ?? []).join(", ") || "—"}
              </Text>
            </Box>

            {info?.uptimeMs !== undefined && (
              <Box gap={1}>
                <Text color={theme.muted}>uptime</Text>
                <Text color={theme.fg}>{formatDuration(info.uptimeMs)}</Text>
              </Box>
            )}

            {info?.runtime && (
              <Box flexDirection="column" gap={1}>
                <Text color={theme.muted}>runtime</Text>
                <Text color={theme.fg}>
                  registered: <Text bold>{String(info.runtime.registered)}</Text> · engine:{" "}
                  <Text bold>{String(info.runtime.hasEngine)}</Text> · storeInspector:{" "}
                  <Text bold>{String(info.runtime.hasStoreInspector)}</Text>
                </Text>
                {info.runtime.registeredAt && (
                  <Text color={theme.muted}>registeredAt: {new Date(info.runtime.registeredAt).toISOString()}</Text>
                )}
              </Box>
            )}

            {engineInfo && (
              <Box flexDirection="column" gap={1}>
                <Text color={theme.muted}>engine config</Text>
                <Text color={theme.fg}>
                  embedding: <Text bold>{engineInfo.embedding.name}</Text>
                  {engineInfo.embedding.dimensions ? ` · dim ${engineInfo.embedding.dimensions}` : ""} · batch{" "}
                  <Text bold>{String(engineInfo.embedding.supportsBatch)}</Text> · image{" "}
                  <Text bold>{String(engineInfo.embedding.supportsImage)}</Text>
                </Text>
                <Text color={theme.fg}>
                  storage: chunkContent <Text bold>{String(engineInfo.storage.storeChunkContent)}</Text> ·
                  docContent <Text bold>{String(engineInfo.storage.storeDocumentContent)}</Text>
                </Text>
                <Text color={theme.fg}>
                  chunking: size <Text bold>{engineInfo.defaults.chunkSize}</Text> · overlap{" "}
                  <Text bold>{engineInfo.defaults.chunkOverlap}</Text>
                </Text>
                <Text color={theme.fg}>
                  extractors: <Text bold>{engineInfo.extractorsCount}</Text>
                </Text>
                <Text color={theme.fg}>
                  reranker: <Text bold>{engineInfo.rerankerName ?? "none"}</Text>
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default Doctor;

