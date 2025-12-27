import type { EmbeddingProvider } from "../core/types";
import { requireOptional } from "./_shared";

export type OpenRouterEmbeddingConfig = {
  model?: string;
  timeoutMs?: number;
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  referer?: string;
  title?: string;
};

const DEFAULT_TEXT_MODEL = "text-embedding-3-small";

const buildHeaders = (config: OpenRouterEmbeddingConfig) => {
  const headers: Record<string, string> = { ...(config.headers ?? {}) };
  if (config.referer) headers["HTTP-Referer"] = config.referer;
  if (config.title) headers["X-Title"] = config.title;
  return headers;
};

export const createOpenRouterEmbeddingProvider = (
  config: OpenRouterEmbeddingConfig = {}
): EmbeddingProvider => {
  const { OpenRouter } = requireOptional<any>({
    id: "@openrouter/sdk",
    installHint: "bun add @openrouter/sdk",
    providerName: "openrouter",
  });
  const model =
    config.model ?? process.env.OPENROUTER_EMBEDDING_MODEL ?? DEFAULT_TEXT_MODEL;
  const timeoutMs = config.timeoutMs;
  const headers = buildHeaders(config);

  const client = new OpenRouter({
    apiKey: config.apiKey ?? process.env.OPENROUTER_API_KEY ?? "",
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    ...(Object.keys(headers).length ? { headers } : {}),
  } as any);

  return {
    name: `openrouter:${model}`,
    dimensions: undefined,
    embed: async ({ text }) => {
      const abortSignal = timeoutMs
        ? AbortSignal.timeout(timeoutMs)
        : undefined;

      const result = await (client as any).embeddings.generate(
        { input: text, model },
        abortSignal ? { fetchOptions: { signal: abortSignal } } : undefined
      );

      const embedding =
        (result as any)?.data?.[0]?.embedding ??
        (result as any)?.embedding ??
        (result as any)?.data?.embedding;
      if (!embedding) {
        throw new Error("Embedding missing from OpenRouter response");
      }

      return embedding as number[];
    },
    embedMany: async (inputs) => {
      const values = inputs.map((i) => i.text);
      const abortSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;

      const result = await (client as any).embeddings.generate(
        { input: values, model },
        abortSignal ? { fetchOptions: { signal: abortSignal } } : undefined
      );

      const embeddings = (result as any)?.data?.map(
        (item: { embedding?: number[] }) => item.embedding
      );

      if (!Array.isArray(embeddings) || embeddings.some((e) => !Array.isArray(e))) {
        throw new Error("Embeddings missing from OpenRouter response");
      }

      return embeddings as number[][];
    },
  };
};
