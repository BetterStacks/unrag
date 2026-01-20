# Extractors

Extractors convert rich media assets (PDFs, images, audio, video, files) into text for embedding. Unrag includes 12 built-in extractors.

## Overview

| Extractor | Group | Description | Default | Worker Only |
|-----------|-------|-------------|---------|-------------|
| `pdf-text-layer` | PDF | Fast text layer extraction | Yes | No |
| `pdf-llm` | PDF | LLM-based extraction | No | No |
| `pdf-ocr` | PDF | OCR scanned PDFs | No | Yes |
| `image-ocr` | Image | Extract text via vision LLM | No | No |
| `image-caption-llm` | Image | Generate captions | No | No |
| `audio-transcribe` | Audio | Whisper transcription | No | No |
| `video-transcribe` | Video | Transcribe audio track | No | No |
| `video-frames` | Video | Sample and analyze frames | No | Yes |
| `file-text` | Files | txt/md/json/csv | Yes | No |
| `file-docx` | Files | Word documents | No | No |
| `file-pptx` | Files | PowerPoint slides | No | No |
| `file-xlsx` | Files | Excel spreadsheets | No | No |

## Installation

```bash
# During init, select extractors interactively
bunx unrag@latest init --rich-media

# Or add specific extractors later
bunx unrag@latest add extractor pdf-text-layer
bunx unrag@latest add extractor image-ocr
```

---

## PDF Extractors

### pdf-text-layer (Recommended)

Fast, cheap extraction using the built-in PDF text layer. Works well for digital PDFs but not scanned documents.

```bash
bunx unrag@latest add extractor pdf-text-layer
```

**Dependencies:** `pdfjs-dist`

**Configuration:**

```ts
// In assetProcessing config
pdf: {
  textLayer: {
    enabled: true,
    maxBytes: 50_000_000,      // 50MB max
    maxOutputChars: 500_000,
    minChars: 100,             // Minimum chars to accept result
    maxPages: 500,             // Optional page limit
  },
},
```

**When to use:**
- Digital PDFs with selectable text
- High volume processing (cheap and fast)
- As first-pass before falling back to LLM/OCR

---

### pdf-llm

LLM-based PDF extraction. Higher quality but more expensive.

```bash
bunx unrag@latest add extractor pdf-llm
```

**Dependencies:** `ai`

**Configuration:**

```ts
pdf: {
  llmExtraction: {
    enabled: true,
    model: "google/gemini-2.0-flash",  // Must support file inputs
    prompt: "Extract all text content from this PDF faithfully...",
    timeoutMs: 120_000,
    maxBytes: 20_000_000,       // 20MB max
    maxOutputChars: 500_000,
  },
},
```

**When to use:**
- Complex layouts (tables, multi-column)
- When text layer extraction fails
- Higher accuracy requirements

---

### pdf-ocr (Worker Only)

OCR for scanned PDFs. Requires native binaries (Poppler, Tesseract).

```bash
bunx unrag@latest add extractor pdf-ocr
```

**Dependencies:** System binaries (not npm packages)
- `pdftoppm` (Poppler)
- `tesseract`

**Configuration:**

```ts
pdf: {
  ocr: {
    enabled: true,
    maxBytes: 50_000_000,
    maxOutputChars: 500_000,
    minChars: 50,
    maxPages: 100,
    pdftoppmPath: "/usr/bin/pdftoppm",  // Optional
    tesseractPath: "/usr/bin/tesseract",
    dpi: 300,                            // Higher = better OCR
    lang: "eng",                         // Tesseract language
  },
},
```

**When to use:**
- Scanned documents
- Image-only PDFs
- Worker/background job environments

---

## Image Extractors

### image-ocr

Extract text from images using a vision-capable LLM.

```bash
bunx unrag@latest add extractor image-ocr
```

**Dependencies:** `ai`

**Configuration:**

```ts
image: {
  ocr: {
    enabled: true,
    model: "openai/gpt-4o-mini",  // Vision-capable model
    prompt: "Extract all visible text from this image...",
    timeoutMs: 30_000,
    maxBytes: 10_000_000,
    maxOutputChars: 50_000,
  },
},
```

**Supported formats:** jpg, png, webp, gif

---

### image-caption-llm

Generate descriptive captions for images.

```bash
bunx unrag@latest add extractor image-caption-llm
```

**Dependencies:** `ai`

**Configuration:**

```ts
image: {
  captionLlm: {
    enabled: true,
    model: "openai/gpt-4o-mini",
    prompt: "Describe this image in detail...",
    timeoutMs: 30_000,
    maxBytes: 10_000_000,
    maxOutputChars: 5_000,
  },
},
```

---

## Audio Extractors

### audio-transcribe

Speech-to-text transcription using Whisper.

```bash
bunx unrag@latest add extractor audio-transcribe
```

**Dependencies:** `ai`

**Configuration:**

```ts
audio: {
  transcription: {
    enabled: true,
    model: "openai/whisper-1",
    timeoutMs: 300_000,        // 5 minutes
    maxBytes: 100_000_000,     // 100MB
  },
},
```

**Supported formats:** mp3, wav, ogg, m4a

---

## Video Extractors

### video-transcribe

Transcribe video audio track.

```bash
bunx unrag@latest add extractor video-transcribe
```

**Dependencies:** `ai`

**Configuration:**

```ts
video: {
  transcription: {
    enabled: true,
    model: "openai/whisper-1",
    timeoutMs: 600_000,        // 10 minutes
    maxBytes: 500_000_000,     // 500MB
  },
},
```

**Supported formats:** mp4, webm, mov

---

### video-frames (Worker Only)

Sample frames and analyze with vision LLM. Requires ffmpeg.

```bash
bunx unrag@latest add extractor video-frames
```

**Dependencies:** `ai`, ffmpeg (system binary)

**Configuration:**

```ts
video: {
  frames: {
    enabled: true,
    sampleFps: 0.5,            // Sample every 2 seconds
    maxFrames: 30,
    ffmpegPath: "/usr/bin/ffmpeg",
    maxBytes: 500_000_000,
    model: "openai/gpt-4o-mini",
    prompt: "Describe what you see in this video frame...",
    timeoutMs: 30_000,         // Per frame
    maxOutputChars: 100_000,
  },
},
```

---

## File Extractors

### file-text (Recommended)

Extract text from common text-based files.

```bash
bunx unrag@latest add extractor file-text
```

**Dependencies:** None

**Configuration:**

```ts
file: {
  text: {
    enabled: true,
    maxBytes: 10_000_000,
    maxOutputChars: 500_000,
    minChars: 10,
  },
},
```

**Supported formats:** txt, md, json, csv, html

---

### file-docx

Extract text from Word documents.

```bash
bunx unrag@latest add extractor file-docx
```

**Dependencies:** `mammoth`

**Configuration:**

```ts
file: {
  docx: {
    enabled: true,
    maxBytes: 50_000_000,
    maxOutputChars: 500_000,
    minChars: 10,
  },
},
```

---

### file-pptx

Extract text from PowerPoint slides.

```bash
bunx unrag@latest add extractor file-pptx
```

**Dependencies:** `jszip`

**Configuration:**

```ts
file: {
  pptx: {
    enabled: true,
    maxBytes: 100_000_000,
    maxOutputChars: 500_000,
    minChars: 10,
  },
},
```

---

### file-xlsx

Extract tables from Excel spreadsheets.

```bash
bunx unrag@latest add extractor file-xlsx
```

**Dependencies:** `xlsx`

**Configuration:**

```ts
file: {
  xlsx: {
    enabled: true,
    maxBytes: 50_000_000,
    maxOutputChars: 500_000,
    minChars: 10,
  },
},
```

---

## Wiring Extractors

After installation, import and configure in `unrag.config.ts`:

```ts
import { defineUnragConfig } from "./lib/unrag/core";
import { createPdfTextLayerExtractor } from "./lib/unrag/extractors/pdf-text-layer";
import { createFileTextExtractor } from "./lib/unrag/extractors/file-text";
import { createImageOcrExtractor } from "./lib/unrag/extractors/image-ocr";

export const unrag = defineUnragConfig({
  embedding: { /* ... */ },
  engine: {
    extractors: [
      createPdfTextLayerExtractor(),
      createFileTextExtractor(),
      createImageOcrExtractor(),
    ],
    assetProcessing: {
      onUnsupportedAsset: "skip",
      onError: "skip",
      concurrency: 2,
      fetch: {
        enabled: true,
        maxBytes: 50_000_000,
        timeoutMs: 30_000,
      },
      pdf: {
        textLayer: { enabled: true, maxBytes: 50_000_000, maxOutputChars: 500_000, minChars: 100 },
        llmExtraction: { enabled: false, /* ... */ },
        ocr: { enabled: false, /* ... */ },
      },
      image: {
        ocr: { enabled: true, model: "openai/gpt-4o-mini", /* ... */ },
        captionLlm: { enabled: false, /* ... */ },
      },
      // ... other asset types
    },
  },
});
```

---

## Custom Extractors

Implement the `AssetExtractor` interface:

```ts
import type { AssetExtractor, AssetInput, AssetExtractorContext, AssetExtractorResult } from "./types";

export function createMyExtractor(): AssetExtractor {
  return {
    name: "my-extractor",

    supports({ asset, ctx }) {
      // Return true if this extractor can handle the asset
      return asset.kind === "file" && asset.data.mediaType === "application/my-format";
    },

    async extract({ asset, ctx }): Promise<AssetExtractorResult> {
      // Fetch bytes if needed
      const bytes = asset.data.kind === "bytes"
        ? asset.data.bytes
        : await fetchAssetBytes(asset.data.url);

      // Extract text
      const text = await myExtractionLogic(bytes);

      return {
        texts: [
          {
            label: "fulltext",
            content: text,
            confidence: 0.95,
          },
        ],
        metadata: {
          extractedBy: "my-extractor",
        },
      };
    },
  };
}
```

### AssetExtractorResult

```ts
type AssetExtractorResult = {
  texts: ExtractedTextItem[];
  skipped?: { code: string; message: string };
  metadata?: Metadata;
  diagnostics?: { model?: string; tokens?: number; seconds?: number };
};

type ExtractedTextItem = {
  label: string;           // "fulltext", "ocr", "transcript", etc.
  content: string;         // Extracted text
  confidence?: number;     // 0-1 confidence score
  pageRange?: [number, number];
  timeRangeSec?: [number, number];
};
```

---

## Extractor Fallback Chain

Extractors are tried in order. First successful extraction wins:

```ts
extractors: [
  createPdfTextLayerExtractor(),  // Try text layer first (fast)
  createPdfLlmExtractor(),         // Fall back to LLM
  createPdfOcrExtractor(),         // Last resort: OCR
],
```

If an extractor returns `{ texts: [], skipped: { code, message } }`, the next extractor is tried.

---

## Asset Processing Events

Monitor extraction with hooks:

```ts
assetProcessing: {
  hooks: {
    onEvent: (event) => {
      switch (event.type) {
        case "asset:start":
          console.log(`Processing ${event.assetKind}: ${event.assetId}`);
          break;
        case "extractor:success":
          console.log(`Extracted ${event.textItemCount} items in ${event.durationMs}ms`);
          break;
        case "extractor:error":
          console.error(`Extraction failed: ${event.errorMessage}`);
          break;
      }
    },
  },
},
```

Event types:
- `asset:start` - Asset processing started
- `asset:skipped` - Asset skipped (with warning)
- `extractor:start` - Extractor attempt started
- `extractor:success` - Extractor succeeded
- `extractor:error` - Extractor failed
