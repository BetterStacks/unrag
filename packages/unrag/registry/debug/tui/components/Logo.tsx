import React, { useMemo } from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { UNRAG_LOGO_LINES } from "@registry/debug/tui/assets/unragLogo";
import { clamp, theme } from "@registry/debug/tui/theme";

type LogoProps = {
  columns: number;
  rows: number;
};

function maxLineWidth(lines: string[]): number {
  return lines.reduce((m, s) => Math.max(m, s.length), 0);
}

function downsampleLine(line: string, xFactor: number): string {
  if (xFactor <= 1) return line;
  let out = "";
  for (let i = 0; i < line.length; i += xFactor) {
    const chunk = line.slice(i, i + xFactor);
    out += chunk.includes("g") ? "g" : "u";
  }
  return out;
}

function downsample(lines: string[], xFactor: number, yFactor: number): string[] {
  const out: string[] = [];
  const yf = Math.max(1, yFactor);
  for (let y = 0; y < lines.length; y += yf) {
    out.push(downsampleLine(lines[y], xFactor));
  }
  return out;
}

function renderPixels(line: string, accentHex: string): string {
  // Map g -> colored blocks, u -> whitespace.
  // We keep whitespace truly empty to keep "sparse background colors".
  let out = "";
  let runChar: "g" | "u" | null = null;
  let runLen = 0;

  const flush = () => {
    if (!runChar || runLen <= 0) return;
    if (runChar === "g") out += chalk.hex(accentHex)("█".repeat(runLen));
    else out += " ".repeat(runLen);
    runChar = null;
    runLen = 0;
  };

  for (const ch of line) {
    const c = ch === "g" ? "g" : "u";
    if (runChar === c) runLen++;
    else {
      flush();
      runChar = c;
      runLen = 1;
    }
  }
  flush();
  return out;
}

function findNearestLogoTxt(): string | null {
  let dir = process.cwd();
  // Walk up a few levels so running `unrag debug` from a workspace subdir
  // can still pick up a repo-root `logo.txt`.
  for (let i = 0; i < 8; i++) {
    const p = join(dir, "logo.txt");
    if (existsSync(p)) return p;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadLogoFromFs(): string[] | null {
  try {
    const p = findNearestLogoTxt();
    if (!p) return null;
    const raw = readFileSync(p, "utf8");
    const lines = raw
      .split(/\r?\n/g)
      .map((s) => s.trimEnd())
      .filter((s) => s.length > 0);

    if (lines.length === 0) return null;

    // Validate: only accept g/u pixel art to avoid rendering random files.
    for (const line of lines) {
      if (!/^[gu]+$/.test(line)) return null;
    }
    return lines;
  } catch {
    return null;
  }
}

export function Logo({ columns, rows }: LogoProps) {
  const rawLines = useMemo(() => loadLogoFromFs() ?? UNRAG_LOGO_LINES, []);
  const rawWidth = maxLineWidth(rawLines);
  const rawHeight = rawLines.length;

  // Keep the header logo from consuming the whole screen.
  const targetMaxHeight = clamp(Math.floor(rows * 0.25), 4, 10);
  const availableWidth = Math.max(20, columns - 4);

  // Choose scale factors so the logo fits.
  const xFactor = Math.max(1, Math.ceil(rawWidth / availableWidth));
  const yFactor = Math.max(1, Math.ceil(rawHeight / targetMaxHeight));

  const lines = useMemo(() => downsample(rawLines, xFactor, yFactor), [rawLines, xFactor, yFactor]);

  // Center based on the downsampled width (approx).
  const width = maxLineWidth(lines);
  const leftPad = Math.max(0, Math.floor((columns - width) / 2));

  const accentHex = typeof theme.accent === "string" && theme.accent.startsWith("#") ? theme.accent : "#7CCE00";

  return (
    <Box flexDirection="column">
      {lines.map((line, idx) => (
        <Text key={idx}>
          {" ".repeat(leftPad)}
          {renderPixels(line, accentHex)}
        </Text>
      ))}
    </Box>
  );
}

export default Logo;

