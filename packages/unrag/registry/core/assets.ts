import type { AssetKind, Chunk } from "./types";

export type ChunkAssetRef = {
  assetId: string;
  assetKind: AssetKind;
  assetUri?: string;
  assetMediaType?: string;
  extractor?: string;
};

const assetKinds = new Set<AssetKind>(["image", "pdf", "audio", "video", "file"]);

/**
 * Convenience helper to extract an asset reference from a retrieved chunk.
 *
 * Asset chunks are represented as standard text chunks whose `metadata` contains:
 * - `assetKind`: "image" | "pdf" | "audio" | "video" | "file"
 * - `assetId`: stable identifier emitted by the connector/ingester
 * - optional `assetUri`, `assetMediaType`, and `extractor`
 */
export function getChunkAssetRef(
  chunk: Pick<Chunk, "metadata">
): ChunkAssetRef | null {
  const meta = chunk.metadata as any;
  const kind = meta?.assetKind;
  const id = meta?.assetId;

  if (typeof kind !== "string" || !assetKinds.has(kind as AssetKind)) {
    return null;
  }
  if (typeof id !== "string" || !id) {
    return null;
  }

  const assetUri = typeof meta?.assetUri === "string" ? meta.assetUri : undefined;
  const assetMediaType =
    typeof meta?.assetMediaType === "string" ? meta.assetMediaType : undefined;
  const extractor =
    typeof meta?.extractor === "string" ? meta.extractor : undefined;

  return {
    assetId: id,
    assetKind: kind as AssetKind,
    ...(assetUri ? { assetUri } : {}),
    ...(assetMediaType ? { assetMediaType } : {}),
    ...(extractor ? { extractor } : {}),
  };
}

export function isAssetChunk(chunk: Pick<Chunk, "metadata">): boolean {
  return getChunkAssetRef(chunk) !== null;
}


