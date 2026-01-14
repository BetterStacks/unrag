/**
 * Doctor tab: actionable environment + configuration checks.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { DebugConnection, DebugCommandResult, DoctorCheck } from "@registry/debug/types";
import { chars, formatDuration, theme, truncate } from "@registry/debug/tui/theme";
import { useTerminalSize } from "@registry/debug/tui/hooks/useTerminalSize";

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
  const { columns } = useTerminalSize();
  const canSplit = columns >= 120;

  const [res, setRes] = useState<DebugCommandResult | null>(null);
  const [loading, setLoading] = useState(false);

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

  useInput((input) => {
    if (input === "r") void run();
  });

  const doctor = useMemo(() => {
    if (res?.type !== "doctor") return undefined;
    return res;
  }, [res]);

  const checks = doctor?.success ? doctor.checks : [];
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
            r refresh · checks are non-invasive (no network calls)
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
          borderStyle="round"
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

          {checks.map((c) => (
            <Box key={c.id} flexDirection="column" marginBottom={1}>
              <Box gap={1}>
                <Text color={statusColor(c.status)} bold>
                  {statusIcon(c.status)}
                </Text>
                <Text color={theme.fg} bold>
                  {c.label}
                </Text>
              </Box>
              {c.detail && (
                <Text color={theme.muted}>
                  {chars.arrow} {truncate(c.detail, canSplit ? 88 : 72)}
                </Text>
              )}
              {c.fix && (
                <Text color={theme.warning}>
                  {chars.arrow} Fix: {truncate(c.fix, canSplit ? 88 : 72)}
                </Text>
              )}
            </Box>
          ))}
        </Box>

        {/* Info */}
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
              {" "}INFO{" "}
            </Text>
            <Text color={theme.muted}>handshake + runtime snapshot</Text>
          </Box>

          <Box flexDirection="column" gap={1}>
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

