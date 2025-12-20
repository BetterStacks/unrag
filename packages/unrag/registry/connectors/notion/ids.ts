const UUID_32_RE = /^[0-9a-f]{32}$/i;
const UUID_HYPHEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeNotionId32(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("Notion id is required");

  // Try to extract UUID-like tokens from URLs or mixed strings.
  const token =
    raw.match(/[0-9a-fA-F]{32}/)?.[0] ??
    raw.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)?.[0] ??
    raw;

  const normalized = token.replaceAll("-", "").toLowerCase();
  if (!UUID_32_RE.test(normalized)) {
    throw new Error(`Invalid Notion id: ${input}`);
  }
  return normalized;
}

export function toUuidHyphenated(id32: string): string {
  const n = normalizeNotionId32(id32);
  return `${n.slice(0, 8)}-${n.slice(8, 12)}-${n.slice(12, 16)}-${n.slice(
    16,
    20
  )}-${n.slice(20)}`;
}

export function normalizeNotionPageId32(pageIdOrUrl: string): string {
  return normalizeNotionId32(pageIdOrUrl);
}

export function isUuidLike(input: string): boolean {
  const s = String(input ?? "").trim();
  return UUID_32_RE.test(s.replaceAll("-", "")) || UUID_HYPHEN_RE.test(s);
}


