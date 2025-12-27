import Link from "next/link";
import * as React from "react";
import {
  KeyRound,
  Puzzle,
  Sparkles,
  Copy,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { EmbeddingProviderName, RegistryManifest, WizardStateV1 } from "./wizard-types";

function DocLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center text-xs text-white/55 hover:text-white/85 transition-colors"
    >
      {children}
    </Link>
  );
}

function adapterDocHref(storeAdapter: WizardStateV1["install"]["storeAdapter"]) {
  if (storeAdapter === "drizzle") return "/docs/adapters/drizzle-postgres-pgvector";
  if (storeAdapter === "prisma") return "/docs/adapters/prisma-postgres-pgvector";
  return "/docs/adapters/raw-sql-postgres-pgvector";
}

function adapterLabel(storeAdapter: WizardStateV1["install"]["storeAdapter"]) {
  if (storeAdapter === "drizzle") return "Drizzle ORM";
  if (storeAdapter === "prisma") return "Prisma";
  return "Raw SQL";
}

function providerDocsHref(provider: EmbeddingProviderName) {
  if (provider === "ai") return "/docs/providers/ai-gateway";
  if (provider === "openai") return "/docs/providers/openai";
  if (provider === "google") return "/docs/providers/google";
  if (provider === "openrouter") return "/docs/providers/openrouter";
  if (provider === "azure") return "/docs/providers/azure";
  if (provider === "vertex") return "/docs/providers/vertex";
  if (provider === "bedrock") return "/docs/providers/bedrock";
  if (provider === "cohere") return "/docs/providers/cohere";
  if (provider === "mistral") return "/docs/providers/mistral";
  if (provider === "together") return "/docs/providers/together";
  if (provider === "ollama") return "/docs/providers/ollama";
  if (provider === "voyage") return "/docs/providers/voyage";
  return "/docs/providers";
}

function providerLabel(provider: EmbeddingProviderName) {
  if (provider === "ai") return "Vercel AI Gateway";
  if (provider === "openai") return "OpenAI";
  if (provider === "google") return "Google AI (Gemini)";
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "azure") return "Azure OpenAI";
  if (provider === "vertex") return "Vertex AI";
  if (provider === "bedrock") return "AWS Bedrock";
  if (provider === "cohere") return "Cohere";
  if (provider === "mistral") return "Mistral";
  if (provider === "together") return "Together.ai";
  if (provider === "ollama") return "Ollama";
  if (provider === "voyage") return "Voyage AI";
  return "Custom";
}

type EnvVarMeta = {
  name: string;
  required: boolean;
  description: string;
  docsHref?: string;
};

function embeddingEnvVars(provider: EmbeddingProviderName): EnvVarMeta[] {
  const docsHref = providerDocsHref(provider);
  if (provider === "ai") {
    return [
      {
        name: "AI_GATEWAY_API_KEY",
        required: true,
        description: "Required by the AI SDK when using Vercel AI Gateway.",
        docsHref,
      },
      {
        name: "AI_GATEWAY_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: openai/text-embedding-3-small).",
        docsHref,
      },
    ];
  }
  if (provider === "openai") {
    return [
      { name: "OPENAI_API_KEY", required: true, description: "OpenAI API key.", docsHref },
      {
        name: "OPENAI_EMBEDDING_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: text-embedding-3-small).",
        docsHref,
      },
    ];
  }
  if (provider === "google") {
    return [
      { name: "GOOGLE_GENERATIVE_AI_API_KEY", required: true, description: "Google AI Studio API key.", docsHref },
      {
        name: "GOOGLE_GENERATIVE_AI_EMBEDDING_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: gemini-embedding-001).",
        docsHref,
      },
    ];
  }
  if (provider === "openrouter") {
    return [
      { name: "OPENROUTER_API_KEY", required: true, description: "OpenRouter API key.", docsHref },
      {
        name: "OPENROUTER_EMBEDDING_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: text-embedding-3-small).",
        docsHref,
      },
    ];
  }
  if (provider === "cohere") {
    return [
      { name: "COHERE_API_KEY", required: true, description: "Cohere API key.", docsHref },
      {
        name: "COHERE_EMBEDDING_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: embed-english-v3.0).",
        docsHref,
      },
    ];
  }
  if (provider === "mistral") {
    return [
      { name: "MISTRAL_API_KEY", required: true, description: "Mistral API key.", docsHref },
      {
        name: "MISTRAL_EMBEDDING_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: mistral-embed).",
        docsHref,
      },
    ];
  }
  if (provider === "together") {
    return [
      { name: "TOGETHER_AI_API_KEY", required: true, description: "Together.ai API key.", docsHref },
      {
        name: "TOGETHER_AI_EMBEDDING_MODEL",
        required: false,
        description:
          "Optional override for the embedding model (default: togethercomputer/m2-bert-80M-2k-retrieval).",
        docsHref,
      },
    ];
  }
  if (provider === "voyage") {
    return [
      { name: "VOYAGE_API_KEY", required: true, description: "Voyage API key.", docsHref },
      {
        name: "VOYAGE_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: voyage-3.5-lite).",
        docsHref,
      },
    ];
  }
  if (provider === "ollama") {
    return [
      {
        name: "OLLAMA_EMBEDDING_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: nomic-embed-text).",
        docsHref,
      },
    ];
  }
  if (provider === "azure") {
    return [
      { name: "AZURE_OPENAI_API_KEY", required: true, description: "Azure OpenAI API key.", docsHref },
      { name: "AZURE_RESOURCE_NAME", required: true, description: "Azure resource name (e.g. my-resource).", docsHref },
      {
        name: "AZURE_EMBEDDING_MODEL",
        required: false,
        description: "Optional override for the embedding model/deployment (default: text-embedding-3-small).",
        docsHref,
      },
    ];
  }
  if (provider === "vertex") {
    return [
      {
        name: "GOOGLE_APPLICATION_CREDENTIALS",
        required: false,
        description: "Service account JSON path (required outside GCP).",
        docsHref,
      },
      {
        name: "GOOGLE_VERTEX_EMBEDDING_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: text-embedding-004).",
        docsHref,
      },
    ];
  }
  if (provider === "bedrock") {
    return [
      { name: "AWS_REGION", required: true, description: "AWS region for Bedrock.", docsHref },
      {
        name: "AWS_ACCESS_KEY_ID",
        required: false,
        description: "AWS credentials (required outside AWS).",
        docsHref,
      },
      {
        name: "AWS_SECRET_ACCESS_KEY",
        required: false,
        description: "AWS credentials (required outside AWS).",
        docsHref,
      },
      {
        name: "BEDROCK_EMBEDDING_MODEL",
        required: false,
        description: "Optional override for the embedding model (default: amazon.titan-embed-text-v2:0).",
        docsHref,
      },
    ];
  }
  return [];
}

function getSelectedExtractorInfo(manifest: RegistryManifest | null, ids: string[]) {
  const byId = new Map<string, RegistryManifest["extractors"][number]>();
  for (const ex of manifest?.extractors ?? []) byId.set(String(ex.id), ex);
  return ids.map((id) => ({ id, meta: byId.get(id) })).sort((a, b) => a.id.localeCompare(b.id));
}

function getSelectedConnectorInfo(manifest: RegistryManifest | null, ids: string[]) {
  const byId = new Map<string, RegistryManifest["connectors"][number]>();
  for (const c of manifest?.connectors ?? []) byId.set(String(c.id), c);
  return ids.map((id) => ({ id, meta: byId.get(id) })).sort((a, b) => a.id.localeCompare(b.id));
}

function StepCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white/70">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-white/85">{title}</div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
          {description ? <div className="mt-1 text-sm text-white/50 leading-relaxed">{description}</div> : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function NextStepsDialog({
  open,
  onOpenChange,
  state,
  manifest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: WizardStateV1;
  manifest: RegistryManifest | null;
}) {
  const [copiedEnv, setCopiedEnv] = React.useState(false);
  const [copiedSnippet, setCopiedSnippet] = React.useState(false);

  const adapterDocs = adapterDocHref(state.install.storeAdapter);
  const extractorInfo = getSelectedExtractorInfo(manifest, state.modules.extractors);
  const connectorInfo = getSelectedConnectorInfo(manifest, state.modules.connectors);
  const connectorsWithEnv = connectorInfo.filter((c) => (c.meta?.envVars?.length ?? 0) > 0);
  const selectedEmbeddingProvider = state.embedding.provider ?? "ai";
  const embeddingVars = React.useMemo(
    () => embeddingEnvVars(selectedEmbeddingProvider),
    [selectedEmbeddingProvider]
  );

  const selectedExtractorGroups = new Set<string>(
    extractorInfo.map((x) => String(x.meta?.group ?? "")).filter(Boolean)
  );
  const hasImageExtractor = selectedExtractorGroups.has("Image") || selectedExtractorGroups.has("image");

  const workerOnlyExtractors = extractorInfo.filter(
    (x) => x.meta?.workerOnly || x.meta?.configComplexity === "advanced"
  );

  const envVarsToCopy = React.useMemo(() => {
    const unique = new Map<string, { required?: boolean }>();
    unique.set("DATABASE_URL", { required: true });
    for (const v of embeddingVars) {
      unique.set(v.name, { required: v.required });
    }
    for (const c of connectorsWithEnv) {
      for (const v of c.meta?.envVars ?? []) {
        unique.set(v.name, { required: v.required });
      }
    }
    // required first, then alpha
    const entries = Array.from(unique.entries()).sort(([aName, aMeta], [bName, bMeta]) => {
      const aReq = aMeta.required ? 0 : 1;
      const bReq = bMeta.required ? 0 : 1;
      if (aReq !== bReq) return aReq - bReq;
      return aName.localeCompare(bName);
    });
    return entries.map(([name]) => name);
  }, [connectorsWithEnv, embeddingVars]);

  const retrievalSnippet = React.useMemo(() => {
    const topK = state.defaults.topK;
    return `// app/api/search/route.ts
import { createUnragEngine } from "@unrag/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (!query) {
    return Response.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const engine = createUnragEngine();
  const result = await engine.retrieve({ query, topK: ${topK} });

  return Response.json(result);
}
`;
  }, [state.defaults.topK]);

  const copyToClipboard = async (text: string, kind: "env" | "snippet") => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "env") {
        setCopiedEnv(true);
        setTimeout(() => setCopiedEnv(false), 1500);
      } else {
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 1500);
      }
    } catch {
      // ignore
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Next steps</DialogTitle>
          <DialogDescription className="max-w-xl">
            You are almost done. We now have the necessary source code in our codebase. Do these quick steps to set secrets and ship your first retrieval endpoint.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <StepCard
            icon={<KeyRound className="w-4 h-4" />}
            title="1) Set environment variables"
            description="Presets never store secrets. Set these in your deployment environment (and locally for dev)."
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(envVarsToCopy.map((n) => `${n}=`).join("\n"), "env")}
                className="h-7 px-2 text-white/55 hover:text-white hover:bg-white/5"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedEnv ? "Copied" : "Copy all"}
              </Button>
            }
          >
            <div className="space-y-2">
              <div className="rounded-lg border border-white/[0.08] bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white/80">Embedding provider</div>
                  <DocLink href={providerDocsHref(selectedEmbeddingProvider)}>
                    {providerLabel(selectedEmbeddingProvider)} docs
                  </DocLink>
                </div>
                <div className="mt-1 text-xs text-white/45">
                  Your wizard selection uses <span className="text-white/70">{providerLabel(selectedEmbeddingProvider)}</span>.
                  Set these variables to enable embeddings.
                </div>
                <div className="mt-3 space-y-2">
                  {embeddingVars.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-start justify-between gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs text-white/85">{v.name}</code>
                          {v.required ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              required
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                              optional
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-white/45">{v.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <code className="font-mono text-xs text-white/85">DATABASE_URL</code>
                  <span className="text-xs text-white/35">required for Postgres</span>
                </div>
                <div className="mt-1 text-xs text-white/45">
                  Connection string to your PostgreSQL + pgvector database.
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <DocLink href="/docs/getting-started/database">Database setup</DocLink>
                  <DocLink href={adapterDocs}>{adapterLabel(state.install.storeAdapter)} adapter</DocLink>
                </div>
              </div>
            </div>

            {connectorsWithEnv.length > 0 ? (
              <div className="mt-4">
                <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-2">
                  Connector env vars
                </div>
                <div className="space-y-2">
                  {connectorsWithEnv.map(({ id, meta }) => {
                    const name = meta?.displayName ?? id;
                    const href = meta?.docsPath ?? "/docs/connectors";
                    return (
                      <div
                        key={id}
                        className="rounded-lg border border-white/[0.08] bg-black/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white/80">{name}</div>
                          <DocLink href={href}>Docs</DocLink>
                        </div>
                        <div className="mt-2 space-y-2">
                          {(meta?.envVars ?? []).map((v) => (
                            <div
                              key={v.name}
                              className="flex items-start justify-between gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <code className="font-mono text-xs text-white/85">{v.name}</code>
                                  {v.required ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                      required
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                                      optional
                                    </span>
                                  )}
                                </div>
                                {v.notes ? (
                                  <div className="mt-1 text-xs text-white/45">{v.notes}</div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </StepCard>

          {workerOnlyExtractors.length > 0 ? (
            <StepCard
              icon={<Puzzle className="w-4 h-4" />}
              title={`2) Worker-only extractors (${workerOnlyExtractors.length})`}
              description="These extractors require additional runtime setup (binaries/worker environment). If you’re not using them, you can ignore this step."
            >
              <div className="space-y-2">
                {workerOnlyExtractors.map(({ id, meta }) => {
                  const href = meta?.docsPath ?? "/docs/extractors";
                  return (
                    <div
                      key={id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-white/80 truncate">{meta?.label ?? id}</div>
                        <div className="text-xs text-white/40 truncate">{meta?.description ?? id}</div>
                      </div>
                      <DocLink href={href}>Docs</DocLink>
                    </div>
                  );
                })}
              </div>
            </StepCard>
          ) : null}

          <StepCard
            icon={<Sparkles className="w-4 h-4" />}
            title={workerOnlyExtractors.length > 0 ? "3) Add your first retrieval endpoint" : "2) Add your first retrieval endpoint"}
            description="Create a simple search API route and verify retrieval works end-to-end."
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(retrievalSnippet, "snippet")}
                className="h-7 px-2 text-white/55 hover:text-white hover:bg-white/5"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                {copiedSnippet ? "Copied" : "Copy"}
              </Button>
            }
          >
            <div className="rounded-lg border border-white/[0.08] bg-black/40 overflow-hidden">
              <div className="px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="text-xs font-medium text-white/40">Next.js Route Handler</span>
              </div>
              <div className="p-3">
                <CodeBlock code={retrievalSnippet} highlight={[0, 1, 3, 4, 10, 11, 13]} />
              </div>
            </div>
            <div className="mt-2 text-xs text-white/45">
              Try it: <code className="font-mono text-white/70">/api/search?q=how+do+I+install</code>
            </div>
            <div className="mt-4">
              <Button asChild variant="cta" size="sm">
                <Link href="/docs/getting-started/first-retrieval" target="_blank" rel="noreferrer">
                  More patterns
                </Link>
              </Button>
            </div>
          </StepCard>
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


