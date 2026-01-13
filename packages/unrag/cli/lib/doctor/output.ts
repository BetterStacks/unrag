/**
 * Output formatting for doctor command.
 * Handles human-readable and JSON output formats.
 */

import type { CheckResult, CheckStatus, DoctorReport } from "./types";

const STATUS_ICONS: Record<CheckStatus, string> = {
  pass: "✓",
  warn: "⚠",
  fail: "✗",
  skip: "○",
};

const STATUS_COLORS: Record<CheckStatus, (s: string) => string> = {
  pass: (s) => `\x1b[32m${s}\x1b[0m`, // green
  warn: (s) => `\x1b[33m${s}\x1b[0m`, // yellow
  fail: (s) => `\x1b[31m${s}\x1b[0m`, // red
  skip: (s) => `\x1b[90m${s}\x1b[0m`, // gray
};

type FormatOptions = {
  showDbHint?: boolean;
};

/**
 * Format report as human-readable text.
 */
export function formatReport(
  report: DoctorReport,
  options: FormatOptions = {}
): string {
  const lines: string[] = [];

  // Header
  lines.push("");

  // Groups
  for (const group of report.groups) {
    if (group.results.length === 0) continue;

    lines.push(`${group.title}`);
    lines.push("─".repeat(group.title.length));

    for (const result of group.results) {
      lines.push(formatResult(result));
    }

    lines.push("");
  }

  // Summary
  lines.push("Summary");
  lines.push("─".repeat(7));

  const { pass, warn, fail, skip, total } = report.summary;
  const summaryParts: string[] = [];

  if (pass > 0) summaryParts.push(STATUS_COLORS.pass(`${pass} passed`));
  if (warn > 0) summaryParts.push(STATUS_COLORS.warn(`${warn} warnings`));
  if (fail > 0) summaryParts.push(STATUS_COLORS.fail(`${fail} failed`));
  if (skip > 0) summaryParts.push(STATUS_COLORS.skip(`${skip} skipped`));

  lines.push(`${summaryParts.join(", ")} (${total} total)`);

  // Overall status
  if (fail > 0) {
    lines.push("");
    lines.push(STATUS_COLORS.fail("Some checks failed. See details above."));
  } else if (warn > 0) {
    lines.push("");
    lines.push(
      STATUS_COLORS.warn("All checks passed with warnings. Review recommended.")
    );
  } else {
    lines.push("");
    lines.push(STATUS_COLORS.pass("All checks passed!"));
  }

  // DB hint
  if (options.showDbHint) {
    lines.push("");
    lines.push(
      STATUS_COLORS.skip(
        "Tip: Run `unrag doctor --db` to also check database connectivity and schema."
      )
    );
  }

  return lines.join("\n");
}

/**
 * Format a single check result.
 */
function formatResult(result: CheckResult): string {
  const lines: string[] = [];
  const icon = STATUS_ICONS[result.status];
  const color = STATUS_COLORS[result.status];

  // Main line
  lines.push(`  ${color(icon)} ${result.title}: ${result.summary}`);

  // Details (indented)
  if (result.details && result.details.length > 0) {
    for (const detail of result.details) {
      if (detail === "") {
        lines.push("");
      } else {
        lines.push(`      ${detail}`);
      }
    }
  }

  // Fix hints (indented, different styling)
  if (result.fixHints && result.fixHints.length > 0) {
    lines.push(`      Fix:`);
    for (const hint of result.fixHints) {
      lines.push(`        ${hint}`);
    }
  }

  // Docs link
  if (result.docsLink) {
    lines.push(`      Docs: ${result.docsLink}`);
  }

  return lines.join("\n");
}

/**
 * Format report as JSON.
 */
export function formatJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Create a simple pass result.
 */
export function pass(
  id: string,
  title: string,
  summary: string,
  options: Partial<CheckResult> = {}
): CheckResult {
  return { id, title, status: "pass", summary, ...options };
}

/**
 * Create a simple warn result.
 */
export function warn(
  id: string,
  title: string,
  summary: string,
  options: Partial<CheckResult> = {}
): CheckResult {
  return { id, title, status: "warn", summary, ...options };
}

/**
 * Create a simple fail result.
 */
export function fail(
  id: string,
  title: string,
  summary: string,
  options: Partial<CheckResult> = {}
): CheckResult {
  return { id, title, status: "fail", summary, ...options };
}

/**
 * Create a simple skip result.
 */
export function skip(
  id: string,
  title: string,
  summary: string,
  options: Partial<CheckResult> = {}
): CheckResult {
  return { id, title, status: "skip", summary, ...options };
}
