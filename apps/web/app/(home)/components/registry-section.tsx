'use client';

import Link from 'next/link';
import { useState, useMemo, type ComponentType, type SVGProps } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type ColumnFiltersState,
  type FilterFn,
} from '@tanstack/react-table';
import { ArrowSquareOut } from '@phosphor-icons/react';
import {
  AmazonWebServicesDark,
  CloudflareWorkers,
  Cohere,
  Discord,
  Dropbox,
  Gemini,
  GitHubDark,
  GitLab,
  Groq,
  GoogleCloud,
  GoogleDrive,
  HuggingFace,
  Linear,
  MicrosoftAzure,
  MicrosoftOneDrive,
  MicrosoftSharePoint,
  MicrosoftTeams,
  MistralAI,
  Notion,
  OllamaDark,
  OpenAIDark,
  OpenRouterDark,
  PerplexityAI,
  ReplicateDark,
  Salesforce,
  Slack,
  TogetherAIDark,
  VercelDark,
  XAIDark
} from '@ridemountainpig/svgl-react';
import { CopyButton } from './copy-button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Extractor = {
  name: string;
  fileTypes: string[];
  inputMode: string[];
  output: string;
  configComplexity: 'zero-config' | 'needs-dep' | 'needs-api-key' | 'advanced';
  installCmd: string;
  docUrl?: string;
};

type Connector = {
  id: string; // slug used for install commands
  displayName: string;
  types: string[];
  description: string;
  installCmd?: string;
  status: 'available' | 'coming-soon';
  logo: ComponentType<any>;
  docUrl?: string;
};

type Provider = {
  name: string;
  status: 'available' | 'coming-soon';
  description?: string;
  logo: ComponentType<any>;
};

const VoyageLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path
      d="M4.5 6h3.2L12 15.2 16.3 6h3.2L13.3 19h-2.6L4.5 6z"
      fill="currentColor"
    />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const extractors: Extractor[] = [
  {
    name: 'pdf:llm',
    fileTypes: ['pdf'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'text (markdown)',
    configComplexity: 'needs-api-key',
    installCmd: 'bunx unrag@latest add extractor pdf-llm',
    docUrl: '/docs/extractors/pdf/llm',
  },
  {
    name: 'pdf:text-layer',
    fileTypes: ['pdf'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'text',
    configComplexity: 'needs-dep',
    installCmd: 'bunx unrag@latest add extractor pdf-text-layer',
    docUrl: '/docs/extractors/pdf/text-layer',
  },
  {
    name: 'pdf:ocr',
    fileTypes: ['pdf'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'text',
    configComplexity: 'needs-api-key',
    installCmd: 'bunx unrag@latest add extractor pdf-ocr',
    docUrl: '/docs/extractors/pdf/ocr',
  },
  {
    name: 'image:ocr',
    fileTypes: ['jpg', 'png', 'webp', 'gif'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'text',
    configComplexity: 'needs-api-key',
    installCmd: 'bunx unrag@latest add extractor image-ocr',
    docUrl: '/docs/extractors/image/ocr',
  },
  {
    name: 'image:caption-llm',
    fileTypes: ['jpg', 'png', 'webp', 'gif'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'caption',
    configComplexity: 'needs-api-key',
    installCmd: 'bunx unrag@latest add extractor image-caption-llm',
    docUrl: '/docs/extractors/image/caption-llm',
  },
  {
    name: 'audio:transcribe',
    fileTypes: ['mp3', 'wav', 'ogg', 'm4a'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'transcript',
    configComplexity: 'needs-api-key',
    installCmd: 'bunx unrag@latest add extractor audio-transcribe',
    docUrl: '/docs/extractors/audio/transcribe',
  },
  {
    name: 'video:transcribe',
    fileTypes: ['mp4', 'webm', 'mov'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'transcript',
    configComplexity: 'needs-api-key',
    installCmd: 'bunx unrag@latest add extractor video-transcribe',
    docUrl: '/docs/extractors/video/transcribe',
  },
  {
    name: 'video:frames',
    fileTypes: ['mp4', 'webm', 'mov'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'frame descriptions',
    configComplexity: 'advanced',
    installCmd: 'bunx unrag@latest add extractor video-frames',
    docUrl: '/docs/extractors/video/frames',
  },
  {
    name: 'file:docx',
    fileTypes: ['docx'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'text',
    configComplexity: 'needs-dep',
    installCmd: 'bunx unrag@latest add extractor file-docx',
    docUrl: '/docs/extractors/file/docx',
  },
  {
    name: 'file:pptx',
    fileTypes: ['pptx'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'text',
    configComplexity: 'needs-dep',
    installCmd: 'bunx unrag@latest add extractor file-pptx',
    docUrl: '/docs/extractors/file/pptx',
  },
  {
    name: 'file:xlsx',
    fileTypes: ['xlsx'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'text (csv)',
    configComplexity: 'needs-dep',
    installCmd: 'bunx unrag@latest add extractor file-xlsx',
    docUrl: '/docs/extractors/file/xlsx',
  },
  {
    name: 'file:text',
    fileTypes: ['txt', 'md', 'json', 'csv'],
    inputMode: ['file', 'url', 'buffer'],
    output: 'text',
    configComplexity: 'zero-config',
    installCmd: 'bunx unrag@latest add extractor file-text',
    docUrl: '/docs/extractors/file/text',
  },
];

const connectors: Connector[] = [
  {
    id: 'notion',
    displayName: 'Notion',
    types: ['docs', 'wiki', 'db'],
    description: 'Sync pages, databases, and blocks from Notion workspaces',
    installCmd: 'bunx unrag@latest add connector notion',
    status: 'available',
    logo: Notion,
    docUrl: '/docs/connectors/notion',
  },
  {
    id: 'google-drive',
    displayName: 'Google Drive',
    types: ['files', 'docs'],
    description: 'Ingest Docs/Sheets exports and shared folders',
    installCmd: 'bunx unrag@latest add connector google-drive',
    status: 'available',
    logo: GoogleDrive,
    docUrl: '/docs/connectors/google-drive',
  },
  {
    id: 'github',
    displayName: 'GitHub',
    types: ['code', 'docs'],
    description: 'Ingest repositories (Markdown, READMEs, docs folders) and issues/PRs',
    status: 'coming-soon',
    logo: GitHubDark,
  },
  {
    id: 'gitlab',
    displayName: 'GitLab',
    types: ['code', 'docs'],
    description: 'Ingest repos + wiki pages for self-hosted documentation',
    status: 'coming-soon',
    logo: GitLab,
  },
  {
    id: 'slack',
    displayName: 'Slack',
    types: ['chat'],
    description: 'Ingest channels (messages + threads) as searchable knowledge',
    status: 'coming-soon',
    logo: Slack,
  },
  {
    id: 'discord',
    displayName: 'Discord',
    types: ['chat'],
    description: 'Ingest server channels and threads for community support knowledge',
    status: 'coming-soon',
    logo: Discord,
  },
  {
    id: 'linear',
    displayName: 'Linear',
    types: ['issues', 'project'],
    description: 'Ingest issues and project updates for internal knowledge',
    status: 'coming-soon',
    logo: Linear,
  },
  {
    id: 'dropbox',
    displayName: 'Dropbox',
    types: ['files'],
    description: 'Ingest shared folders and exported docs/files',
    status: 'coming-soon',
    logo: Dropbox,
  },
  {
    id: 'onedrive',
    displayName: 'OneDrive',
    types: ['files'],
    description: 'Ingest files and Office exports from Microsoft 365',
    status: 'coming-soon',
    logo: MicrosoftOneDrive,
  },
  {
    id: 'teams',
    displayName: 'Microsoft Teams',
    types: ['chat'],
    description: 'Ingest channels and conversations for internal support knowledge',
    status: 'coming-soon',
    logo: MicrosoftTeams,
  }
];

const providers: Provider[] = [
  {
    name: 'Vercel AI Gateway',
    status: 'available',
    description: 'Unified gateway for LLM and embedding providers.',
    logo: VercelDark,
  },
  {
    name: 'Voyage',
    status: 'available',
    description: 'Multimodal embeddings via Voyage AI.',
    logo: VoyageLogo,
  },
  {
    name: 'OpenAI',
    status: 'available',
    description: 'Embeddings + LLM calls via OpenAI models.',
    logo: OpenAIDark,
  },
  {
    name: 'Google Gemini',
    status: 'available',
    description: 'Embeddings + LLM calls via Gemini.',
    logo: Gemini,
  },
  {
    name: 'OpenRouter',
    status: 'available',
    description: 'Unified API for multiple LLM providers and model routing.',
    logo: OpenRouterDark,
  },
  {
    name: 'Azure OpenAI',
    status: 'available',
    description: 'Use OpenAI models through Azure deployments.',
    logo: MicrosoftAzure,
  },
  {
    name: 'AWS Bedrock',
    status: 'available',
    description: 'Enterprise LLM + embedding access via Bedrock.',
    logo: AmazonWebServicesDark,
  },
  {
    name: 'Google Vertex AI',
    status: 'available',
    description: 'Enterprise access to Gemini + embeddings via Google Cloud Vertex AI.',
    logo: GoogleCloud,
  },
  {
    name: 'Ollama',
    status: 'available',
    description: 'Local models for dev and private deployments.',
    logo: OllamaDark,
  },
  {
    name: 'Groq',
    status: 'coming-soon',
    description: 'Low-latency inference for supported models.',
    logo: Groq,
  },
  {
    name: 'Mistral',
    status: 'available',
    description: 'Fast LLM calls via Mistral models.',
    logo: MistralAI,
  },
  {
    name: 'Together AI',
    status: 'available',
    description: 'Broad model catalog for LLM calls and embeddings.',
    logo: TogetherAIDark,
  },
  {
    name: 'Cohere',
    status: 'available',
    description: 'Embeddings and rerankers for retrieval.',
    logo: Cohere,
  },
  {
    name: 'Cloudflare Workers AI',
    status: 'coming-soon',
    description: 'Edge inference for embeddings and LLM calls.',
    logo: CloudflareWorkers,
  },
  {
    name: 'Perplexity',
    status: 'coming-soon',
    description: 'LLM calls with web-enabled models (where applicable).',
    logo: PerplexityAI,
  },
  {
    name: 'xAI',
    status: 'coming-soon',
    description: 'LLM calls via Grok models.',
    logo: XAIDark,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

function toSearchableText(value: unknown, { withDotPrefixes }: { withDotPrefixes?: boolean } = {}) {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    const parts = value
      .flatMap((v) => {
        if (v === null || v === undefined) return [];
        const s = String(v);
        if (!s) return [];
        return withDotPrefixes ? [s, s.startsWith('.') ? s : `.${s}`] : [s];
      })
      .filter(Boolean);
    return parts.join(' ');
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const s = String(value);
    if (!withDotPrefixes) return s;
    return [s, s.startsWith('.') ? s : `.${s}`].join(' ');
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeSearchTerms(filterValue: unknown) {
  const rawSearch = String(filterValue ?? '').trim().toLowerCase();
  if (!rawSearch) return [];
  return rawSearch.split(/\s+/).filter(Boolean);
}

const extractorGlobalFilter: FilterFn<Extractor> = (row, _columnId, filterValue) => {
  const terms = normalizeSearchTerms(filterValue);
  if (terms.length === 0) return true;

  const e = row.original;
  const haystack = [
    e.name,
    toSearchableText(e.fileTypes, { withDotPrefixes: true }),
    toSearchableText(e.inputMode),
    e.output,
    e.configComplexity,
  ]
    .join(' ')
    .toLowerCase()
    .trim();

  return terms.every((t) => haystack.includes(t));
};

const connectorGlobalFilter: FilterFn<Connector> = (row, _columnId, filterValue) => {
  const terms = normalizeSearchTerms(filterValue);
  if (terms.length === 0) return true;

  const c = row.original;
  const haystack = [c.id, c.displayName, toSearchableText(c.types), c.status, c.description]
    .join(' ')
    .toLowerCase()
    .trim();

  return terms.every((t) => haystack.includes(t));
};

function ConfigBadge({ complexity }: { complexity: Extractor['configComplexity'] }) {
  const config: Record<typeof complexity, { label: string; color: string }> = {
    'zero-config': { label: 'Zero config', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    'needs-dep': { label: 'Needs dep', color: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
    'needs-api-key': { label: 'API key', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    'advanced': { label: 'Advanced', color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  };

  const { label, color } = config[complexity];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border ${color}`}>
      {label}
    </span>
  );
}

function FileTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/5 text-white/70 border border-white/10">
      .{type}
    </span>
  );
}

function InputModeBadge({ mode }: { mode: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/5 text-white/50">
      {mode}
    </span>
  );
}

function RowActions({ copyText, docHref, docLabel }: { copyText?: string; docHref?: string; docLabel?: string }) {
  if (!copyText && !docHref) return null;

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
      {copyText ? <CopyButton text={copyText} /> : null}
      {docHref ? <DocsLinkButton href={docHref} label={docLabel} /> : null}
    </div>
  );
}

function DocsLinkButton({ href, label }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="p-1.5 rounded hover:bg-[var(--color-fd-accent)] transition-colors text-[var(--color-fd-muted-foreground)] hover:text-[var(--color-fd-foreground)]"
      aria-label={label ?? 'View documentation'}
    >
      <ArrowSquareOut size={16} weight="regular" />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Extractors Table
// ─────────────────────────────────────────────────────────────────────────────

const extractorColumnHelper = createColumnHelper<Extractor>();

const extractorColumns = [
  extractorColumnHelper.accessor('name', {
    header: 'Extractor',
    cell: (info) => (
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-white">{info.getValue()}</span>
        <RowActions
          copyText={info.row.original.installCmd}
          docHref={info.row.original.docUrl}
          docLabel={`${info.getValue()} docs`}
        />
      </div>
    ),
  }),
  extractorColumnHelper.accessor('fileTypes', {
    header: 'File Types',
    cell: (info) => (
      <div className="flex flex-wrap gap-1">
        {info.getValue().map((type) => (
          <FileTypeBadge key={type} type={type} />
        ))}
      </div>
    ),
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue) return true;
      const fileTypes = row.getValue(columnId) as string[];
      return fileTypes.some((type) => type === filterValue);
    },
  }),
  extractorColumnHelper.accessor('inputMode', {
    header: 'Input Mode',
    cell: (info) => (
      <div className="flex flex-wrap gap-1">
        {info.getValue().map((mode) => (
          <InputModeBadge key={mode} mode={mode} />
        ))}
      </div>
    ),
  }),
  extractorColumnHelper.accessor('output', {
    header: 'Output',
    cell: (info) => (
      <span className="text-sm text-white/70">{info.getValue()}</span>
    ),
  }),
  extractorColumnHelper.accessor('configComplexity', {
    header: 'Config',
    cell: (info) => <ConfigBadge complexity={info.getValue()} />,
  }),
];

function ExtractorsTable() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data: extractors,
    columns: extractorColumns,
    state: { columnFilters, globalFilter },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: extractorGlobalFilter,
    getColumnCanGlobalFilter: (column) => column.id === 'name',
  });

  const allFileTypes = useMemo(() => {
    const types = new Set<string>();
    extractors.forEach((e) => e.fileTypes.forEach((t) => types.add(t)));
    return Array.from(types).sort();
  }, []);

  const currentFileTypeFilter = columnFilters.find((f) => f.id === 'fileTypes')?.value as string | undefined;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search extractors..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-colors"
          />
        </div>
        <select
          value={currentFileTypeFilter || ''}
          onChange={(e) => {
            const value = e.target.value;
            setColumnFilters(value ? [{ id: 'fileTypes', value }] : []);
          }}
          className="px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.5)%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_8px_center] bg-no-repeat pr-10"
        >
          <option value="">All file types</option>
          {allFileTypes.map((type) => (
            <option key={type} value={type}>
              .{type}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-white/10 bg-white/[0.02]">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row count */}
      <div className="text-xs text-white/40 text-right">
        {table.getFilteredRowModel().rows.length} of {extractors.length} extractors
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connectors Table
// ─────────────────────────────────────────────────────────────────────────────

const connectorColumnHelper = createColumnHelper<Connector>();

const connectorColumns = [
  connectorColumnHelper.accessor('displayName', {
    header: 'Connector',
    cell: (info) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <info.row.original.logo
            width={16}
            height={16}
            className="text-white/90"
            aria-label={info.row.original.displayName}
          />
        </div>
        <span className="font-mono text-sm text-white">{info.getValue()}</span>
        <RowActions
          copyText={info.row.original.installCmd}
          docHref={info.row.original.status === 'available' ? info.row.original.docUrl : undefined}
          docLabel={`${info.getValue()} docs`}
        />
      </div>
    ),
  }),
  connectorColumnHelper.accessor('types', {
    header: 'Types',
    cell: (info) => (
      <div className="flex flex-wrap gap-1">
        {(info.getValue() as string[]).map((type) => (
          <InputModeBadge key={type} mode={type} />
        ))}
      </div>
    ),
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue) return true;
      const types = row.getValue(columnId) as string[];
      return types.some((t) => t === filterValue);
    },
  }),
  connectorColumnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const status = info.getValue();
      if (status === 'available') {
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
            Available
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border bg-white/5 text-white/50 border-white/10">
          Coming soon
        </span>
      );
    },
  }),
  connectorColumnHelper.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span className="text-sm text-white/50">{info.getValue()}</span>
    ),
  }),
];

function ConnectorsTable() {
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const table = useReactTable({
    data: connectors,
    columns: connectorColumns,
    state: { globalFilter, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: connectorGlobalFilter,
    getColumnCanGlobalFilter: (column) => column.id === 'displayName',
  });

  const allConnectorTypes = useMemo(() => {
    const types = new Set<string>();
    connectors.forEach((c) => c.types.forEach((t) => types.add(t)));
    return Array.from(types).sort();
  }, []);

  const currentTypeFilter = columnFilters.find((f) => f.id === 'types')?.value as string | undefined;

  return (
    <div className="space-y-4">
      {/* Search + Type filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search connectors..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-colors"
          />
        </div>
        <select
          value={currentTypeFilter || ''}
          onChange={(e) => {
            const value = e.target.value;
            setColumnFilters(value ? [{ id: 'types', value }] : []);
          }}
          className="px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255%2C255%2C255%2C0.5)%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_8px_center] bg-no-repeat pr-10"
        >
          <option value="">All types</option>
          {allConnectorTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-white/10 bg-white/[0.02]">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row count */}
      <div className="text-xs text-white/40 text-right">
        {table.getFilteredRowModel().rows.length} of {connectors.length} connectors
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Providers Tab
// ─────────────────────────────────────────────────────────────────────────────

const providerColumnHelper = createColumnHelper<Provider>();

const providerColumns = [
  providerColumnHelper.accessor('name', {
    header: 'Provider',
    cell: (info) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <info.row.original.logo
            width={16}
            height={16}
            className="text-white/90"
            aria-label={info.getValue()}
          />
        </div>
        <span className="font-mono text-sm text-white">{info.getValue()}</span>
      </div>
    ),
  }),
  providerColumnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const status = info.getValue();
      if (status === 'available') {
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
            Available
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border bg-white/5 text-white/50 border-white/10">
          Coming soon
        </span>
      );
    },
  }),
  providerColumnHelper.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span className="text-sm text-white/50">{info.getValue() ?? ''}</span>
    ),
  }),
];

function ProvidersTab() {
  const [globalFilter, setGlobalFilter] = useState('');
  const table = useReactTable({
    data: providers,
    columns: providerColumns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search providers..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-colors"
          />
        </div>
      </div>

      {/* Available provider */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-white/10 bg-white/[0.02]">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="group hover:bg-white/[0.02] transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row count */}
      <div className="text-xs text-white/40 text-right">
        {table.getFilteredRowModel().rows.length} of {providers.length} providers
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'extractors' | 'connectors' | 'providers';

export function RegistrySection() {
  const [activeTab, setActiveTab] = useState<Tab>('extractors');

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'extractors', label: 'Extractors', count: extractors.length },
    { id: 'connectors', label: 'Connectors', count: connectors.length },
    { id: 'providers', label: 'Providers', count: providers.length },
  ];

  const header = (() => {
    if (activeTab === 'extractors') {
      return {
        title: 'Extract text from anything',
        description:
          'PDFs, images, audio, video, Office docs, turn any file into searchable, embeddable text with a single line of code.',
        docLink: '/docs/extractors',
        ctaLabel: 'Explore extractors',
      };
    }
    if (activeTab === 'connectors') {
      return {
        title: 'Ingest from where your data lives',
        description:
          'Pull documents straight from Notion, GitHub, Slack, and more. Keep your knowledge base fresh without manual uploads.',
        docLink: '/docs/connectors',
        ctaLabel: 'Explore connectors',
      };
    }
    return {
      title: 'Bring your own model',
      description:
        'Swap embedding and LLM providers without changing your code. OpenAI today, local models tomorrow, your choice.',
      docLink: undefined,
      ctaLabel: undefined,
    };
  })();

  return (
    <section className="relative px-6 py-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-fd-foreground)] mb-4">
            {header.title}
          </h2>
          <p className="text-[var(--color-fd-muted-foreground)] text-lg max-w-2xl mx-auto mb-6">
            {header.description}
          </p>
          {header.docLink && header.ctaLabel ? (
            <Link
              href={header.docLink}
              className="group relative inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm text-[hsl(0,0%,8%)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(to bottom, hsl(0, 0%, 100%) 0%, hsl(0, 0%, 85%) 100%)',
                boxShadow: 'inset 0 1px 0 0 hsla(0, 0%, 100%, 0.4), 0 1px 2px 0 hsla(0, 0%, 0%, 0.3)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              {header.ctaLabel}
            </Link>
          ) : null}
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-center gap-1 mb-8 p-1 bg-white/[0.03] border border-white/10 rounded-xl w-fit mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${
                  activeTab === tab.id
                    ? 'text-white bg-white/10'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/[0.03]'
                }
              `}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-white/10 text-white/70' : 'bg-white/5 text-white/40'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'extractors' && <ExtractorsTable />}
          {activeTab === 'connectors' && <ConnectorsTable />}
          {activeTab === 'providers' && <ProvidersTab />}
        </div>
      </div>
    </section>
  );
}
