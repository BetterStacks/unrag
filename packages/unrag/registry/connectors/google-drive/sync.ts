import type { IngestResult } from "../../core";
import type { AssetInput } from "../../core/types";
import { createGoogleDriveClient } from "./client";
import {
  assetKindFromMediaType,
  classifyDriveMimeType,
  EXPORT_MIME,
  getNativeExportPlan,
  DRIVE_MIME,
} from "./mime";
import type {
  BuildGoogleDriveFileIngestInputArgs,
  GoogleDriveFileDocument,
  GoogleDriveSyncProgressEvent,
  SyncGoogleDriveFilesInput,
} from "./types";

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024; // 15MB

const joinPrefix = (prefix: string | undefined, rest: string) => {
  const p = (prefix ?? "").trim();
  if (!p) return rest;
  return p.endsWith(":") ? p + rest : p + ":" + rest;
};

export function buildGoogleDriveFileIngestInput(
  args: BuildGoogleDriveFileIngestInputArgs
) {
  const sourceId = joinPrefix(args.sourceIdPrefix, `gdrive:file:${args.fileId}`);
  return {
    sourceId,
    content: args.content,
    metadata: args.metadata ?? {},
    assets: args.assets ?? [],
  };
}

const asMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const toUint8Array = (data: any): Uint8Array => {
  if (!data) return new Uint8Array();
  if (data instanceof Uint8Array) return data;
  if (typeof Buffer !== "undefined" && data instanceof Buffer) {
    return new Uint8Array(data);
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  // Axios can hand back a string for some responseTypes; treat as utf-8 bytes.
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  return new Uint8Array();
};

const bytesToText = (bytes: Uint8Array) => {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
};

const isNotFound = (err: any, treatForbiddenAsNotFound: boolean) => {
  const status =
    Number(err?.code ?? err?.status ?? err?.response?.status ?? err?.statusCode) ||
    Number(err?.response?.status);
  if (status === 404) return true;
  if (treatForbiddenAsNotFound && status === 403) return true;
  return false;
};

async function getFileMetadata(drive: any, fileId: string) {
  const res = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields:
      "id,name,mimeType,size,md5Checksum,modifiedTime,webViewLink,webContentLink,iconLink,shortcutDetails,driveId",
  });
  return res?.data ?? {};
}

async function downloadFileBytes(drive: any, fileId: string): Promise<Uint8Array> {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return toUint8Array(res?.data);
}

async function exportFileBytes(
  drive: any,
  fileId: string,
  mimeType: string
): Promise<Uint8Array> {
  const res = await drive.files.export(
    { fileId, mimeType },
    { responseType: "arraybuffer" }
  );
  return toUint8Array(res?.data);
}

export async function loadGoogleDriveFileDocument(args: {
  drive: any;
  fileId: string;
  sourceIdPrefix?: string;
  options?: {
    maxBytesPerFile?: number;
    strictNativeExport?: boolean;
  };
  /** internal: recursion guard for shortcuts */
  _visited?: Set<string>;
}): Promise<GoogleDriveFileDocument> {
  const maxBytesPerFile = args.options?.maxBytesPerFile ?? DEFAULT_MAX_BYTES;
  const strictNativeExport = Boolean(args.options?.strictNativeExport ?? false);

  const meta = await getFileMetadata(args.drive, args.fileId);
  const fileId = String(meta?.id ?? args.fileId);
  const name = String(meta?.name ?? "");
  const mimeType = String(meta?.mimeType ?? "");
  const size = meta?.size !== undefined ? Number(meta.size) : undefined;

  const classification = classifyDriveMimeType(mimeType);

  // Handle folders: return a document shape but with no content/assets; callers typically skip.
  if (classification.kind === "folder") {
    return buildGoogleDriveFileIngestInput({
      fileId,
      sourceIdPrefix: args.sourceIdPrefix,
      content: "",
      assets: [],
      metadata: {
        connector: "google-drive",
        kind: "folder",
        fileId,
        name,
        mimeType: DRIVE_MIME.folder,
        ...(meta?.webViewLink ? { webViewLink: String(meta.webViewLink) } : {}),
        ...(meta?.modifiedTime ? { modifiedTime: String(meta.modifiedTime) } : {}),
      },
    }) as any;
  }

  // Shortcuts: resolve to target if possible (1-level), otherwise let caller decide.
  if (classification.kind === "shortcut") {
    const visited = args._visited ?? new Set<string>();
    if (visited.has(fileId)) {
      // cycle
      return buildGoogleDriveFileIngestInput({
        fileId,
        sourceIdPrefix: args.sourceIdPrefix,
        content: "",
        assets: [],
        metadata: {
          connector: "google-drive",
          kind: "shortcut",
          fileId,
          name,
          mimeType: DRIVE_MIME.shortcut,
          shortcutUnresolved: true,
        },
      }) as any;
    }
    visited.add(fileId);

    const targetId = meta?.shortcutDetails?.targetId
      ? String(meta.shortcutDetails.targetId)
      : "";

    if (!targetId) {
      return buildGoogleDriveFileIngestInput({
        fileId,
        sourceIdPrefix: args.sourceIdPrefix,
        content: "",
        assets: [],
        metadata: {
          connector: "google-drive",
          kind: "shortcut",
          fileId,
          name,
          mimeType: DRIVE_MIME.shortcut,
          shortcutUnresolved: true,
        },
      }) as any;
    }

    // Resolve target content/assets but keep sourceId stable to the shortcut file id.
    const targetDoc = await loadGoogleDriveFileDocument({
      drive: args.drive,
      fileId: targetId,
      sourceIdPrefix: args.sourceIdPrefix,
      options: args.options,
      _visited: visited,
    });

    return {
      ...targetDoc,
      sourceId: joinPrefix(args.sourceIdPrefix, `gdrive:file:${fileId}`),
      metadata: {
        ...(targetDoc.metadata ?? {}),
        connector: "google-drive",
        shortcutFileId: fileId,
        shortcutTargetId: targetId,
      },
    };
  }

  const baseMetadata = {
    connector: "google-drive",
    kind: "file",
    fileId,
    name,
    mimeType,
    ...(Number.isFinite(size) ? { size } : {}),
    ...(meta?.md5Checksum ? { md5Checksum: String(meta.md5Checksum) } : {}),
    ...(meta?.modifiedTime ? { modifiedTime: String(meta.modifiedTime) } : {}),
    ...(meta?.webViewLink ? { webViewLink: String(meta.webViewLink) } : {}),
    ...(meta?.webContentLink ? { webContentLink: String(meta.webContentLink) } : {}),
    ...(meta?.iconLink ? { iconLink: String(meta.iconLink) } : {}),
    ...(meta?.driveId ? { driveId: String(meta.driveId) } : {}),
  } as const;

  // Google-native export path
  if (classification.kind === "google_native") {
    const plan = getNativeExportPlan(classification.nativeKind);
    if (plan.kind === "unsupported") {
      return buildGoogleDriveFileIngestInput({
        fileId,
        sourceIdPrefix: args.sourceIdPrefix,
        content: "",
        assets: [],
        metadata: {
          ...baseMetadata,
          googleNativeKind: classification.nativeKind,
          unsupportedGoogleMime: true,
        },
      }) as any;
    }

    // For content export, enforce maxBytesPerFile by bytes length.
    if (plan.kind === "content") {
      try {
        const bytes = await exportFileBytes(args.drive, fileId, plan.mimeType);
        if (bytes.byteLength > maxBytesPerFile) {
          return buildGoogleDriveFileIngestInput({
            fileId,
            sourceIdPrefix: args.sourceIdPrefix,
            content: "",
            assets: [],
            metadata: { ...baseMetadata, exportedTooLarge: true },
          }) as any;
        }
        const content = bytesToText(bytes).trim();
        return buildGoogleDriveFileIngestInput({
          fileId,
          sourceIdPrefix: args.sourceIdPrefix,
          content,
          assets: [],
          metadata: { ...baseMetadata, googleNativeKind: classification.nativeKind, exportMimeType: plan.mimeType },
        }) as any;
      } catch (err) {
        // Slides can fail to export as text; fallback to PPTX unless strict.
        if (classification.nativeKind === "slides" && !strictNativeExport) {
          try {
            const bytes = await exportFileBytes(args.drive, fileId, EXPORT_MIME.pptx);
            if (bytes.byteLength > maxBytesPerFile) {
              return buildGoogleDriveFileIngestInput({
                fileId,
                sourceIdPrefix: args.sourceIdPrefix,
                content: "",
                assets: [],
                metadata: { ...baseMetadata, exportedTooLarge: true },
              }) as any;
            }
            const asset: AssetInput = {
              assetId: fileId,
              kind: "file",
              data: {
                kind: "bytes",
                bytes,
                mediaType: EXPORT_MIME.pptx,
                filename: name ? `${name}.pptx` : undefined,
              },
              uri: meta?.webViewLink ? String(meta.webViewLink) : undefined,
              metadata: { connector: "google-drive", fileId, exportMimeType: EXPORT_MIME.pptx } as any,
            };
            return buildGoogleDriveFileIngestInput({
              fileId,
              sourceIdPrefix: args.sourceIdPrefix,
              content: "",
              assets: [asset],
              metadata: { ...baseMetadata, googleNativeKind: "slides", exportFallback: "pptx" },
            }) as any;
          } catch {
            // fall through to strict error
          }
        }

        throw err;
      }
    }

    // Asset export path (drawings -> PNG image)
    if (plan.kind === "asset") {
      const bytes = await exportFileBytes(args.drive, fileId, plan.mimeType);
      if (bytes.byteLength > maxBytesPerFile) {
        return buildGoogleDriveFileIngestInput({
          fileId,
          sourceIdPrefix: args.sourceIdPrefix,
          content: "",
          assets: [],
          metadata: { ...baseMetadata, exportedTooLarge: true },
        }) as any;
      }

      const filename = name && plan.filenameExt ? `${name}.${plan.filenameExt}` : name || undefined;
      const asset: AssetInput = {
        assetId: fileId,
        kind: plan.assetKind,
        data: { kind: "bytes", bytes, mediaType: plan.mimeType, ...(filename ? { filename } : {}) },
        uri: meta?.webViewLink ? String(meta.webViewLink) : undefined,
        metadata: { connector: "google-drive", fileId, exportMimeType: plan.mimeType } as any,
      };

      return buildGoogleDriveFileIngestInput({
        fileId,
        sourceIdPrefix: args.sourceIdPrefix,
        content: "",
        assets: [asset],
        metadata: { ...baseMetadata, googleNativeKind: classification.nativeKind, exportMimeType: plan.mimeType },
      }) as any;
    }
  }

  // Binary download path
  if (Number.isFinite(size) && (size as number) > maxBytesPerFile) {
    return buildGoogleDriveFileIngestInput({
      fileId,
      sourceIdPrefix: args.sourceIdPrefix,
      content: "",
      assets: [],
      metadata: { ...baseMetadata, skippedTooLarge: true },
    }) as any;
  }

  const bytes = await downloadFileBytes(args.drive, fileId);
  if (bytes.byteLength > maxBytesPerFile) {
    return buildGoogleDriveFileIngestInput({
      fileId,
      sourceIdPrefix: args.sourceIdPrefix,
      content: "",
      assets: [],
      metadata: { ...baseMetadata, skippedTooLarge: true },
    }) as any;
  }

  const assetKind = assetKindFromMediaType(mimeType);
  const filename = name || undefined;
  const asset: AssetInput = {
    assetId: fileId,
    kind: assetKind,
    data: {
      kind: "bytes",
      bytes,
      mediaType: mimeType || "application/octet-stream",
      ...(filename ? { filename } : {}),
    },
    uri: meta?.webViewLink ? String(meta.webViewLink) : undefined,
    metadata: { connector: "google-drive", fileId, name, mimeType } as any,
  };

  // For pure binaries, keep content empty; extraction occurs via engine asset processing + extractors.
  return buildGoogleDriveFileIngestInput({
    fileId,
    sourceIdPrefix: args.sourceIdPrefix,
    content: "",
    assets: [asset],
    metadata: baseMetadata as any,
  }) as any;
}

export async function syncGoogleDriveFiles(
  input: SyncGoogleDriveFilesInput
): Promise<{
  fileCount: number;
  succeeded: number;
  failed: number;
  deleted: number;
  errors: Array<{ fileId: string; sourceId: string; error: unknown }>;
}> {
  const deleteOnNotFound = input.deleteOnNotFound ?? false;
  const options = input.options ?? {};
  const maxBytesPerFile = options.maxBytesPerFile ?? DEFAULT_MAX_BYTES;
  const treatForbiddenAsNotFound = options.treatForbiddenAsNotFound ?? true;

  const { drive } = await createGoogleDriveClient({
    auth: input.auth,
    scopes: options.scopes,
  });

  const errors: Array<{ fileId: string; sourceId: string; error: unknown }> = [];
  let succeeded = 0;
  let failed = 0;
  let deleted = 0;

  for (const fileIdRaw of input.fileIds) {
    const fileId = String(fileIdRaw ?? "").trim();
    if (!fileId) continue;

    const sourceId = joinPrefix(input.sourceIdPrefix, `gdrive:file:${fileId}`);

    const emit = (event: GoogleDriveSyncProgressEvent) => {
      try {
        input.onProgress?.(event);
      } catch {
        // ignore progress handler errors
      }
    };

    emit({ type: "file:start", fileId, sourceId });

    try {
      const doc = await loadGoogleDriveFileDocument({
        drive,
        fileId,
        sourceIdPrefix: input.sourceIdPrefix,
        options: {
          maxBytesPerFile,
          strictNativeExport: options.strictNativeExport,
        },
      });

      // Skip folders explicitly (v1).
      if ((doc.metadata as any)?.kind === "folder") {
        emit({
          type: "file:skipped",
          fileId,
          sourceId,
          reason: "is_folder",
          message: "Skipping folder (v1: files-only connector).",
        });
        continue;
      }

      if ((doc.metadata as any)?.unsupportedGoogleMime) {
        emit({
          type: "file:skipped",
          fileId,
          sourceId,
          reason: "unsupported_google_mime",
          message:
            "Skipping Google-native file type because it has no supported export plan.",
        });
        continue;
      }

      if ((doc.metadata as any)?.skippedTooLarge || (doc.metadata as any)?.exportedTooLarge) {
        emit({
          type: "file:skipped",
          fileId,
          sourceId,
          reason: "too_large",
          message: `Skipping file because it exceeds maxBytesPerFile (${maxBytesPerFile}).`,
        });
        continue;
      }

      if ((doc.metadata as any)?.shortcutUnresolved) {
        emit({
          type: "file:skipped",
          fileId,
          sourceId,
          reason: "shortcut_unresolved",
          message: "Skipping shortcut because target could not be resolved.",
        });
        continue;
      }

      const result: IngestResult = await input.engine.ingest({
        sourceId: doc.sourceId,
        content: doc.content,
        assets: doc.assets,
        metadata: doc.metadata as any,
      });

      succeeded += 1;
      emit({
        type: "file:success",
        fileId,
        sourceId,
        chunkCount: result.chunkCount,
      });
    } catch (err) {
      if (isNotFound(err, Boolean(treatForbiddenAsNotFound))) {
        emit({ type: "file:not-found", fileId, sourceId });
        if (deleteOnNotFound) {
          try {
            await input.engine.delete({ sourceId });
            deleted += 1;
          } catch (deleteErr) {
            failed += 1;
            errors.push({ fileId, sourceId, error: deleteErr });
            emit({ type: "file:error", fileId, sourceId, error: deleteErr });
          }
        }
        continue;
      }

      failed += 1;
      errors.push({ fileId, sourceId, error: err });
      emit({ type: "file:error", fileId, sourceId, error: err });
    }
  }

  return {
    fileCount: input.fileIds.length,
    succeeded,
    failed,
    deleted,
    errors,
  };
}


