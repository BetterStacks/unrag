'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useCallback, type ComponentType } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  FileText,
  Image,
  Mic,
  Package,
  Puzzle,
  RefreshCw,
  Settings2,
  Share2,
  Sparkles,
  Video,
  Zap,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import {
  AmazonWebServicesDark,
  Cohere,
  Discord,
  Dropbox,
  GitHubDark,
  GitLab,
  Gemini,
  GoogleDrive,
  Linear,
  MicrosoftOneDrive,
  MicrosoftSharePoint,
  MicrosoftTeams,
  Notion,
  OpenAIDark,
  Slack,
  VercelDark,
} from '@ridemountainpig/svgl-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NextStepsDialog } from './next-steps-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StoreAdapter = 'drizzle' | 'prisma' | 'raw-sql';
type EmbeddingType = 'text' | 'multimodal';

type WizardStateV1 = {
  v: 1;
  install: {
    installDir: string;
    storeAdapter: StoreAdapter;
    aliasBase: string;
  };
  modules: {
    extractors: string[];
    connectors: string[];
  };
  defaults: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
  };
  embedding: {
    type: EmbeddingType;
    model: string;
    timeoutMs: number;
  };
  storage: {
    storeChunkContent: boolean;
    storeDocumentContent: boolean;
  };
};

type RegistryManifest = {
  version: number;
  extractors: Array<{
    id: string;
    label?: string;
    group?: string;
    description?: string;
    hint?: string;
    workerOnly?: boolean;
    configComplexity?: string;
    docsPath?: string | null;
  }>;
  connectors: Array<{
    id: string;
    displayName?: string;
    description?: string;
    status?: 'available' | 'coming-soon';
    types?: string[];
    docsPath?: string | null;
  }>;
};

type Step = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Defaults
// ─────────────────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  { id: 'install', label: 'Project Setup', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'database', label: 'Database', icon: <Database className="w-4 h-4" /> },
  { id: 'embedding', label: 'Embeddings', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'extractors', label: 'Extractors', icon: <Puzzle className="w-4 h-4" /> },
  { id: 'connectors', label: 'Connectors', icon: <Package className="w-4 h-4" /> },
  { id: 'review', label: 'Review', icon: <Zap className="w-4 h-4" /> },
];

const DEFAULT_STATE: WizardStateV1 = {
  v: 1,
  install: {
    installDir: 'lib/unrag',
    storeAdapter: 'drizzle',
    aliasBase: '@unrag',
  },
  modules: {
    extractors: [],
    connectors: [],
  },
  defaults: {
    chunkSize: 200,
    chunkOverlap: 40,
    topK: 8,
  },
  embedding: {
    type: 'text',
    model: 'openai/text-embedding-3-small',
    timeoutMs: 15_000,
  },
  storage: {
    storeChunkContent: true,
    storeDocumentContent: true,
  },
};

const STORE_ADAPTERS: Array<{
  id: StoreAdapter;
  name: string;
  description: string;
}> = [
  {
    id: 'drizzle',
    name: 'Drizzle ORM',
    description: 'Type-safe SQL with migrations. Recommended for new projects.',
  },
  {
    id: 'prisma',
    name: 'Prisma',
    description: 'Popular ORM with schema-first approach and studio UI.',
  },
  {
    id: 'raw-sql',
    name: 'Raw SQL',
    description: 'Direct pg Pool queries. Maximum control, minimal abstraction.',
  },
];

const EMBEDDING_TYPES: Array<{
  id: EmbeddingType;
  name: string;
  description: string;
}> = [
  {
    id: 'text',
    name: 'Text Only',
    description:
      'You can still extract text from PDFs/images/audio/video via extractors (next step).',
  },
  {
    id: 'multimodal',
    name: 'Multimodal',
    description: 'Text + image embeddings. Required for image-based retrieval.',
  },
];

type EmbeddingModelOption = {
  id: string;
  label: string;
  providerLabel: string;
  icon: ComponentType<any>;
  supports: EmbeddingType[]; // what the embedding output can represent
};

const EMBEDDING_MODEL_OPTIONS: EmbeddingModelOption[] = [
  {
    id: 'openai/text-embedding-3-small',
    label: 'openai/text-embedding-3-small',
    providerLabel: 'OpenAI',
    icon: OpenAIDark,
    supports: ['text'],
  },
  {
    id: 'openai/text-embedding-3-large',
    label: 'openai/text-embedding-3-large',
    providerLabel: 'OpenAI',
    icon: OpenAIDark,
    supports: ['text'],
  },
  {
    id: 'cohere/embed-v4.0',
    label: 'cohere/embed-v4.0',
    providerLabel: 'Cohere',
    icon: Cohere,
    // Cohere embed-v4 supports both text + image embeddings
    supports: ['text', 'multimodal'],
  },
  {
    id: 'google/text-embedding-004',
    label: 'google/text-embedding-004',
    providerLabel: 'Google',
    icon: Gemini,
    supports: ['text'],
  },
  {
    id: 'amazon/titan-embed-text-v2',
    label: 'amazon/titan-embed-text-v2',
    providerLabel: 'Amazon Web Services',
    icon: AmazonWebServicesDark,
    supports: ['text'],
  },
];

const CUSTOM_MODEL_VALUE = '__custom__';

const DEFAULT_MULTIMODAL_MODEL =
  EMBEDDING_MODEL_OPTIONS.find((m) => m.supports.includes('multimodal'))?.id ??
  'cohere/embed-v4.0';

const RECOMMENDED_DEFAULTS = {
  chunkSize: 200,
  chunkOverlap: 40,
  topK: 8,
} as const;

const CHUNK_SIZE_OPTIONS = [64, 96, 128, 160, 200, 240, 300, 400, 512, 768, 1024, 1536, 2048];
const CHUNK_OVERLAP_OPTIONS = [0, 10, 20, 30, 40, 60, 80, 100, 150, 200, 256];
const TOP_K_OPTIONS = [3, 5, 8, 10, 12, 15, 20, 30, 50, 100];

const EXTRACTOR_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  audio: <Mic className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  file: <FileText className="w-4 h-4" />,
};

const connectorLogoById: Record<string, ComponentType<any>> = {
  notion: Notion,
  'google-drive': GoogleDrive,
  github: GitHubDark,
  gitlab: GitLab,
  slack: Slack,
  discord: Discord,
  linear: Linear,
  dropbox: Dropbox,
  onedrive: MicrosoftOneDrive,
  teams: MicrosoftTeams,
  sharepoint: MicrosoftSharePoint,
};

// ─────────────────────────────────────────────────────────────────────────────
// Encoding / Decoding
// ─────────────────────────────────────────────────────────────────────────────

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64url: string) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeWizardState(state: WizardStateV1) {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

function decodeWizardState(encoded: string): WizardStateV1 | null {
  if (!encoded) return null;
  try {
    const bytes = fromBase64Url(encoded);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<WizardStateV1> | null;
    if (!parsed || parsed.v !== 1) return null;
    return parsed as WizardStateV1;
  } catch {
    return null;
  }
}

function normalizeState(s: WizardStateV1): WizardStateV1 {
  const installDir = String(s.install?.installDir ?? DEFAULT_STATE.install.installDir);
  const storeAdapter = (s.install?.storeAdapter ?? DEFAULT_STATE.install.storeAdapter) as StoreAdapter;
  const aliasBase = String(s.install?.aliasBase ?? DEFAULT_STATE.install.aliasBase);
  const extractors = Array.isArray(s.modules?.extractors) ? s.modules.extractors.map(String) : [];
  const connectors = Array.isArray(s.modules?.connectors) ? s.modules.connectors.map(String) : [];
  const chunkSize =
    Number(s.defaults?.chunkSize ?? DEFAULT_STATE.defaults.chunkSize) || DEFAULT_STATE.defaults.chunkSize;
  const chunkOverlap =
    Number(s.defaults?.chunkOverlap ?? DEFAULT_STATE.defaults.chunkOverlap) || DEFAULT_STATE.defaults.chunkOverlap;
  const topK = Number(s.defaults?.topK ?? DEFAULT_STATE.defaults.topK) || DEFAULT_STATE.defaults.topK;
  const embeddingType = (s.embedding?.type ?? DEFAULT_STATE.embedding.type) as EmbeddingType;
  const embeddingModel = String(s.embedding?.model ?? DEFAULT_STATE.embedding.model);
  const embeddingTimeoutMs =
    Number(s.embedding?.timeoutMs ?? DEFAULT_STATE.embedding.timeoutMs) || DEFAULT_STATE.embedding.timeoutMs;
  const storeChunkContent = Boolean(s.storage?.storeChunkContent ?? DEFAULT_STATE.storage.storeChunkContent);
  const storeDocumentContent = Boolean(s.storage?.storeDocumentContent ?? DEFAULT_STATE.storage.storeDocumentContent);

  return {
    v: 1,
    install: { installDir, storeAdapter, aliasBase },
    modules: { extractors, connectors },
    defaults: { chunkSize, chunkOverlap, topK },
    embedding: { type: embeddingType, model: embeddingModel, timeoutMs: embeddingTimeoutMs },
    storage: { storeChunkContent, storeDocumentContent },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function useWizardState() {
  const [encoded, setEncoded] = useQueryState('s', parseAsString.withDefault(''));
  const state = useMemo(() => {
    const decoded = decodeWizardState(encoded);
    return normalizeState(decoded ?? DEFAULT_STATE);
  }, [encoded]);

  const setState = useCallback(
    (updater: (prev: WizardStateV1) => WizardStateV1) => {
      const next = normalizeState(updater(state));
      setEncoded(encodeWizardState(next), { history: 'replace', shallow: true });
    },
    [state, setEncoded]
  );

  const reset = useCallback(() => {
    setEncoded(encodeWizardState(DEFAULT_STATE), { history: 'replace', shallow: true });
  }, [setEncoded]);

  return { state, setState, reset };
}

function toggleInList(list: string[], value: string) {
  const v = String(value);
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort();
}

function DocsIconLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-white/10 bg-white/[0.02] text-white/45 hover:text-white/80 hover:bg-white/[0.05] transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
      aria-label={label}
      title={label}
    >
      <ExternalLink className="w-3.5 h-3.5" />
    </Link>
  );
}

function ClickableCard({
  onClick,
  disabled,
  className,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled ? true : undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group relative w-full text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
        disabled && 'cursor-not-allowed',
        className
      )}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function SelectionCard({
  selected,
  onClick,
  title,
  description,
  disabled,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative w-full text-left rounded-xl border p-4 transition-all duration-200',
        'hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
        selected
          ? 'border-white/30 bg-white/[0.04]'
          : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.03]',
        disabled && 'opacity-50 cursor-not-allowed hover:border-white/[0.08] hover:bg-white/[0.02]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white/90">{title}</span>
            {badge && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 capitalize">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/50 leading-relaxed">{description}</p>
        </div>
        <div
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
            selected ? 'border-white bg-white' : 'border-white/20 group-hover:border-white/30'
          )}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-black" />}
        </div>
      </div>
    </button>
  );
}

function ExtractorCard({
  id,
  label,
  description,
  group,
  selected,
  onToggle,
  workerOnly,
  docsHref,
}: {
  id: string;
  label?: string;
  description?: string;
  group?: string;
  selected: boolean;
  onToggle: () => void;
  workerOnly?: boolean;
  docsHref?: string | null;
}) {
  const icon = EXTRACTOR_ICONS[group?.toLowerCase() ?? ''] ?? <FileText className="w-4 h-4" />;

  return (
    <ClickableCard
      onClick={onToggle}
      className={cn(
        'rounded-lg border p-3',
        'hover:border-white/20',
        selected
          ? 'border-white/25 bg-white/[0.05]'
          : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.03]'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
            selected ? 'bg-white/10 text-white' : 'bg-white/5 text-white/40'
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-white/90">{label || id}</span>
            {workerOnly && (
              <span className="text-[9px] px-1.5 py-0.5 rounded capitalize bg-amber-500/10 text-amber-400/80 border border-amber-500/20">
                worker
              </span>
            )}
            {docsHref ? (
              <div className="ml-auto">
                <DocsIconLink href={docsHref} label={`${label || id} docs`} />
              </div>
            ) : null}
          </div>
          {description && <p className="mt-0.5 text-xs text-white/40 line-clamp-2">{description}</p>}
        </div>
        <div
          className={cn(
            'w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all',
            selected ? 'border-white/40 bg-white text-black' : 'border-white/15 group-hover:border-white/25'
          )}
        >
          {selected && <Check className="w-3 h-3" strokeWidth={3} />}
        </div>
      </div>
    </ClickableCard>
  );
}

function ConnectorCard({
  id,
  displayName,
  description,
  status,
  docsHref,
  logo: Logo,
  selected,
  onToggle,
}: {
  id: string;
  displayName?: string;
  description?: string;
  status?: 'available' | 'coming-soon';
  docsHref?: string | null;
  logo?: ComponentType<any>;
  selected: boolean;
  onToggle: () => void;
}) {
  const isAvailable = status === 'available';

  return (
    <ClickableCard
      onClick={onToggle}
      disabled={!isAvailable}
      className={cn(
        'rounded-xl border p-4',
        selected ? 'border-white/25 bg-white/[0.05]' : 'border-white/[0.08] bg-white/[0.02]',
        isAvailable ? 'hover:border-white/20 hover:bg-white/[0.03]' : 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
            selected ? 'bg-white/10 text-white' : 'bg-white/5 text-white/40'
          )}
        >
          {Logo ? (
            <Logo
              width={18}
              height={18}
              className={cn('text-white/90', !selected && 'opacity-70')}
              aria-label={displayName || id}
            />
          ) : (
            <Package className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white/90">{displayName || id}</span>
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border capitalize',
                isAvailable ? 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'
              )}
            >
              {isAvailable ? 'available' : 'coming soon'}
            </span>
            {isAvailable && docsHref ? (
              <div className="ml-auto">
                <DocsIconLink href={docsHref} label={`${displayName || id} docs`} />
              </div>
            ) : null}
          </div>
          {description && <p className="mt-1 text-sm text-white/50">{description}</p>}
        </div>
        <div
          className={cn(
            'w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all',
            selected ? 'border-white/40 bg-white text-black' : 'border-white/15 group-hover:border-white/25'
          )}
        >
          {selected && <Check className="w-3 h-3" strokeWidth={3} />}
        </div>
      </div>
    </ClickableCard>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-white/90">{title}</h2>
      {description && <p className="mt-1 text-sm text-white/50">{description}</p>}
    </div>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm text-white/70">{label}</Label>
        {hint && <span className="text-xs text-white/30">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function RecommendedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10',
        className
      )}
    >
      Recommended
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function InstallWizardClient() {
  const { state, setState: setStateRaw, reset: resetRaw } = useWizardState();
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [presetId, setPresetId] = useQueryState('preset', parseAsString.withDefault(''));
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [copied, setCopied] = useState<'url' | 'command' | null>(null);
  const [pkgManager, setPkgManager] = useState<'bun' | 'npm' | 'pnpm' | 'yarn'>('bun');
  const [openExtractorGroups, setOpenExtractorGroups] = useState<Record<string, boolean>>({});
  const [nextStepsOpen, setNextStepsOpen] = useState(false);

  // Clear preset ID whenever state changes (preset becomes stale)
  const setState = useCallback(
    (updater: (prev: WizardStateV1) => WizardStateV1) => {
      if (presetId) {
        setPresetId(null, { history: 'replace', shallow: true });
      }
      setStateRaw(updater);
    },
    [presetId, setPresetId, setStateRaw]
  );

  const reset = useCallback(() => {
    if (presetId) {
      setPresetId(null, { history: 'replace', shallow: true });
    }
    resetRaw();
  }, [presetId, setPresetId, resetRaw]);

  const [manifest, setManifest] = useState<RegistryManifest | null>(null);
  const [forceCustomEmbeddingModel, setForceCustomEmbeddingModel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/manifest', { cache: 'force-cache' });
        if (!res.ok) return;
        const json = (await res.json()) as RegistryManifest;
        if (cancelled) return;
        setManifest(json);
      } catch {
        // ignore
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const extractorGroups = useMemo(() => {
    const byGroup = new Map<string, RegistryManifest['extractors']>();
    for (const ex of manifest?.extractors ?? []) {
      const group = String(ex.group ?? 'Other');
      byGroup.set(group, [...(byGroup.get(group) ?? []), ex]);
    }
    return Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [manifest]);

  const availableConnectors = useMemo(() => {
    return (manifest?.connectors ?? []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }, [manifest]);

  const extractorDocsById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const ex of manifest?.extractors ?? []) {
      m.set(String(ex.id), ex.docsPath ?? null);
    }
    return m;
  }, [manifest]);

  const connectorDocsById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of manifest?.connectors ?? []) {
      m.set(String(c.id), c.docsPath ?? null);
    }
    return m;
  }, [manifest]);

  const embeddingModelOptions = useMemo(() => {
    if (state.embedding.type === 'multimodal') {
      return EMBEDDING_MODEL_OPTIONS.filter((m) => m.supports.includes('multimodal'));
    }
    return EMBEDDING_MODEL_OPTIONS;
  }, [state.embedding.type]);

  const embeddingModelOptionById = useMemo(() => {
    const m = new Map<string, EmbeddingModelOption>();
    for (const o of EMBEDDING_MODEL_OPTIONS) m.set(o.id, o);
    return m;
  }, []);

  const selectedEmbeddingModelOption = embeddingModelOptionById.get(state.embedding.model);
  const isCustomEmbeddingModel = forceCustomEmbeddingModel || !selectedEmbeddingModelOption;
  const embeddingModelSelectValue = isCustomEmbeddingModel ? CUSTOM_MODEL_VALUE : state.embedding.model;

  useEffect(() => {
    if (state.embedding.type !== 'multimodal') return;
    if (!selectedEmbeddingModelOption) return;
    if (selectedEmbeddingModelOption.supports.includes('multimodal')) return;
    setForceCustomEmbeddingModel(false);
    setState((prev) => ({
      ...prev,
      embedding: { ...prev.embedding, model: DEFAULT_MULTIMODAL_MODEL },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.embedding.type]);

  const commandPreview = useMemo(() => {
    if (presetId) {
      return `bunx unrag@latest init --yes --preset ${presetId}`;
    }

    const args: string[] = ['bunx', 'unrag@latest', 'init', '--yes'];
    args.push('--store', state.install.storeAdapter);
    args.push('--dir', state.install.installDir);
    args.push('--alias', state.install.aliasBase);

    if (state.modules.extractors.length > 0) {
      args.push('--extractors', state.modules.extractors.join(','));
    }

    return args.join(' ');
  }, [state, presetId]);

  const installCommand = useMemo(() => {
    if (!presetId) return null;
    const base =
      pkgManager === 'bun'
        ? 'bunx'
        : pkgManager === 'pnpm'
          ? 'pnpm dlx'
          : pkgManager === 'yarn'
            ? 'yarn dlx'
            : 'npx';
    return `${base} unrag@latest init --yes --preset ${presetId}`;
  }, [pkgManager, presetId]);

  const summary = useMemo(() => {
    return {
      adapter: STORE_ADAPTERS.find((a) => a.id === state.install.storeAdapter)?.name ?? state.install.storeAdapter,
      embeddingType: state.embedding.type,
      extractorCount: state.modules.extractors.length,
      connectorCount: state.modules.connectors.length,
    };
  }, [state]);

  const handleCopy = async (type: 'url' | 'command') => {
    try {
      const text = type === 'url' ? window.location.href : (installCommand ?? commandPreview);
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleCreatePreset = async () => {
    setCreatingPreset(true);
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { id?: string };
      if (!json?.id) return;
      setPresetId(json.id, { history: 'replace', shallow: true });
    } finally {
      setCreatingPreset(false);
    }
  };

  const goToStep = (index: number) => {
    if (index >= 0 && index < STEPS.length) {
      setSlideDirection(index > currentStep ? 'right' : 'left');
      setCurrentStep(index);
    }
  };

  const currentStepId = STEPS[currentStep]?.id ?? 'install';
  const embeddingTriggerIcon = isCustomEmbeddingModel ? VercelDark : (selectedEmbeddingModelOption?.icon ?? VercelDark);
  const embeddingTriggerLabel = isCustomEmbeddingModel
    ? (state.embedding.model.trim() ? state.embedding.model : 'Custom model')
    : (selectedEmbeddingModelOption?.label ?? state.embedding.model);

  return (
    <div className="min-h-screen bg-[hsl(0,0%,3%)]">
      {installCommand ? (
        <NextStepsDialog
          open={nextStepsOpen}
          onOpenChange={setNextStepsOpen}
          state={state}
          manifest={manifest}
        />
      ) : null}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[hsl(0,0%,3%)]/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white/90 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            <div className="w-px h-5 bg-white/10" />
            <h1 className="text-sm font-medium text-white/80">Configure Installation</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy('url')}
              className="text-white/60 hover:text-white hover:bg-white/5"
            >
              <Share2 className="w-4 h-4" />
              {copied === 'url' ? 'Copied!' : 'Share'}
            </Button>
            <a
              href="/docs/getting-started/quickstart"
              target="_blank"
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white/90 transition-colors"
            >
              <span>Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-64 shrink-0 border-r border-white/[0.06] p-6">
          <div className="sticky top-20">
            <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-4">Steps</div>
            <nav className="space-y-1">
              {STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                  <button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : isCompleted
                          ? 'text-white/60 hover:text-white/80 hover:bg-white/[0.03]'
                          : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                    )}
                  >
                    <div
                      className={cn(
                        'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                        isActive
                          ? 'bg-white/10 text-white'
                          : isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-white/5 text-white/30'
                      )}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.icon}
                    </div>
                    <span className="font-medium">{step.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto text-white/40" />}
                  </button>
                );
              })}
            </nav>

            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="w-full justify-start text-white/40 hover:text-white/60 hover:bg-white/5"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset to defaults
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl">
            {currentStepId === 'install' && (
              <div
                className={cn(
                  'animate-in fade-in duration-300',
                  slideDirection === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                )}
              >
                {/* Welcome Hero */}
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-white/[0.08] to-white/[0.04] border border-white/[0.08] mb-4">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-white/70">Interactive Setup Wizard</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-white/95 mb-2">Configure your RAG pipeline</h2>
                  <p className="text-white/50 leading-relaxed">
                    This wizard will guide you through setting up Unrag in your project. Configure your database, embeddings, extractors, and connectors—then generate a single command to install everything.
                  </p>
                </div>

                {/* Project Configuration */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 className="w-4 h-4 text-white/50" />
                    <span className="text-sm font-medium text-white/70">Project Configuration</span>
                  </div>
                  <div className="space-y-5">
                    <FieldGroup label="Install directory" hint="Relative to project root">
                      <Input
                        value={state.install.installDir}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            install: { ...prev.install, installDir: e.target.value },
                          }))
                        }
                        className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-white/20"
                      />
                    </FieldGroup>

                    <FieldGroup label="Import alias" hint="TypeScript path alias">
                      <Input
                        value={state.install.aliasBase}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            install: { ...prev.install, aliasBase: e.target.value },
                          }))
                        }
                        className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-white/20"
                      />
                    </FieldGroup>
                  </div>
                </div>

                {/* Tech Stack badges */}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/30">Built with</span>
                  {['TypeScript', 'pgvector', 'AI SDK', 'Drizzle / Prisma'].map((tech) => (
                    <span
                      key={tech}
                      className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs font-medium text-white/50"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {currentStepId === 'database' && (
              <div
                className={cn(
                  'animate-in fade-in duration-300',
                  slideDirection === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                )}
              >
                <SectionHeader
                  title="Database Adapter"
                  description="Choose how Unrag will interact with your PostgreSQL database."
                />
                <div className="space-y-3">
                  {STORE_ADAPTERS.map((adapter) => (
                    <SelectionCard
                      key={adapter.id}
                      title={adapter.name}
                      description={adapter.description}
                      selected={state.install.storeAdapter === adapter.id}
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          install: { ...prev.install, storeAdapter: adapter.id },
                        }))
                      }
                      badge={adapter.id === 'drizzle' ? 'recommended' : undefined}
                    />
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-white/[0.06]">
                  <SectionHeader title="Storage Options" description="Control what content is persisted to the database." />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div>
                        <div className="font-medium text-white/90">Store chunk content</div>
                        <div className="text-sm text-white/50">Persist chunk text for retrieval results</div>
                      </div>
                      <Switch
                        checked={state.storage.storeChunkContent}
                        onCheckedChange={(checked) =>
                          setState((prev) => ({
                            ...prev,
                            storage: { ...prev.storage, storeChunkContent: checked },
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div>
                        <div className="font-medium text-white/90">Store document content</div>
                        <div className="text-sm text-white/50">Persist full document text</div>
                      </div>
                      <Switch
                        checked={state.storage.storeDocumentContent}
                        onCheckedChange={(checked) =>
                          setState((prev) => ({
                            ...prev,
                            storage: { ...prev.storage, storeDocumentContent: checked },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStepId === 'embedding' && (
              <div
                className={cn(
                  'animate-in fade-in duration-300',
                  slideDirection === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                )}
              >
                <SectionHeader title="Embedding Type" description="Choose the embedding strategy for your content." />
                <div className="space-y-3">
                  {EMBEDDING_TYPES.map((type) => (
                    <SelectionCard
                      key={type.id}
                      title={type.name}
                      description={type.description}
                      selected={state.embedding.type === type.id}
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          embedding: { ...prev.embedding, type: type.id },
                        }))
                      }
                    />
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-white/[0.06] space-y-6">
                  <FieldGroup
                    label="Embedding model"
                    hint={
                      state.embedding.type === 'multimodal'
                        ? 'Multimodal: only image-capable models shown'
                        : 'Choose a preset or use a custom model id'
                    }
                  >
                    <div className="space-y-3">
                      <Select
                        value={embeddingModelSelectValue}
                        onValueChange={(v) => {
                          if (v === CUSTOM_MODEL_VALUE) {
                            setForceCustomEmbeddingModel(true);
                            return;
                          }
                          setForceCustomEmbeddingModel(false);
                          setState((prev) => ({
                            ...prev,
                            embedding: { ...prev.embedding, model: v },
                          }));
                        }}
                      >
                        <SelectTrigger className="h-12 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.04] focus:ring-white/20">
                          <SelectValue>
                            <div className="inline-flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                {(() => {
                                  const Icon = embeddingTriggerIcon;
                                  return (
                                    <Icon
                                      width={16}
                                      height={16}
                                      className="text-white/90"
                                      aria-label="Model provider"
                                    />
                                  );
                                })()}
                              </div>
                              <span className="font-mono text-sm text-white/85">{embeddingTriggerLabel}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[hsl(0,0%,6%)] text-white">
                          {embeddingModelOptions.map((opt) => {
                            const Icon = opt.icon;
                            return (
                              <SelectItem
                                key={opt.id}
                                value={opt.id}
                                className="focus:bg-white/5 focus:text-white data-[state=checked]:text-white"
                              >
                                <span className="flex items-center gap-2 w-full">
                                  <span className="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                                    <Icon width={14} height={14} className="text-white/85" aria-label={opt.providerLabel} />
                                  </span>
                                  <span className="font-mono text-sm">{opt.label}</span>
                                  <span className="ml-auto text-xs text-white/35">{opt.providerLabel}</span>
                                </span>
                              </SelectItem>
                            );
                          })}
                          <SelectSeparator className="bg-white/10" />
                          <SelectItem
                            value={CUSTOM_MODEL_VALUE}
                            className="focus:bg-white/5 focus:text-white data-[state=checked]:text-white"
                          >
                            <span className="flex items-center gap-2 w-full">
                              <span className="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                                <VercelDark width={14} height={14} className="text-white/85" aria-label="Custom model" />
                              </span>
                              <span className="text-sm">Custom model…</span>
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {isCustomEmbeddingModel ? (
                        <div className="space-y-2">
                          <Input
                            value={state.embedding.model}
                            onChange={(e) => {
                              setForceCustomEmbeddingModel(true);
                              setState((prev) => ({
                                ...prev,
                                embedding: { ...prev.embedding, model: e.target.value },
                              }));
                            }}
                            placeholder="provider/model"
                            className="bg-white/[0.03] border-white/10 text-white font-mono text-sm placeholder:text-white/30 focus:border-white/20"
                          />
                          <div className="text-xs text-white/40">
                            {state.embedding.type === 'multimodal'
                              ? 'Make sure this model supports image embeddings.'
                              : 'Tip: this is the AI SDK model id used by the gateway.'}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </FieldGroup>

                  <div className="grid grid-cols-3 gap-4">
                    <FieldGroup label="Chunk size">
                      <Select
                        value={String(state.defaults.chunkSize)}
                        onValueChange={(v) =>
                          setState((prev) => ({
                            ...prev,
                            defaults: { ...prev.defaults, chunkSize: Number(v) },
                          }))
                        }
                      >
                        <SelectTrigger className="h-11 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.04] focus:ring-white/20">
                          <SelectValue>
                            <div className="flex items-center gap-2 w-full min-w-0">
                              <span className="font-mono text-sm">{state.defaults.chunkSize}</span>
                              {state.defaults.chunkSize === RECOMMENDED_DEFAULTS.chunkSize ? (
                                <RecommendedBadge className="ml-auto shrink-0" />
                              ) : null}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[hsl(0,0%,6%)] text-white">
                          {CHUNK_SIZE_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)} className="focus:bg-white/5 focus:text-white">
                              <div className="flex items-center gap-2 w-full min-w-0">
                                <span className="font-mono text-sm">{n}</span>
                                {n === RECOMMENDED_DEFAULTS.chunkSize ? (
                                  <RecommendedBadge className="ml-auto shrink-0" />
                                ) : null}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                    <FieldGroup label="Overlap">
                      <Select
                        value={String(state.defaults.chunkOverlap)}
                        onValueChange={(v) =>
                          setState((prev) => ({
                            ...prev,
                            defaults: { ...prev.defaults, chunkOverlap: Number(v) },
                          }))
                        }
                      >
                        <SelectTrigger className="h-11 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.04] focus:ring-white/20">
                          <SelectValue>
                            <div className="flex items-center gap-2 w-full min-w-0">
                              <span className="font-mono text-sm">{state.defaults.chunkOverlap}</span>
                              {state.defaults.chunkOverlap === RECOMMENDED_DEFAULTS.chunkOverlap ? (
                                <RecommendedBadge className="ml-auto shrink-0" />
                              ) : null}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[hsl(0,0%,6%)] text-white">
                          {CHUNK_OVERLAP_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)} className="focus:bg-white/5 focus:text-white">
                              <div className="flex items-center gap-2 w-full min-w-0">
                                <span className="font-mono text-sm">{n}</span>
                                {n === RECOMMENDED_DEFAULTS.chunkOverlap ? (
                                  <RecommendedBadge className="ml-auto shrink-0" />
                                ) : null}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                    <FieldGroup label="Top K">
                      <Select
                        value={String(state.defaults.topK)}
                        onValueChange={(v) =>
                          setState((prev) => ({
                            ...prev,
                            defaults: { ...prev.defaults, topK: Number(v) },
                          }))
                        }
                      >
                        <SelectTrigger className="h-11 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.04] focus:ring-white/20">
                          <SelectValue>
                            <div className="flex items-center gap-2 w-full min-w-0">
                              <span className="font-mono text-sm">{state.defaults.topK}</span>
                              {state.defaults.topK === RECOMMENDED_DEFAULTS.topK ? (
                                <RecommendedBadge className="ml-auto shrink-0" />
                              ) : null}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[hsl(0,0%,6%)] text-white">
                          {TOP_K_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)} className="focus:bg-white/5 focus:text-white">
                              <div className="flex items-center gap-2 w-full min-w-0">
                                <span className="font-mono text-sm">{n}</span>
                                {n === RECOMMENDED_DEFAULTS.topK ? (
                                  <RecommendedBadge className="ml-auto shrink-0" />
                                ) : null}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <div className="font-medium text-amber-400/90">Environment variable required</div>
                        <div className="mt-1 text-sm text-amber-400/60">
                          Set <code className="font-mono text-amber-400/80">AI_GATEWAY_API_KEY</code> in your environment to use embeddings.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStepId === 'extractors' && (
              <div
                className={cn(
                  'animate-in fade-in duration-300',
                  slideDirection === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                )}
              >
                <SectionHeader title="Rich Media Extractors" description="Select extractors to process PDFs, images, audio, and video content." />
                {!manifest ? (
                  <div className="flex items-center justify-center h-40 text-white/40">Loading extractors...</div>
                ) : (
                  <div className="space-y-8">
                    {extractorGroups.map(([group, exs]) => (
                      <div key={group}>
                        {(() => {
                          const isOpen = openExtractorGroups[group] ?? true;
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenExtractorGroups((prev) => ({
                                    ...prev,
                                    [group]: !(prev[group] ?? true),
                                  }))
                                }
                                className="w-full flex items-center gap-2 mb-3 text-left"
                                aria-expanded={isOpen}
                              >
                                <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-white/40">
                                  {EXTRACTOR_ICONS[group.toLowerCase()] ?? <FileText className="w-3.5 h-3.5" />}
                                </div>
                                <span className="text-sm font-medium text-white/60">{group}</span>
                                <span className="text-xs text-white/30">({exs.length})</span>
                                <ChevronDown
                                  className={cn(
                                    'w-4 h-4 ml-auto text-white/35 transition-transform duration-200',
                                    isOpen && 'rotate-180'
                                  )}
                                />
                              </button>

                              <div className={cn('grid transition-all duration-300', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                                <div className="min-h-0 overflow-hidden">
                                  <div className="grid gap-2">
                                    {exs.map((ex) => {
                                      const id = String(ex.id);
                                      return (
                                        <ExtractorCard
                                          key={id}
                                          id={id}
                                          label={ex.label}
                                          description={ex.description}
                                          group={ex.group}
                                          workerOnly={ex.workerOnly}
                                          docsHref={ex.docsPath ?? null}
                                          selected={state.modules.extractors.includes(id)}
                                          onToggle={() =>
                                            setState((prev) => ({
                                              ...prev,
                                              modules: {
                                                ...prev.modules,
                                                extractors: toggleInList(prev.modules.extractors, id),
                                              },
                                            }))
                                          }
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentStepId === 'connectors' && (
              <div
                className={cn(
                  'animate-in fade-in duration-300',
                  slideDirection === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                )}
              >
                <SectionHeader title="Data Connectors" description="Install connectors to sync data from external sources." />
                {!manifest ? (
                  <div className="flex items-center justify-center h-40 text-white/40">Loading connectors...</div>
                ) : (
                  <div className="space-y-3">
                    {availableConnectors.map((c) => {
                      const id = String(c.id);
                      return (
                        <ConnectorCard
                          key={id}
                          id={id}
                          displayName={c.displayName}
                          description={c.description}
                          status={c.status}
                          docsHref={c.docsPath ?? null}
                          logo={connectorLogoById[id]}
                          selected={state.modules.connectors.includes(id)}
                          onToggle={() =>
                            setState((prev) => ({
                              ...prev,
                              modules: { ...prev.modules, connectors: toggleInList(prev.modules.connectors, id) },
                            }))
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {currentStepId === 'review' && (
              <div
                className={cn(
                  'animate-in fade-in duration-300',
                  slideDirection === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                )}
              >
                <SectionHeader title="Review & Install" description="Review your configuration and generate the install command." />

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-2">Database</div>
                      <div className="text-lg font-medium text-white/90">{summary.adapter}</div>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-2">Embeddings</div>
                      <div className="text-lg font-medium text-white/90 capitalize">{summary.embeddingType}</div>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-2">Extractors</div>
                      <div className="text-lg font-medium text-white/90">{summary.extractorCount} selected</div>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-2">Connectors</div>
                      <div className="text-lg font-medium text-white/90">{summary.connectorCount} selected</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-black/40 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white/40">Install Command</span>
                        <div className="w-px h-4 bg-white/10" />
                        <div className="flex items-center gap-1.5">
                          {(['bun', 'pnpm', 'npm', 'yarn'] as const).map((pm) => (
                            <button
                              key={pm}
                              type="button"
                              onClick={() => setPkgManager(pm)}
                              className={cn(
                                'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                                pkgManager === pm
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                              )}
                            >
                              {pm}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy('command')}
                        disabled={!installCommand}
                        className="h-7 px-2 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied === 'command' ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                    <div className="p-4">
                      {installCommand ? (
                        <code className="block font-mono text-sm text-lime-400 break-all">{installCommand}</code>
                      ) : (
                        <div className="text-sm text-white/45 leading-relaxed">
                          Create a preset to generate the installation command. This keeps the command fully deterministic and includes all configuration.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {!presetId && (
                      <Button onClick={handleCreatePreset} disabled={creatingPreset} variant="cta">
                        {creatingPreset ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            Create Preset
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => handleCopy('url')}
                      className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                    >
                      <Share2 className="w-4 h-4" />
                      {copied === 'url' ? 'Copied!' : 'Share URL'}
                    </Button>
                  </div>

                  {presetId && (
                    <div className="rounded-xl border border-white/20 bg-white/[0.03] p-5 shadow-[0_0_24px_-6px_rgba(255,255,255,0.08)]">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-semibold text-white">Preset created</div>
                          <div className="mt-1 text-sm text-white/60">
                            Your configuration is saved as preset{' '}
                            <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/90">{presetId}</code>.
                            The command above includes this preset ID.
                          </div>
                          {installCommand ? (
                            <div className="mt-4">
                              <Button
                                size="sm"
                                variant="cta"
                                onClick={() => setNextStepsOpen(true)}
                              >
                                Open next steps
                                <ChevronRight className="w-4 h-4 ml-2" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-12 pt-6 border-t border-white/[0.06]">
              <Button
                variant="ghost"
                onClick={() => goToStep(currentStep - 1)}
                disabled={currentStep === 0}
                className={cn('text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30', currentStep === 0 && 'invisible')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToStep(index)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-all',
                      index === currentStep
                        ? 'bg-white w-6'
                        : index < currentStep
                          ? 'bg-white/40 hover:bg-white/60'
                          : 'bg-white/20 hover:bg-white/30'
                    )}
                  />
                ))}
              </div>
              <Button
                onClick={() => goToStep(currentStep + 1)}
                className={cn(currentStep === STEPS.length - 1 && 'invisible')}
                variant="cta"
                size="sm"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </main>

        <aside className="w-96 shrink-0 border-l border-white/[0.06] p-6 hidden xl:block">
          <div className="sticky top-20">
            <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-4">Live Preview</div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Directory</span>
                <span className="font-mono text-white/80">{state.install.installDir}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Adapter</span>
                <span className="text-white/80">{state.install.storeAdapter}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Embedding</span>
                <span className="text-white/80 capitalize">{state.embedding.type}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Extractors</span>
                <span className="text-white/80">{state.modules.extractors.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Connectors</span>
                <span className="text-white/80">{state.modules.connectors.length}</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-black/40 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-1.5">
                  {(['bun', 'pnpm', 'npm', 'yarn'] as const).map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setPkgManager(pm)}
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                        pkgManager === pm ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                      )}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('command')}
                  disabled={!installCommand}
                  className={cn(
                    'inline-flex items-center gap-2 px-2 py-1 rounded-md transition-colors',
                    installCommand ? 'text-white/55 hover:text-white hover:bg-white/[0.04]' : 'text-white/25 cursor-not-allowed'
                  )}
                >
                  <Copy className="w-4 h-4" />
                  <span className="text-xs font-medium">{copied === 'command' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-3">
                {installCommand ? (
                  <div className="space-y-3">
                    <code className="block font-mono text-xs text-lime-400 break-all leading-relaxed">{installCommand}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNextStepsOpen(true)}
                      className="w-full border-white/10 text-white/75 hover:text-white hover:bg-white/5"
                    >
                      Next steps
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-white/45 leading-relaxed">
                      Create a preset to generate the installation command. Creating a preset saves the config so you can come back to it later.
                    </div>
                    <Button size="sm" disabled={creatingPreset} onClick={handleCreatePreset} variant="cta" className="w-full">
                      {creatingPreset ? 'Creating…' : 'Create preset'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {(state.modules.extractors.length > 0 || state.modules.connectors.length > 0) && (
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                {state.modules.extractors.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-white/30 mb-2">Extractors</div>
                    <div className="flex flex-wrap gap-1.5">
                      {state.modules.extractors.map((id) => {
                        const href = extractorDocsById.get(id) ?? '/docs/extractors';
                        return (
                          <Link
                            key={id}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2 py-1 rounded bg-white/5 text-white/60 font-mono transition-colors hover:bg-white/10 hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                            title="Open docs"
                            aria-label={`Open docs for ${id}`}
                          >
                            {id.split('-').join(':')}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                {state.modules.connectors.length > 0 && (
                  <div>
                    <div className="text-xs text-white/30 mb-2">Connectors</div>
                    <div className="flex flex-wrap gap-1.5">
                      {state.modules.connectors.map((id) => {
                        const href = connectorDocsById.get(id) ?? '/docs/connectors';
                        return (
                          <Link
                            key={id}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2 py-1 rounded bg-white/5 text-white/60 font-mono capitalize transition-colors hover:bg-white/10 hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                            title="Open docs"
                            aria-label={`Open docs for ${id}`}
                          >
                            {id.split('-').join(' ')}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}


