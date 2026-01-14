import type { IngestResult, Metadata } from "@registry/core";
import { isFullPage } from "@notionhq/client";
import type {
  GetPageResponse,
  ListBlockChildrenResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { createNotionClient, type NotionClient } from "@registry/connectors/notion/client";
import { normalizeNotionPageId32, toUuidHyphenated } from "@registry/connectors/notion/ids";
import {
  extractNotionAssets,
  renderNotionBlocksToText,
  type NotionBlock,
  type NotionBlockNode,
} from "@registry/connectors/notion/render";
import type {
  BuildNotionPageIngestInputArgs,
  NotionPageDocument,
  NotionSyncProgressEvent,
  SyncNotionPagesInput,
  SyncNotionPagesResult,
} from "@registry/connectors/notion/types";

const joinPrefix = (prefix: string | undefined, rest: string) => {
  const p = (prefix ?? "").trim();
  if (!p) return rest;
  return p.endsWith(":") ? p + rest : p + ":" + rest;
};

export function buildNotionPageIngestInput(
  args: BuildNotionPageIngestInputArgs
) {
  const sourceId = joinPrefix(
    args.sourceIdPrefix,
    `notion:page:${args.pageId}`
  );

  return {
    sourceId,
    content: args.content,
    metadata: args.metadata ?? {},
    assets: args.assets ?? [],
  };
}

const richTextToText = (richText: RichTextItemResponse[] | undefined): string =>
  (richText ?? []).map((t) => t.plain_text).join("");

const getNotionPageTitle = (page: GetPageResponse): string => {
  if (!isFullPage(page)) return "";
  const props = page.properties;
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p.type === "title") {
      return richTextToText(p.title);
    }
  }
  return "";
};

async function listAllBlockChildren(
  notion: NotionClient,
  blockId: string
): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const res: ListBlockChildrenResponse = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    blocks.push(...(res.results as NotionBlock[]));
    if (!res.has_more) break;
    cursor = res.next_cursor ?? undefined;
    if (!cursor) break;
  }

  return blocks;
}

async function buildBlockTree(
  notion: NotionClient,
  rootBlockId: string,
  depth: number,
  maxDepth: number
): Promise<NotionBlockNode[]> {
  const children = await listAllBlockChildren(notion, rootBlockId);
  const nodes: NotionBlockNode[] = [];

  for (const block of children) {
    let grandChildren: NotionBlockNode[] = [];
    if (block.has_children && depth < maxDepth) {
      grandChildren = await buildBlockTree(notion, block.id, depth + 1, maxDepth);
    }
    nodes.push({ block, children: grandChildren });
  }

  return nodes;
}

export async function loadNotionPageDocument(args: {
  notion: NotionClient;
  pageIdOrUrl: string;
  sourceIdPrefix?: string;
  maxDepth?: number;
}): Promise<NotionPageDocument> {
  const pageId = normalizeNotionPageId32(args.pageIdOrUrl);
  const apiId = toUuidHyphenated(pageId);

  const page: GetPageResponse = await args.notion.pages.retrieve({ page_id: apiId });
  const title = getNotionPageTitle(page);
  const url = isFullPage(page) ? page.url : "";
  const lastEditedTime = isFullPage(page) ? page.last_edited_time : "";

  const tree = await buildBlockTree(args.notion, apiId, 0, args.maxDepth ?? 4);
  const body = renderNotionBlocksToText(tree);
  const content = [title.trim(), body.trim()].filter(Boolean).join("\n\n");
  const assets = extractNotionAssets(tree);

  const metadata: Metadata = {
    connector: "notion",
    kind: "page",
    pageId,
    url,
    title,
    lastEditedTime,
  };

  const ingest = buildNotionPageIngestInput({
    pageId,
    content,
    assets,
    metadata,
    sourceIdPrefix: args.sourceIdPrefix,
  });

  return {
    sourceId: ingest.sourceId,
    content: ingest.content,
    metadata: ingest.metadata ?? {},
    assets: ingest.assets ?? [],
  };
}

const isNotFound = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  const status = Number(e.status ?? e.statusCode ?? e.code ?? 0);
  if (status === 404) return true;
  const msg = String(e.message ?? "");
  return msg.toLowerCase().includes("could not find");
};

export async function syncNotionPages(
  input: SyncNotionPagesInput
): Promise<SyncNotionPagesResult> {
  const deleteOnNotFound = input.deleteOnNotFound ?? false;

  const notion = createNotionClient({ token: input.token });
  const errors: SyncNotionPagesResult["errors"] = [];

  let succeeded = 0;
  let failed = 0;
  let deleted = 0;

  for (const rawId of input.pageIds) {
    const pageId = normalizeNotionPageId32(rawId);
    const sourceId = joinPrefix(
      input.sourceIdPrefix,
      `notion:page:${pageId}`
    );

    const emit = (event: NotionSyncProgressEvent) => {
      try {
        input.onProgress?.(event);
      } catch {
        // ignore progress handler errors
      }
    };

    emit({ type: "page:start", pageId, sourceId });

    try {
      const doc = await loadNotionPageDocument({
        notion,
        pageIdOrUrl: pageId,
        sourceIdPrefix: input.sourceIdPrefix,
      });

      const result: IngestResult = await input.engine.ingest({
        sourceId: doc.sourceId,
        content: doc.content,
        assets: doc.assets,
        metadata: doc.metadata,
      });

      succeeded += 1;
      emit({
        type: "page:success",
        pageId,
        sourceId,
        chunkCount: result.chunkCount,
      });
    } catch (err) {
      if (isNotFound(err)) {
        emit({ type: "page:not-found", pageId, sourceId });
        if (deleteOnNotFound) {
          try {
            await input.engine.delete({ sourceId });
            deleted += 1;
          } catch (deleteErr) {
            failed += 1;
            errors.push({ pageId, sourceId, error: deleteErr });
            emit({ type: "page:error", pageId, sourceId, error: deleteErr });
          }
        }
        continue;
      }

      failed += 1;
      errors.push({ pageId, sourceId, error: err });
      emit({ type: "page:error", pageId, sourceId, error: err });
    }
  }

  return {
    pageCount: input.pageIds.length,
    succeeded,
    failed,
    deleted,
    errors,
  };
}


