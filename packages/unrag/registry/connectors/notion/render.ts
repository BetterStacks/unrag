import type { AssetInput, AssetKind, Metadata } from "../../core";

type RichText = { plain_text?: string };

export type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  // Notion block payload is keyed by `type`; we keep it loose to stay stable.
  [key: string]: unknown;
};

export type NotionBlockNode = {
  block: NotionBlock;
  children: NotionBlockNode[];
};

const rt = (value: unknown): string => {
  const items = Array.isArray(value) ? (value as RichText[]) : [];
  return items.map((t) => t?.plain_text ?? "").join("");
};

const indent = (n: number) => (n > 0 ? "  ".repeat(n) : "");

const asString = (v: unknown) => String(v ?? "").trim();

const supportedAssetKinds = new Set<AssetKind>([
  "image",
  "pdf",
  "audio",
  "video",
  "file",
]);

const toAssetKind = (notionType: string): AssetKind | null => {
  const t = notionType as AssetKind;
  return supportedAssetKinds.has(t) ? t : null;
};

const pickUrl = (payload: any): string | undefined => {
  const type = String(payload?.type ?? "");
  if (type === "external") return asString(payload?.external?.url);
  if (type === "file") return asString(payload?.file?.url);
  return undefined;
};

const pickCaption = (payload: any): string => {
  // Notion captions are typically an array of rich text items.
  return rt(payload?.caption);
};

const inferMediaType = (assetKind: AssetKind, payload: any): string | undefined => {
  if (assetKind === "pdf") return "application/pdf";
  // Notion does not consistently include media types; keep it optional.
  return asString(payload?.media_type) || undefined;
};

const asMetadata = (obj: Record<string, unknown>): Metadata => obj as any;

export function extractNotionAssets(
  nodes: NotionBlockNode[],
  opts: { maxDepth?: number } = {}
): AssetInput[] {
  const maxDepth = opts.maxDepth ?? 6;
  const out: AssetInput[] = [];

  const walk = (node: NotionBlockNode, depth: number) => {
    if (depth > maxDepth) return;
    const b = node.block as any;
    const kind = toAssetKind(String(b.type ?? ""));
    if (kind) {
      const payload = b[kind];
      const url = pickUrl(payload);
      if (url) {
        const caption = pickCaption(payload).trim();
        const mediaType = inferMediaType(kind, payload);
        out.push({
          assetId: String(b.id),
          kind,
          data: { kind: "url", url, ...(mediaType ? { mediaType } : {}) },
          uri: url,
          ...(caption ? { text: caption } : {}),
          metadata: asMetadata({
            connector: "notion",
            notionBlockId: String(b.id),
            notionBlockType: String(b.type),
          }),
        });
      }
    }

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  };

  for (const n of nodes) walk(n, 0);
  return out;
}

export function renderNotionBlocksToText(
  nodes: NotionBlockNode[],
  opts: { maxDepth?: number } = {}
): string {
  const maxDepth = opts.maxDepth ?? 6;
  const lines: string[] = [];

  const walk = (node: NotionBlockNode, depth: number, listDepth: number) => {
    if (depth > maxDepth) return;
    const b = node.block;

    const t = b.type;

    if (t === "paragraph") {
      const text = rt((b as any).paragraph?.rich_text);
      if (text.trim()) lines.push(text);
    } else if (t === "heading_1") {
      const text = rt((b as any).heading_1?.rich_text);
      if (text.trim()) lines.push(`# ${text}`);
    } else if (t === "heading_2") {
      const text = rt((b as any).heading_2?.rich_text);
      if (text.trim()) lines.push(`## ${text}`);
    } else if (t === "heading_3") {
      const text = rt((b as any).heading_3?.rich_text);
      if (text.trim()) lines.push(`### ${text}`);
    } else if (t === "bulleted_list_item") {
      const text = rt((b as any).bulleted_list_item?.rich_text);
      if (text.trim()) lines.push(`${indent(listDepth)}- ${text}`);
    } else if (t === "numbered_list_item") {
      const text = rt((b as any).numbered_list_item?.rich_text);
      if (text.trim()) lines.push(`${indent(listDepth)}- ${text}`);
    } else if (t === "to_do") {
      const text = rt((b as any).to_do?.rich_text);
      const checked = Boolean((b as any).to_do?.checked);
      if (text.trim()) lines.push(`${indent(listDepth)}- [${checked ? "x" : " "}] ${text}`);
    } else if (t === "quote") {
      const text = rt((b as any).quote?.rich_text);
      if (text.trim()) lines.push(`> ${text}`);
    } else if (t === "callout") {
      const text = rt((b as any).callout?.rich_text);
      if (text.trim()) lines.push(text);
    } else if (t === "code") {
      const text = rt((b as any).code?.rich_text);
      const lang = String((b as any).code?.language ?? "").trim();
      lines.push("```" + lang);
      if (text.trim()) lines.push(text);
      lines.push("```");
    } else if (t === "divider") {
      lines.push("---");
    } else {
      // Unsupported block types are ignored for v1.
      // This keeps the output focused and avoids surprises.
    }

    // Render children (nested blocks). For list items, increase listDepth.
    const nextListDepth =
      t === "bulleted_list_item" ||
      t === "numbered_list_item" ||
      t === "to_do"
        ? listDepth + 1
        : listDepth;

    for (const child of node.children) {
      walk(child, depth + 1, nextListDepth);
    }
  };

  for (const node of nodes) {
    walk(node, 0, 0);
    lines.push("");
  }

  return lines.join("\n").trim();
}


