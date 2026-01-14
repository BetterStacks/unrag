import type { AssetKind } from "@registry/core/types";

export const DRIVE_MIME = {
  folder: "application/vnd.google-apps.folder",
  shortcut: "application/vnd.google-apps.shortcut",
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
  drawing: "application/vnd.google-apps.drawing",
} as const;

export const EXPORT_MIME = {
  text: "text/plain",
  csv: "text/csv",
  pptx:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
} as const;

export type DriveGoogleNativeKind = "doc" | "sheet" | "slides" | "drawing";

export type DriveMimeClassification =
  | { kind: "folder" }
  | { kind: "shortcut" }
  | { kind: "google_native"; nativeKind: DriveGoogleNativeKind }
  | { kind: "binary" };

export function classifyDriveMimeType(mimeType: string | undefined): DriveMimeClassification {
  const mt = String(mimeType ?? "").trim();
  if (!mt) return { kind: "binary" };

  if (mt === DRIVE_MIME.folder) return { kind: "folder" };
  if (mt === DRIVE_MIME.shortcut) return { kind: "shortcut" };

  if (mt === DRIVE_MIME.doc) return { kind: "google_native", nativeKind: "doc" };
  if (mt === DRIVE_MIME.sheet) return { kind: "google_native", nativeKind: "sheet" };
  if (mt === DRIVE_MIME.slides) return { kind: "google_native", nativeKind: "slides" };
  if (mt === DRIVE_MIME.drawing) return { kind: "google_native", nativeKind: "drawing" };

  return { kind: "binary" };
}

export type DriveNativeExportPlan =
  | { kind: "content"; mimeType: string }
  | {
      kind: "asset";
      assetKind: AssetKind;
      mimeType: string;
      filenameExt?: string;
    }
  | { kind: "unsupported" };

/**
 * Default behavior (Notion-like): Google-native files are exported to text-ish content.
 * Drawings are exported as PNG image assets (no good text representation).
 */
export function getNativeExportPlan(nativeKind: DriveGoogleNativeKind): DriveNativeExportPlan {
  if (nativeKind === "doc") return { kind: "content", mimeType: EXPORT_MIME.text };
  if (nativeKind === "sheet") return { kind: "content", mimeType: EXPORT_MIME.csv };
  if (nativeKind === "slides") return { kind: "content", mimeType: EXPORT_MIME.text };
  if (nativeKind === "drawing") {
    return { kind: "asset", assetKind: "image", mimeType: EXPORT_MIME.png, filenameExt: "png" };
  }
  return { kind: "unsupported" };
}

export function assetKindFromMediaType(mediaType: string | undefined): AssetKind {
  const mt = String(mediaType ?? "").trim().toLowerCase();
  if (mt === "application/pdf") return "pdf";
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("audio/")) return "audio";
  if (mt.startsWith("video/")) return "video";
  return "file";
}


