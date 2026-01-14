/**
 * Fixed-height, scrollable text viewer for Ink.
 *
 * We pre-wrap text into lines and then render only a window of lines to
 * prevent layout shifts when selected content changes.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { clamp, theme, truncate } from "@registry/debug/tui/theme";

function wrapLine(line: string, width: number): string[] {
  const out: string[] = [];
  let s = String(line ?? "");
  if (width <= 1) return [s.slice(0, 1)];

  while (s.length > width) {
    // Prefer breaking on whitespace within the width.
    const slice = s.slice(0, width + 1);
    let cut = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\t"));
    if (cut <= 0) cut = width; // hard break
    out.push(s.slice(0, cut).trimEnd());
    s = s.slice(cut).trimStart();
  }
  out.push(s);
  return out;
}

function wrapText(text: string, width: number, maxLines: number = 4000): string[] {
  const raw = String(text ?? "");
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    for (const w of wrapLine(line, width)) {
      out.push(w);
      if (out.length >= maxLines) return out;
    }
  }
  return out;
}

export type ScrollableTextProps = {
  text?: string;
  /** Inner text width (excluding borders/padding). */
  width: number;
  /** Number of text lines to render. */
  height: number;
  scrollTop: number;
  placeholder?: string;
  borderColor?: string;
  showStatus?: boolean;
};

export function ScrollableText({
  text,
  width,
  height,
  scrollTop,
  placeholder = "—",
  borderColor = theme.border,
  showStatus = true,
}: ScrollableTextProps) {
  const safeWidth = Math.max(8, width);
  const safeHeight = Math.max(3, height);

  const wrapped = useMemo(() => {
    const s = String(text ?? "").trimEnd();
    if (!s) return [];
    return wrapText(s, safeWidth);
  }, [text, safeWidth]);

  const maxTop = Math.max(0, wrapped.length - safeHeight);
  const top = clamp(scrollTop, 0, maxTop);
  const needsScroll = wrapped.length > safeHeight;
  const showStatusLine = Boolean(showStatus) && needsScroll;
  const contentLines = showStatusLine ? Math.max(1, safeHeight - 1) : safeHeight;
  const slice = wrapped.slice(top, top + contentLines);
  const padded = [...slice];
  while (padded.length < contentLines) padded.push("");

  const statusLine = (() => {
    if (!showStatusLine) return "";
    return `${top + 1}-${Math.min(top + contentLines, wrapped.length)} of ${wrapped.length} · ^u/^d scroll`;
  })();

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={borderColor}
        paddingX={1}
        height={safeHeight + 2}
      >
        {wrapped.length === 0 ? (
          <>
            <Text color={theme.muted}>{truncate(placeholder, safeWidth)}</Text>
            {Array.from({ length: safeHeight - 1 }).map((_, i) => (
              <Text key={`pad-${i}`} color={theme.muted}>
                {" "}
              </Text>
            ))}
          </>
        ) : (
          padded.map((line, i) => (
            <Text key={`line-${i}`} color={theme.fg}>
              {truncate(line, safeWidth).padEnd(safeWidth)}
            </Text>
          ))
        )}
        {showStatusLine && (
          <Text color={theme.muted}>{truncate(statusLine, safeWidth).padEnd(safeWidth)}</Text>
        )}
      </Box>
    </Box>
  );
}

export default ScrollableText;

