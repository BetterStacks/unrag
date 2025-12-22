export function capText(text: string, maxChars: number): string {
  const t = String(text ?? "");
  if (!Number.isFinite(maxChars) || maxChars <= 0) return t;
  return t.length <= maxChars ? t : t.slice(0, maxChars).trimEnd();
}

export function toUtf8String(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}


