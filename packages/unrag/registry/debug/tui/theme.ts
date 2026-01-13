/**
 * Theme constants and utilities for the debug TUI.
 * 
 * Design inspired by Claude Code and Cursor:
 * - Dense but well-structured layouts
 * - Monochrome palette with single accent color
 * - Clear visual hierarchy
 * - Subtle borders for structure
 */

import type { DebugConnectionStatus } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Color palette
// ─────────────────────────────────────────────────────────────────────────────

export const theme = {
  // Primary text
  fg: "white",
  // Secondary/dim text
  muted: "gray",
  dim: "gray",
  // Borders and separators
  border: "gray",
  borderActive: "white",
  // Accent color (selection, active states)
  accent: "#7CCE00",
  accentBg: "#7CCE00",
  // Background colors for panels
  panelBg: "black",
  headerBg: "white",
  // Status colors
  success: "green",
  warning: "yellow",
  error: "red",
  // Event type colors
  ingest: "#67AA01",
  retrieve: "#67AA01",
  rerank: "#67AA01",
  delete: "#67AA01",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Box drawing characters
// ─────────────────────────────────────────────────────────────────────────────

export const chars = {
  // Horizontal/vertical lines
  h: "─",
  v: "│",
  // Corners
  tl: "┌",
  tr: "┐",
  bl: "└",
  br: "┘",
  // T-junctions
  lt: "├",
  rt: "┤",
  tt: "┬",
  bt: "┴",
  // Cross
  x: "┼",
  // Bullets and indicators
  dot: "●",
  circle: "○",
  arrow: "›",
  check: "✓",
  cross: "✗",
  // Section markers
  section: "▸",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// String utilities
// ─────────────────────────────────────────────────────────────────────────────

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function truncate(text: string, maxLen: number): string {
  const s = String(text ?? "");
  if (maxLen <= 0) return "";
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)) + "…";
}

export function pad(text: string, width: number, align: "left" | "right" = "left"): string {
  const s = String(text ?? "");
  if (s.length >= width) return s.slice(0, width);
  return align === "left" ? s.padEnd(width) : s.padStart(width);
}

export function hr(width: number): string {
  return chars.h.repeat(Math.max(0, width));
}

// ─────────────────────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────────────────────

export function statusLabel(status: DebugConnectionStatus): string {
  switch (status) {
    case "connected":
      return "live";
    case "connecting":
      return "connecting";
    case "reconnecting":
      return "reconnecting";
    case "disconnected":
      return "offline";
    case "error":
      return "error";
  }
}

export function statusColor(status: DebugConnectionStatus): string {
  switch (status) {
    case "connected":
      return theme.success;
    case "connecting":
    case "reconnecting":
      return theme.warning;
    case "disconnected":
      return theme.muted;
    case "error":
      return theme.error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event type helpers
// ─────────────────────────────────────────────────────────────────────────────

export function eventTypeColor(type: string): string {
  if (type.includes("error")) return theme.error;
  if (type.startsWith("ingest")) return theme.ingest;
  if (type.startsWith("retrieve")) return theme.retrieve;
  if (type.startsWith("rerank")) return theme.rerank;
  if (type.startsWith("delete")) return theme.delete;
  return theme.muted;
}

export function eventTypeIcon(type: string): string {
  if (type.includes("error")) return chars.cross;
  if (type.includes("complete")) return chars.check;
  if (type.includes("start")) return chars.arrow;
  return chars.dot;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time formatting
// ─────────────────────────────────────────────────────────────────────────────

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}