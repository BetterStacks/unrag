import type { AssetInput, ContextEngine, IngestInput, Metadata } from "@registry/core";

export type NotionSyncProgressEvent =
  | { type: "page:start"; pageId: string; sourceId: string }
  | { type: "page:success"; pageId: string; sourceId: string; chunkCount: number }
  | { type: "page:error"; pageId: string; sourceId: string; error: unknown }
  | { type: "page:not-found"; pageId: string; sourceId: string };

export type SyncNotionPagesInput = {
  engine: ContextEngine;
  /**
   * Server-side Notion integration token.
   * Keep this server-only (env var).
   */
  token: string;
  /** Notion page IDs or page URLs. */
  pageIds: string[];
  /**
   * Optional namespace prefix, useful for multi-tenant apps:
   * `tenant:acme:` -> `tenant:acme:notion:page:<id>`
   */
  sourceIdPrefix?: string;
  /**
   * When true, if a page is not found/accessible, delete the previously ingested
   * document for that page (exact sourceId).
   */
  deleteOnNotFound?: boolean;
  /** Optional progress callback. */
  onProgress?: (event: NotionSyncProgressEvent) => void;
};

export type SyncNotionPagesResult = {
  pageCount: number;
  succeeded: number;
  failed: number;
  deleted: number;
  errors: Array<{ pageId: string; sourceId: string; error: unknown }>;
};

export type NotionPageDocument = {
  sourceId: string;
  content: string;
  metadata: Metadata;
  assets: AssetInput[];
};

export type BuildNotionPageIngestInputArgs = {
  pageId: string; // normalized 32-hex (no dashes)
  content: string;
  assets?: AssetInput[];
  metadata?: Metadata;
  sourceIdPrefix?: string;
};

export type BuildNotionPageIngestInputResult = IngestInput;


