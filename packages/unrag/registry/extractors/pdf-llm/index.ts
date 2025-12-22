import { generateText } from "ai";
import type { AssetData, AssetExtractor, AssetFetchConfig } from "../../core/types";

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
    throw new Error(
      `Asset too large (content-length ${contentLength} > ${args.maxBytes})`
    );
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > args.maxBytes) {
    throw new Error(`Asset too large (${buf.byteLength} > ${args.maxBytes})`);
  }

  const mediaType = res.headers.get("content-type")?.split(";")[0]?.trim();
  return { bytes: buf, mediaType: mediaType || undefined };
}

async function getPdfBytes(args: {
  data: AssetData;
  fetchConfig: AssetFetchConfig;
  maxBytes: number;
}): Promise<{ bytes: Uint8Array; mediaType: string; filename?: string }> {
  if (args.data.kind === "bytes") {
    return {
      bytes: args.data.bytes,
      mediaType: args.data.mediaType,
      ...(args.data.filename ? { filename: args.data.filename } : {}),
    };
  }

  const fetched = await fetchBytesFromUrl({
    url: args.data.url,
    fetchConfig: args.fetchConfig,
    headers: args.data.headers,
    maxBytes: args.maxBytes,
  });

  return {
    bytes: fetched.bytes,
    mediaType: args.data.mediaType ?? fetched.mediaType ?? "application/pdf",
    ...(args.data.filename ? { filename: args.data.filename } : {}),
  };
}

/**
 * PDF text extraction via LLM (default model: Gemini via AI Gateway).
 *
 * This extractor reads its configuration from `assetProcessing.pdf.llmExtraction`.
 */
export function createPdfLlmExtractor(): AssetExtractor {
  return {
    name: "pdf:llm",
    supports: ({ asset }) => asset.kind === "pdf",
    extract: async ({ asset, ctx }) => {
      const llm = ctx.assetProcessing.pdf.llmExtraction;
      const fetchConfig = ctx.assetProcessing.fetch;

      if (!llm.enabled) {
        return { texts: [] };
      }

      const maxBytes = Math.min(llm.maxBytes, fetchConfig.maxBytes);
      const { bytes, mediaType, filename } = await getPdfBytes({
        data: asset.data,
        fetchConfig,
        maxBytes,
      });

      if (bytes.byteLength > maxBytes) {
        throw new Error(`PDF too large (${bytes.byteLength} > ${maxBytes})`);
      }

      const abortSignal = AbortSignal.timeout(llm.timeoutMs);

      const result = await generateText({
        // Intentionally allow string model ids for AI Gateway usage.
        model: llm.model as any,
        abortSignal,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: llm.prompt },
              {
                type: "file",
                data: bytes,
                mediaType: mediaType ?? "application/pdf",
                ...(filename ? { filename } : {}),
              },
            ],
          },
        ],
      });

      const text = String((result as any)?.text ?? "").trim();
      if (!text) return { texts: [], diagnostics: { model: llm.model } };

      const capped =
        text.length <= llm.maxOutputChars
          ? text
          : text.slice(0, llm.maxOutputChars).trimEnd();

      return {
        texts: [{ label: "fulltext", content: capped }],
        diagnostics: { model: llm.model },
      };
    },
  };
}


