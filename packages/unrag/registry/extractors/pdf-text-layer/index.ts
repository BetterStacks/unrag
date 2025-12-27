import type { AssetExtractor } from "../../core/types";
import { getAssetBytes } from "../_shared/fetch";
import { capText } from "../_shared/text";

/**
 * Text content item from pdfjs-dist.
 */
interface PdfTextItem {
  str?: string;
}

/**
 * Minimal pdfjs-dist module interface.
 */
interface PdfJsModule {
  getDocument(params: { data: Uint8Array }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNum: number): Promise<{
        getTextContent(): Promise<{ items?: PdfTextItem[] }>;
      }>;
    }>;
  };
}

/**
 * Fast/cheap PDF extraction using the PDF's built-in text layer.
 *
 * This extractor is best-effort: if the PDF has little/no embedded text (scanned PDFs),
 * it returns empty output so the pipeline can fall back to another extractor (e.g. `pdf:llm`).
 *
 * Dependencies (installed by CLI):
 * - `pdfjs-dist`
 */
export function createPdfTextLayerExtractor(): AssetExtractor {
  return {
    name: "pdf:text-layer",
    supports: ({ asset, ctx }) =>
      asset.kind === "pdf" && ctx.assetProcessing.pdf.textLayer.enabled,
    extract: async ({ asset, ctx }) => {
      const cfg = ctx.assetProcessing.pdf.textLayer;
      const fetchConfig = ctx.assetProcessing.fetch;

      const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes);
      const { bytes } = await getAssetBytes({
        data: asset.data,
        fetchConfig,
        maxBytes,
        defaultMediaType: "application/pdf",
      });

      // Dynamic import so the core package can be used without pdfjs unless this extractor is installed.
      const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule;

      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const totalPages: number = Number(doc?.numPages ?? 0);
      const maxPages = Math.max(
        0,
        Math.min(totalPages, cfg.maxPages ?? totalPages)
      );

      let out = "";
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items: PdfTextItem[] = Array.isArray(textContent?.items)
          ? textContent.items
          : [];
        const pageText = items
          .map((it) => (typeof it?.str === "string" ? it.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (pageText) {
          out += (out ? "\n\n" : "") + pageText;
        }
      }

      out = out.trim();
      if (out.length < cfg.minChars) {
        return { texts: [] };
      }

      return {
        texts: [
          {
            label: "text-layer",
            content: capText(out, cfg.maxOutputChars),
            pageRange: totalPages ? [1, maxPages || totalPages] : undefined,
          },
        ],
      };
    },
  };
}


