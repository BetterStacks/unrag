import type { AssetExtractor } from "../../core/types";
import { getAssetBytes } from "../_shared/fetch";
import { extFromFilename, normalizeMediaType } from "../_shared/media";
import { capText } from "../_shared/text";

const XLSX_MEDIA =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function createFileXlsxExtractor(): AssetExtractor {
  return {
    name: "file:xlsx",
    supports: ({ asset, ctx }) => {
      if (asset.kind !== "file") return false;
      if (!ctx.assetProcessing.file.xlsx.enabled) return false;
      const filename = asset.data.kind === "bytes" ? asset.data.filename : asset.data.filename;
      const ext = extFromFilename(filename);
      const mt =
        asset.data.kind === "bytes"
          ? normalizeMediaType(asset.data.mediaType)
          : normalizeMediaType(asset.data.mediaType);
      return ext === "xlsx" || mt === XLSX_MEDIA;
    },
    extract: async ({ asset, ctx }) => {
      const cfg = ctx.assetProcessing.file.xlsx;
      const fetchConfig = ctx.assetProcessing.fetch;

      const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes);
      const { bytes } = await getAssetBytes({
        data: asset.data,
        fetchConfig,
        maxBytes,
        defaultMediaType: XLSX_MEDIA,
      });

      const xlsx: any = await import("xlsx");
      const wb = xlsx.read(Buffer.from(bytes), { type: "buffer" });

      const parts: string[] = [];
      for (const sheetName of wb.SheetNames ?? []) {
        if (parts.join("\n\n").length >= cfg.maxOutputChars) break;
        const sheet = wb.Sheets?.[sheetName];
        if (!sheet) continue;
        const csv = String(xlsx.utils.sheet_to_csv(sheet) ?? "").trim();
        if (!csv) continue;
        parts.push(`# Sheet: ${sheetName}\n\n${csv}`);
      }

      const text = capText(parts.join("\n\n"), cfg.maxOutputChars).trim();
      if (text.length < cfg.minChars) return { texts: [] };

      return {
        texts: [{ label: "xlsx", content: text }],
      };
    },
  };
}


