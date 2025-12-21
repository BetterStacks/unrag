import { generateText } from "ai";
import type {
  AssetData,
  AssetFetchConfig,
  Metadata,
  PdfLlmExtractionConfig,
} from "./types";

const DEFAULT_UA = "unrag/asset-fetch";

const isProbablyIpLiteral = (host: string) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");

const isDisallowedHost = (host: string) => {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;
  if (h === "127.0.0.1" || h.startsWith("127.")) return true;
  if (h === "::1") return true;

  // If host is an IP literal, block common private ranges.
  if (isProbablyIpLiteral(h)) {
    if (h.startsWith("10.")) return true;
    if (h.startsWith("192.168.")) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  }

  return false;
};

async function fetchBytesFromUrl(args: {
  url: string;
  fetchConfig: AssetFetchConfig;
  headers?: Record<string, string>;
  maxBytes: number;
}): Promise<{ bytes: Uint8Array; mediaType?: string }> {
  if (!args.fetchConfig.enabled) {
    throw new Error("Asset fetch disabled (assetProcessing.fetch.enabled=false)");
  }

  const u = new URL(args.url);
  if (u.protocol !== "https:") {
    throw new Error("Only https:// URLs are allowed for asset fetching");
  }

  if (isDisallowedHost(u.hostname)) {
    throw new Error(`Disallowed host for asset fetch: ${u.hostname}`);
  }

  const allow = args.fetchConfig.allowedHosts;
  if (Array.isArray(allow) && allow.length > 0) {
    const ok = allow.some((h) => h.toLowerCase() === u.hostname.toLowerCase());
    if (!ok) {
      throw new Error(`Host not allowlisted for asset fetch: ${u.hostname}`);
    }
  }

  const abortSignal = AbortSignal.timeout(args.fetchConfig.timeoutMs);
  const headers = {
    "user-agent": DEFAULT_UA,
    ...(args.fetchConfig.headers ?? {}),
    ...(args.headers ?? {}),
  };

  const res = await fetch(args.url, { headers, signal: abortSignal });
  if (!res.ok) {
    throw new Error(`Asset fetch failed (${res.status} ${res.statusText})`);
  }

  const contentLength = Number(res.headers.get("content-length") ?? NaN);
  if (Number.isFinite(contentLength) && contentLength > args.maxBytes) {
    throw new Error(`Asset too large (content-length ${contentLength} > ${args.maxBytes})`);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > args.maxBytes) {
    throw new Error(`Asset too large (${buf.byteLength} > ${args.maxBytes})`);
  }

  const mediaType = res.headers.get("content-type")?.split(";")[0]?.trim();
  return { bytes: buf, mediaType: mediaType || undefined };
}

export type ExtractPdfWithLlmInput = {
  data: AssetData;
  metadata: Metadata;
  fetchConfig: AssetFetchConfig;
  llm: PdfLlmExtractionConfig;
};

/**
 * Extract text from a PDF by sending it as a file to an LLM (default: Gemini via AI Gateway).
 *
 * Notes:
 * - This is intentionally cost-guarded via `llm.enabled=false` by default.
 * - If the PDF is provided as a URL, it will be fetched at ingest time (respecting fetchConfig).
 * - The extracted text is intended to be chunked + embedded as normal text.
 */
export async function extractPdfTextWithLlm(
  input: ExtractPdfWithLlmInput
): Promise<string> {
  if (!input.llm.enabled) {
    throw new Error("PDF LLM extraction is disabled (assetProcessing.pdf.llmExtraction.enabled=false)");
  }

  const maxBytes = Math.min(input.llm.maxBytes, input.fetchConfig.maxBytes);

  let pdfBytes: Uint8Array;
  let mediaType: string | undefined;
  let filename: string | undefined;

  if (input.data.kind === "bytes") {
    pdfBytes = input.data.bytes;
    mediaType = input.data.mediaType;
    filename = input.data.filename;
  } else {
    filename = input.data.filename;
    const fetched = await fetchBytesFromUrl({
      url: input.data.url,
      fetchConfig: input.fetchConfig,
      headers: input.data.headers,
      maxBytes,
    });
    pdfBytes = fetched.bytes;
    mediaType = input.data.mediaType ?? fetched.mediaType;
  }

  if (pdfBytes.byteLength > maxBytes) {
    throw new Error(`PDF too large (${pdfBytes.byteLength} > ${maxBytes})`);
  }

  const abortSignal = AbortSignal.timeout(input.llm.timeoutMs);

  const result = await generateText({
    // Intentionally allow string model ids for AI Gateway usage (matches existing embedding style).
    model: input.llm.model as any,
    abortSignal,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: input.llm.prompt },
          {
            type: "file",
            data: pdfBytes,
            mediaType: mediaType ?? "application/pdf",
            ...(filename ? { filename } : {}),
          },
        ],
      },
    ],
  });

  const text = String((result as any)?.text ?? "").trim();
  if (!text) return "";
  if (text.length <= input.llm.maxOutputChars) return text;
  return text.slice(0, input.llm.maxOutputChars).trimEnd();
}


