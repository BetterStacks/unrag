# Advanced Chunking Strategies - Technical Specification

**Version:** 1.0
**Status:** Proposed
**Last Updated:** 2026-01-11

---

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [API Design: Hybrid Approach](#api-design-hybrid-approach)
4. [Chunking Strategies](#chunking-strategies)
   - [Word-Based Chunking (Current)](#1-word-based-chunking-current)
   - [Token-Based Chunking](#2-token-based-chunking)
   - [Semantic Chunking](#3-semantic-chunking)
   - [Markdown-Aware Chunking](#4-markdown-aware-chunking)
   - [Recursive Character Splitting](#5-recursive-character-splitting)
   - [Hierarchical Chunking](#6-hierarchical-chunking)
   - [Code-Aware Chunking](#7-code-aware-chunking)
   - [Agentic Chunking](#8-agentic-chunking)
5. [Type Definitions](#type-definitions)
6. [Implementation Phases](#implementation-phases)
7. [Migration Guide](#migration-guide)
8. [Testing Requirements](#testing-requirements)
9. [Performance Considerations](#performance-considerations)
10. [Examples](#examples)

---

## Overview

This specification defines an advanced, extensible chunking system for Unrag that maintains backward compatibility while providing powerful, content-aware chunking strategies.

### Goals

- ✅ **Backward Compatibility**: Existing `chunking: { chunkSize, chunkOverlap }` API continues to work
- ✅ **Progressive Enhancement**: Users can adopt advanced features incrementally
- ✅ **Type Safety**: Full TypeScript type safety for all chunking options
- ✅ **Flexibility**: Support per-document chunker overrides
- ✅ **Discoverability**: Named chunkers via `chunkers.*` namespace
- ✅ **Performance**: Efficient implementations with minimal overhead

### Non-Goals

- ❌ Breaking changes to existing API
- ❌ Runtime chunker switching (determined at config/ingest time)
- ❌ Automatic chunker selection (user explicitly chooses)

---

## Design Principles

### 1. Hybrid Approach

Support three levels of configuration:

```typescript
// Level 1: Simple API (current, backward compatible)
chunking: { chunkSize: 200, chunkOverlap: 40 }

// Level 2: Named chunkers (recommended)
chunker: chunkers.semantic({ maxChunkSize: 500 })

// Level 3: Custom chunker function
chunker: myCustomChunkerFunction
```

### 2. Configuration Hierarchy

Chunker resolution follows this priority:

1. **Per-ingest override**: `engine.ingest({ chunker: ... })` or `engine.ingest({ chunking: ... })`
2. **Engine config**: `defineConfig({ chunker: ... })` or `defineConfig({ defaults: { ... } })`
3. **Default fallback**: Word-based chunker with `{ chunkSize: 200, chunkOverlap: 40 }`

### 3. Backward Compatibility Rules

- If `chunking` is provided (old API), use word-based chunker with those options
- If `chunker` is provided (new API), use that chunker
- If both provided, `chunker` takes precedence
- `defaults.chunking` maps to word-based chunker options

### 4. Type System Design

Each chunker has its own strongly-typed options:

```typescript
type Chunker = (content: string, options: any) => ChunkText[];

type ChunkerFactory<T> = (options: T) => Chunker;

// Factory functions are strongly typed
chunkers.semantic: ChunkerFactory<SemanticChunkerOptions>
chunkers.token: ChunkerFactory<TokenChunkerOptions>
// etc.
```

---

## API Design: Hybrid Approach

### Core Type Definitions

```typescript
// Current types (unchanged)
export type ChunkText = {
  index: number;
  content: string;
  tokenCount: number;
  // NEW: Optional metadata from chunker
  metadata?: Metadata;
};

export type ChunkingOptions = {
  chunkSize: number;
  chunkOverlap: number;
};

export type Chunker = (content: string, options: ChunkingOptions) => ChunkText[];

// NEW: Extended chunker signature for advanced chunkers
export type AdvancedChunker<TOptions = any> = (
  content: string,
  options: TOptions
) => ChunkText[];

// NEW: Chunker factory type
export type ChunkerFactory<TOptions> = (options: TOptions) => Chunker;
```

### Configuration Interface

```typescript
// Engine config (updated)
export type ContextEngineConfig = {
  embedding: EmbeddingProvider;
  store: VectorStore;

  // OLD API: Still supported for backward compatibility
  defaults?: Partial<ChunkingOptions>;

  // NEW API: Advanced chunker support
  chunker?: Chunker;

  // ... rest of config
};

// Ingest input (updated)
export type IngestInput = {
  sourceId: string;
  content: string;
  metadata?: Metadata;

  // OLD API: Override chunking options (word-based)
  chunking?: Partial<ChunkingOptions>;

  // NEW API: Override with custom chunker
  chunker?: Chunker;

  assets?: AssetInput[];
  assetProcessing?: DeepPartial<AssetProcessingConfig>;
};
```

### Chunkers Namespace

```typescript
// NEW: registry/core/chunkers/index.ts
export const chunkers = {
  /**
   * Word-based sliding window chunker (current implementation).
   * This is the default chunker used when only `chunking` options are provided.
   */
  word: (options?: Partial<ChunkingOptions>) => Chunker;

  /**
   * Token-based chunking using actual LLM tokenizers.
   * Accurately counts tokens instead of words for precise chunk sizing.
   */
  token: (options: TokenChunkerOptions) => Chunker;

  /**
   * Semantic chunking that respects natural language boundaries.
   * Splits on paragraphs, sentences, or sections while maintaining coherence.
   */
  semantic: (options: SemanticChunkerOptions) => Chunker;

  /**
   * Markdown-aware chunking that respects document structure.
   * Preserves code blocks, respects headers, and maintains hierarchy.
   */
  markdown: (options: MarkdownChunkerOptions) => Chunker;

  /**
   * Recursive character splitting with fallback separators.
   * Tries larger splits first (paragraphs), falls back to smaller (sentences, words).
   */
  recursive: (options: RecursiveChunkerOptions) => Chunker;

  /**
   * Hierarchical parent-child chunking for long documents.
   * Creates small, precise chunks with larger parent context.
   */
  hierarchical: (options: HierarchicalChunkerOptions) => Chunker;

  /**
   * Code-aware chunking for source code documents.
   * Splits on function/class boundaries while preserving context.
   */
  code: (options: CodeChunkerOptions) => Chunker;

  /**
   * LLM-powered intelligent chunking (expensive, slow).
   * Uses an LLM to intelligently split and optionally summarize chunks.
   */
  agentic: (options: AgenticChunkerOptions) => Chunker;

  /**
   * Bring your own chunker function.
   */
  custom: (fn: Chunker) => Chunker;
};
```

### Resolution Logic

```typescript
// NEW: registry/core/chunking.ts
export const resolveChunker = (
  configChunker?: Chunker,
  inputChunker?: Chunker,
  inputChunking?: Partial<ChunkingOptions>,
  defaultChunking?: Partial<ChunkingOptions>
): { chunker: Chunker; options: ChunkingOptions } => {
  // Priority 1: Explicit chunker from ingest input
  if (inputChunker) {
    return { chunker: inputChunker, options: resolveChunkingOptions(inputChunking) };
  }

  // Priority 2: Explicit chunker from config
  if (configChunker) {
    return { chunker: configChunker, options: resolveChunkingOptions(inputChunking) };
  }

  // Priority 3: Legacy chunking options (word-based chunker)
  const options = resolveChunkingOptions(inputChunking, defaultChunking);
  return { chunker: defaultChunker, options };
};
```

---

## Chunking Strategies

### 1. Word-Based Chunking (Current)

**Status:** Implemented
**Use Case:** Simple documents, backward compatibility

#### Options

```typescript
export type WordChunkerOptions = {
  /**
   * Number of words per chunk.
   * @default 200
   */
  chunkSize: number;

  /**
   * Number of overlapping words between consecutive chunks.
   * @default 40
   */
  chunkOverlap: number;

  /**
   * Word splitting regex pattern.
   * @default /\s+/
   */
  wordPattern?: RegExp;
};
```

#### Implementation

**File:** `registry/core/chunkers/word.ts`

```typescript
export const createWordChunker = (
  options?: Partial<WordChunkerOptions>
): Chunker => {
  const opts: WordChunkerOptions = {
    chunkSize: options?.chunkSize ?? DEFAULT_CHUNK_SIZE,
    chunkOverlap: options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
    wordPattern: options?.wordPattern ?? /\s+/,
  };

  return (content: string, _runtimeOptions: ChunkingOptions) => {
    const words = content
      .trim()
      .split(opts.wordPattern)
      .filter(Boolean);

    const chunks: ChunkText[] = [];
    const stride = Math.max(1, opts.chunkSize - opts.chunkOverlap);

    let cursor = 0;
    let index = 0;

    while (cursor < words.length) {
      const slice = words.slice(cursor, cursor + opts.chunkSize);
      const chunkContent = slice.join(" ").trim();

      if (chunkContent.length === 0) break;

      chunks.push({
        index,
        content: chunkContent,
        tokenCount: slice.length, // Word count, not actual tokens
      });

      cursor += stride;
      index += 1;
    }

    return chunks;
  };
};
```

#### Example Usage

```typescript
// Legacy API (unchanged)
const engine = createContextEngine({
  defaults: { chunkSize: 200, chunkOverlap: 40 }
});

// New API
const engine = createContextEngine({
  chunker: chunkers.word({ chunkSize: 300, chunkOverlap: 50 })
});
```

---

### 2. Token-Based Chunking

**Status:** Proposed (Phase 1)
**Use Case:** Production RAG with accurate token counting

#### Options

```typescript
export type TokenChunkerOptions = {
  /**
   * Maximum number of tokens per chunk.
   * @default 512
   */
  maxTokens: number;

  /**
   * Number of overlapping tokens between consecutive chunks.
   * @default 50
   */
  overlapTokens: number;

  /**
   * Tokenizer to use. Can be a named tokenizer or custom function.
   * @default "cl100k_base" (OpenAI)
   */
  tokenizer: TokenizerType | TokenizerFunction;

  /**
   * Strategy for handling tokens that exceed maxTokens.
   * - "truncate": Cut off at maxTokens
   * - "split": Split into smaller chunks
   * @default "split"
   */
  overflowStrategy?: "truncate" | "split";

  /**
   * Whether to preserve sentence boundaries when splitting.
   * @default true
   */
  preserveSentences?: boolean;
};

export type TokenizerType =
  | "cl100k_base"      // OpenAI (GPT-4, GPT-3.5, text-embedding-3-*)
  | "p50k_base"        // OpenAI (GPT-3, Codex)
  | "r50k_base"        // OpenAI (GPT-3)
  | "gpt2"             // GPT-2
  | "o200k_base";      // OpenAI (GPT-4o)

export type TokenizerFunction = {
  encode: (text: string) => number[];
  decode: (tokens: number[]) => string;
};
```

#### Dependencies

```json
{
  "dependencies": {
    "js-tiktoken": "^1.0.14"  // OpenAI tokenizer
  }
}
```

#### Implementation

**File:** `registry/core/chunkers/token.ts`

```typescript
import { Tiktoken, TiktokenEncoding, getEncoding } from "js-tiktoken";

export const createTokenChunker = (
  options: TokenChunkerOptions
): Chunker => {
  const opts: Required<TokenChunkerOptions> = {
    maxTokens: options.maxTokens ?? 512,
    overlapTokens: options.overlapTokens ?? 50,
    tokenizer: options.tokenizer ?? "cl100k_base",
    overflowStrategy: options.overflowStrategy ?? "split",
    preserveSentences: options.preserveSentences ?? true,
  };

  // Initialize tokenizer
  let encoder: Tiktoken;
  if (typeof opts.tokenizer === "string") {
    encoder = getEncoding(opts.tokenizer as TiktokenEncoding);
  } else {
    // Custom tokenizer wrapper
    encoder = {
      encode: opts.tokenizer.encode,
      decode: opts.tokenizer.decode,
      free: () => {}, // no-op for custom
    } as Tiktoken;
  }

  return (content: string, _runtimeOptions: ChunkingOptions) => {
    const chunks: ChunkText[] = [];

    // Tokenize entire content
    const tokens = encoder.encode(content);
    const stride = Math.max(1, opts.maxTokens - opts.overlapTokens);

    let cursor = 0;
    let index = 0;

    while (cursor < tokens.length) {
      let endCursor = Math.min(cursor + opts.maxTokens, tokens.length);
      let chunkTokens = tokens.slice(cursor, endCursor);

      // If preserveSentences, adjust boundary to end of sentence
      if (opts.preserveSentences && endCursor < tokens.length) {
        const decoded = encoder.decode(chunkTokens);
        const lastSentenceEnd = Math.max(
          decoded.lastIndexOf(". "),
          decoded.lastIndexOf(".\n"),
          decoded.lastIndexOf("! "),
          decoded.lastIndexOf("? ")
        );

        if (lastSentenceEnd > decoded.length * 0.5) {
          // Found a sentence boundary in the latter half of chunk
          const adjustedDecoded = decoded.slice(0, lastSentenceEnd + 1);
          chunkTokens = encoder.encode(adjustedDecoded);
          endCursor = cursor + chunkTokens.length;
        }
      }

      const chunkContent = encoder.decode(chunkTokens).trim();

      if (chunkContent.length === 0) break;

      chunks.push({
        index,
        content: chunkContent,
        tokenCount: chunkTokens.length,
        metadata: {
          tokenizer: typeof opts.tokenizer === "string"
            ? opts.tokenizer
            : "custom",
          actualTokenCount: chunkTokens.length,
        },
      });

      cursor += stride;
      index += 1;
    }

    // Free tokenizer resources
    if (typeof opts.tokenizer === "string") {
      encoder.free();
    }

    return chunks;
  };
};
```

#### Example Usage

```typescript
// Basic usage with OpenAI tokenizer
const engine = createContextEngine({
  chunker: chunkers.token({
    maxTokens: 512,
    overlapTokens: 50,
    tokenizer: "cl100k_base"
  })
});

// Custom tokenizer
import { encoding_for_model } from "js-tiktoken";

const customTokenizer = encoding_for_model("gpt-4");
const engine = createContextEngine({
  chunker: chunkers.token({
    maxTokens: 8192, // text-embedding-3-large limit
    tokenizer: {
      encode: (text) => customTokenizer.encode(text),
      decode: (tokens) => customTokenizer.decode(tokens),
    }
  })
});
```

#### Testing Requirements

- [ ] Verify token counts match embedding model limits
- [ ] Test with various tokenizers (cl100k_base, o200k_base, gpt2)
- [ ] Test sentence boundary preservation
- [ ] Test overflow strategy (truncate vs split)
- [ ] Benchmark performance vs word-based chunking

---

### 3. Semantic Chunking

**Status:** Proposed (Phase 1)
**Use Case:** Natural language documents, articles, documentation

#### Options

```typescript
export type SemanticChunkerOptions = {
  /**
   * Maximum chunk size (in words or tokens).
   * @default 500
   */
  maxChunkSize: number;

  /**
   * Minimum chunk size to avoid tiny chunks.
   * @default 50
   */
  minChunkSize: number;

  /**
   * Unit for measuring chunk size.
   * @default "words"
   */
  sizeUnit: "words" | "tokens" | "characters";

  /**
   * Tokenizer (only used if sizeUnit is "tokens").
   */
  tokenizer?: TokenizerType | TokenizerFunction;

  /**
   * Primary splitting boundary.
   * @default "paragraph"
   */
  splitOn: "paragraph" | "sentence" | "section";

  /**
   * Overlap configuration.
   */
  overlap?: {
    /**
     * How to create overlap between chunks.
     * - "sentence": Include last N sentences from previous chunk
     * - "words": Include last N words from previous chunk
     * - "percentage": Overlap by X% of chunk size
     * @default "sentence"
     */
    mode: "sentence" | "words" | "percentage";

    /**
     * Overlap amount (meaning depends on mode).
     * - sentence mode: number of sentences
     * - words mode: number of words
     * - percentage mode: percentage (0-100)
     * @default 1 (for sentence mode)
     */
    value: number;
  };

  /**
   * Whether to merge small consecutive chunks.
   * @default true
   */
  mergeSmallChunks?: boolean;

  /**
   * Custom regex patterns for splitting.
   */
  patterns?: {
    paragraph?: RegExp;  // default: /\n\n+/
    sentence?: RegExp;   // default: /[.!?]+\s+/
    section?: RegExp;    // default: /\n#{1,6}\s+/
  };
};
```

#### Implementation

**File:** `registry/core/chunkers/semantic.ts`

```typescript
export const createSemanticChunker = (
  options: SemanticChunkerOptions
): Chunker => {
  const opts: Required<Omit<SemanticChunkerOptions, "tokenizer">> = {
    maxChunkSize: options.maxChunkSize ?? 500,
    minChunkSize: options.minChunkSize ?? 50,
    sizeUnit: options.sizeUnit ?? "words",
    splitOn: options.splitOn ?? "paragraph",
    overlap: options.overlap ?? { mode: "sentence", value: 1 },
    mergeSmallChunks: options.mergeSmallChunks ?? true,
    patterns: {
      paragraph: options.patterns?.paragraph ?? /\n\n+/,
      sentence: options.patterns?.sentence ?? /[.!?]+\s+/,
      section: options.patterns?.section ?? /\n#{1,6}\s+/,
    },
  };

  // Initialize tokenizer if needed
  let encoder: Tiktoken | null = null;
  if (opts.sizeUnit === "tokens" && options.tokenizer) {
    if (typeof options.tokenizer === "string") {
      encoder = getEncoding(options.tokenizer as TiktokenEncoding);
    }
  }

  const measureSize = (text: string): number => {
    switch (opts.sizeUnit) {
      case "words":
        return text.split(/\s+/).filter(Boolean).length;
      case "characters":
        return text.length;
      case "tokens":
        if (encoder) {
          return encoder.encode(text).length;
        }
        // Fallback to word count
        return text.split(/\s+/).filter(Boolean).length;
      default:
        return 0;
    }
  };

  return (content: string, _runtimeOptions: ChunkingOptions) => {
    const chunks: ChunkText[] = [];

    // Step 1: Split content by primary boundary
    let segments: string[];
    switch (opts.splitOn) {
      case "paragraph":
        segments = content.split(opts.patterns.paragraph).filter(Boolean);
        break;
      case "sentence":
        segments = content.split(opts.patterns.sentence)
          .filter(Boolean)
          .map(s => s.trim() + (s.match(/[.!?]$/) ? "" : "."));
        break;
      case "section":
        segments = content.split(opts.patterns.section).filter(Boolean);
        break;
      default:
        segments = [content];
    }

    // Step 2: Combine segments into chunks
    let currentChunk: string[] = [];
    let currentSize = 0;
    let index = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!.trim();
      const segmentSize = measureSize(segment);

      // If adding this segment would exceed max size, flush current chunk
      if (currentSize > 0 && currentSize + segmentSize > opts.maxChunkSize) {
        // Flush current chunk
        const chunkContent = currentChunk.join(
          opts.splitOn === "sentence" ? " " : "\n\n"
        );

        chunks.push({
          index,
          content: chunkContent,
          tokenCount: measureSize(chunkContent),
          metadata: {
            splitOn: opts.splitOn,
            sizeUnit: opts.sizeUnit,
          },
        });

        // Start new chunk with overlap
        if (opts.overlap.mode === "sentence" && opts.splitOn === "sentence") {
          // Include last N sentences
          const overlapCount = Math.min(opts.overlap.value, currentChunk.length);
          currentChunk = currentChunk.slice(-overlapCount);
          currentSize = measureSize(currentChunk.join(" "));
        } else if (opts.overlap.mode === "words") {
          // Include last N words
          const allWords = chunkContent.split(/\s+/).filter(Boolean);
          const overlapWords = allWords.slice(-opts.overlap.value);
          currentChunk = [overlapWords.join(" ")];
          currentSize = opts.overlap.value;
        } else {
          currentChunk = [];
          currentSize = 0;
        }

        index += 1;
      }

      // Add segment to current chunk
      currentChunk.push(segment);
      currentSize += segmentSize;
    }

    // Flush final chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join(
        opts.splitOn === "sentence" ? " " : "\n\n"
      );

      // Merge with previous chunk if too small
      if (
        opts.mergeSmallChunks &&
        chunks.length > 0 &&
        measureSize(chunkContent) < opts.minChunkSize
      ) {
        const lastChunk = chunks[chunks.length - 1]!;
        lastChunk.content += (opts.splitOn === "sentence" ? " " : "\n\n") + chunkContent;
        lastChunk.tokenCount = measureSize(lastChunk.content);
      } else {
        chunks.push({
          index,
          content: chunkContent,
          tokenCount: measureSize(chunkContent),
          metadata: {
            splitOn: opts.splitOn,
            sizeUnit: opts.sizeUnit,
          },
        });
      }
    }

    // Free tokenizer
    if (encoder) {
      encoder.free();
    }

    return chunks;
  };
};
```

#### Example Usage

```typescript
// Split on paragraphs, overlap by 1 sentence
const engine = createContextEngine({
  chunker: chunkers.semantic({
    maxChunkSize: 500,
    splitOn: "paragraph",
    overlap: { mode: "sentence", value: 1 }
  })
});

// Split on sentences, token-based sizing
const engine = createContextEngine({
  chunker: chunkers.semantic({
    maxChunkSize: 512,
    sizeUnit: "tokens",
    tokenizer: "cl100k_base",
    splitOn: "sentence",
    overlap: { mode: "percentage", value: 10 } // 10% overlap
  })
});

// Custom patterns for specialized content
const engine = createContextEngine({
  chunker: chunkers.semantic({
    maxChunkSize: 800,
    splitOn: "section",
    patterns: {
      section: /\n---+\n/  // Split on horizontal rules
    }
  })
});
```

#### Testing Requirements

- [ ] Test paragraph splitting with various paragraph styles
- [ ] Test sentence splitting with edge cases (abbreviations, decimals)
- [ ] Test section splitting with markdown headers
- [ ] Verify overlap modes (sentence, words, percentage)
- [ ] Test mergeSmallChunks behavior
- [ ] Test custom patterns

---

### 4. Markdown-Aware Chunking

**Status:** Proposed (Phase 2)
**Use Case:** Documentation, README files, blog posts, technical writing

#### Options

```typescript
export type MarkdownChunkerOptions = {
  /**
   * Maximum chunk size (in words or tokens).
   * @default 800
   */
  maxChunkSize: number;

  /**
   * Minimum chunk size.
   * @default 100
   */
  minChunkSize: number;

  /**
   * Unit for measuring chunk size.
   * @default "words"
   */
  sizeUnit: "words" | "tokens";

  /**
   * Tokenizer (only used if sizeUnit is "tokens").
   */
  tokenizer?: TokenizerType | TokenizerFunction;

  /**
   * Keep code blocks intact (don't split mid-block).
   * @default true
   */
  respectCodeBlocks: boolean;

  /**
   * Split at header boundaries.
   * @default true
   */
  respectHeaders: boolean;

  /**
   * Which header levels to split on (1-6).
   * Empty array means split on all headers.
   * @default [1, 2, 3]
   */
  headerLevels: number[];

  /**
   * Include parent header context in each chunk.
   * Example: chunk includes "# Guide\n## Installation\n### Using npm"
   * @default true
   */
  includeHeaderContext: boolean;

  /**
   * How to format header context when included.
   * - "full": Include full markdown syntax "# Title\n## Subtitle"
   * - "breadcrumb": Format as "Title > Subtitle > Section"
   * - "prefix": Add as metadata-only prefix
   * @default "full"
   */
  headerContextFormat?: "full" | "breadcrumb" | "prefix";

  /**
   * Keep lists together (don't split mid-list).
   * @default true
   */
  respectLists: boolean;

  /**
   * Keep tables together (don't split mid-table).
   * @default true
   */
  respectTables: boolean;

  /**
   * Keep blockquotes together.
   * @default true
   */
  respectBlockquotes: boolean;

  /**
   * Chunk overlap in words/tokens.
   * @default 50
   */
  overlap: number;
};
```

#### Implementation

**File:** `registry/core/chunkers/markdown.ts`

```typescript
type MarkdownNode = {
  type: "header" | "paragraph" | "code" | "list" | "table" | "blockquote" | "text";
  level?: number;  // For headers (1-6)
  content: string;
  startPos: number;
  endPos: number;
  language?: string;  // For code blocks
};

export const createMarkdownChunker = (
  options: MarkdownChunkerOptions
): Chunker => {
  const opts: Required<Omit<MarkdownChunkerOptions, "tokenizer" | "headerContextFormat">> = {
    maxChunkSize: options.maxChunkSize ?? 800,
    minChunkSize: options.minChunkSize ?? 100,
    sizeUnit: options.sizeUnit ?? "words",
    respectCodeBlocks: options.respectCodeBlocks ?? true,
    respectHeaders: options.respectHeaders ?? true,
    headerLevels: options.headerLevels ?? [1, 2, 3],
    includeHeaderContext: options.includeHeaderContext ?? true,
    respectLists: options.respectLists ?? true,
    respectTables: options.respectTables ?? true,
    respectBlockquotes: options.respectBlockquotes ?? true,
    overlap: options.overlap ?? 50,
  };

  const headerContextFormat = options.headerContextFormat ?? "full";

  // Initialize tokenizer if needed
  let encoder: Tiktoken | null = null;
  if (opts.sizeUnit === "tokens" && options.tokenizer) {
    if (typeof options.tokenizer === "string") {
      encoder = getEncoding(options.tokenizer as TiktokenEncoding);
    }
  }

  const measureSize = (text: string): number => {
    if (opts.sizeUnit === "tokens" && encoder) {
      return encoder.encode(text).length;
    }
    return text.split(/\s+/).filter(Boolean).length;
  };

  /**
   * Parse markdown into structural nodes.
   */
  const parseMarkdown = (content: string): MarkdownNode[] => {
    const nodes: MarkdownNode[] = [];
    const lines = content.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i]!;

      // Code block (fenced)
      if (line.trim().startsWith("```")) {
        const language = line.trim().slice(3).trim();
        const startPos = i;
        i++;

        let codeLines = [];
        while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }

        nodes.push({
          type: "code",
          content: "```" + language + "\n" + codeLines.join("\n") + "\n```",
          startPos,
          endPos: i,
          language,
        });

        i++; // Skip closing ```
        continue;
      }

      // Header
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        nodes.push({
          type: "header",
          level: headerMatch[1]!.length,
          content: line,
          startPos: i,
          endPos: i,
        });
        i++;
        continue;
      }

      // Table (starts with |)
      if (line.trim().startsWith("|")) {
        const startPos = i;
        let tableLines = [];

        while (i < lines.length && lines[i]!.trim().startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }

        nodes.push({
          type: "table",
          content: tableLines.join("\n"),
          startPos,
          endPos: i - 1,
        });
        continue;
      }

      // List (ordered or unordered)
      if (line.match(/^\s*[-*+]\s/) || line.match(/^\s*\d+\.\s/)) {
        const startPos = i;
        let listLines = [];
        const indent = line.match(/^\s*/)?.[0].length ?? 0;

        while (i < lines.length) {
          const currentLine = lines[i]!;
          const currentIndent = currentLine.match(/^\s*/)?.[0].length ?? 0;

          // Continue if line is part of list (item or continuation)
          if (
            currentLine.match(/^\s*[-*+]\s/) ||
            currentLine.match(/^\s*\d+\.\s/) ||
            (currentIndent > indent && currentLine.trim().length > 0)
          ) {
            listLines.push(currentLine);
            i++;
          } else if (currentLine.trim().length === 0) {
            // Empty line might be part of list
            listLines.push(currentLine);
            i++;
          } else {
            break;
          }
        }

        nodes.push({
          type: "list",
          content: listLines.join("\n"),
          startPos,
          endPos: i - 1,
        });
        continue;
      }

      // Blockquote
      if (line.trim().startsWith(">")) {
        const startPos = i;
        let quoteLines = [];

        while (i < lines.length && lines[i]!.trim().startsWith(">")) {
          quoteLines.push(lines[i]);
          i++;
        }

        nodes.push({
          type: "blockquote",
          content: quoteLines.join("\n"),
          startPos,
          endPos: i - 1,
        });
        continue;
      }

      // Regular paragraph
      if (line.trim().length > 0) {
        const startPos = i;
        let paraLines = [];

        while (
          i < lines.length &&
          lines[i]!.trim().length > 0 &&
          !lines[i]!.match(/^#{1,6}\s/) &&
          !lines[i]!.trim().startsWith("```") &&
          !lines[i]!.trim().startsWith("|") &&
          !lines[i]!.match(/^\s*[-*+]\s/) &&
          !lines[i]!.match(/^\s*\d+\.\s/) &&
          !lines[i]!.trim().startsWith(">")
        ) {
          paraLines.push(lines[i]);
          i++;
        }

        nodes.push({
          type: "paragraph",
          content: paraLines.join("\n"),
          startPos,
          endPos: i - 1,
        });
        continue;
      }

      // Skip empty lines
      i++;
    }

    return nodes;
  };

  /**
   * Build header context stack.
   */
  const buildHeaderStack = (nodes: MarkdownNode[], nodeIndex: number): string[] => {
    const headers: Array<{ level: number; title: string }> = [];

    // Scan backwards to find parent headers
    for (let i = nodeIndex - 1; i >= 0; i--) {
      const node = nodes[i]!;
      if (node.type === "header") {
        const level = node.level!;

        // Remove any headers at same or lower level
        while (headers.length > 0 && headers[headers.length - 1]!.level >= level) {
          headers.pop();
        }

        headers.push({
          level,
          title: node.content.replace(/^#+\s+/, "").trim(),
        });
      }
    }

    return headers.reverse().map(h => h.title);
  };

  return (content: string, _runtimeOptions: ChunkingOptions) => {
    const chunks: ChunkText[] = [];
    const nodes = parseMarkdown(content);

    let currentChunk: MarkdownNode[] = [];
    let currentSize = 0;
    let index = 0;
    let headerStack: string[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;

      // Update header stack
      if (node.type === "header") {
        if (opts.respectHeaders && opts.headerLevels.includes(node.level!)) {
          // Flush current chunk before this header
          if (currentChunk.length > 0) {
            const chunkContent = buildChunkContent(currentChunk, headerStack);
            chunks.push({
              index,
              content: chunkContent,
              tokenCount: measureSize(chunkContent),
              metadata: {
                headers: [...headerStack],
                hasCodeBlock: currentChunk.some(n => n.type === "code"),
                hasTable: currentChunk.some(n => n.type === "table"),
              },
            });

            currentChunk = [];
            currentSize = 0;
            index += 1;
          }
        }

        headerStack = buildHeaderStack(nodes, i);
        headerStack.push(node.content.replace(/^#+\s+/, "").trim());
      }

      const nodeSize = measureSize(node.content);

      // Check if adding this node would exceed max size
      if (currentSize > 0 && currentSize + nodeSize > opts.maxChunkSize) {
        // Check if we should keep this node intact
        const shouldKeepIntact =
          (node.type === "code" && opts.respectCodeBlocks) ||
          (node.type === "list" && opts.respectLists) ||
          (node.type === "table" && opts.respectTables) ||
          (node.type === "blockquote" && opts.respectBlockquotes);

        if (shouldKeepIntact && nodeSize <= opts.maxChunkSize) {
          // Flush current chunk, start new one with this node
          const chunkContent = buildChunkContent(currentChunk, headerStack);
          chunks.push({
            index,
            content: chunkContent,
            tokenCount: measureSize(chunkContent),
            metadata: {
              headers: [...headerStack],
              hasCodeBlock: currentChunk.some(n => n.type === "code"),
              hasTable: currentChunk.some(n => n.type === "table"),
            },
          });

          currentChunk = [node];
          currentSize = nodeSize;
          index += 1;
          continue;
        } else if (!shouldKeepIntact) {
          // Can split this node (paragraph, text)
          const chunkContent = buildChunkContent(currentChunk, headerStack);
          chunks.push({
            index,
            content: chunkContent,
            tokenCount: measureSize(chunkContent),
            metadata: {
              headers: [...headerStack],
              hasCodeBlock: currentChunk.some(n => n.type === "code"),
              hasTable: currentChunk.some(n => n.type === "table"),
            },
          });

          currentChunk = [];
          currentSize = 0;
          index += 1;
        }
      }

      // Add node to current chunk
      currentChunk.push(node);
      currentSize += nodeSize;
    }

    // Flush final chunk
    if (currentChunk.length > 0) {
      const chunkContent = buildChunkContent(currentChunk, headerStack);
      chunks.push({
        index,
        content: chunkContent,
        tokenCount: measureSize(chunkContent),
        metadata: {
          headers: [...headerStack],
          hasCodeBlock: currentChunk.some(n => n.type === "code"),
          hasTable: currentChunk.some(n => n.type === "table"),
        },
      });
    }

    // Free tokenizer
    if (encoder) {
      encoder.free();
    }

    return chunks;
  };

  function buildChunkContent(nodes: MarkdownNode[], headers: string[]): string {
    let content = "";

    // Add header context if enabled
    if (opts.includeHeaderContext && headers.length > 0) {
      if (headerContextFormat === "full") {
        content = headers.map((h, i) => "#".repeat(i + 1) + " " + h).join("\n") + "\n\n";
      } else if (headerContextFormat === "breadcrumb") {
        content = headers.join(" > ") + "\n\n";
      }
      // "prefix" mode adds headers to metadata only, not content
    }

    content += nodes.map(n => n.content).join("\n\n");

    return content.trim();
  }
};
```

#### Example Usage

```typescript
// Documentation chunking
const engine = createContextEngine({
  chunker: chunkers.markdown({
    maxChunkSize: 800,
    respectCodeBlocks: true,
    respectHeaders: true,
    headerLevels: [1, 2, 3],
    includeHeaderContext: true,
    headerContextFormat: "full"
  })
});

// README chunking with breadcrumb context
const engine = createContextEngine({
  chunker: chunkers.markdown({
    maxChunkSize: 600,
    includeHeaderContext: true,
    headerContextFormat: "breadcrumb", // "Guide > Installation > Using npm"
    respectCodeBlocks: true,
    respectLists: true
  })
});

// Per-document override for blog posts
await engine.ingest({
  sourceId: "blog:post-123",
  content: blogMarkdown,
  chunker: chunkers.markdown({
    maxChunkSize: 1000,
    headerLevels: [1, 2], // Only split on h1 and h2
    respectHeaders: true
  })
});
```

#### Testing Requirements

- [ ] Test header parsing (h1-h6)
- [ ] Test code block preservation (with and without language)
- [ ] Test list preservation (ordered, unordered, nested)
- [ ] Test table preservation
- [ ] Test blockquote preservation
- [ ] Test header context inclusion (all formats)
- [ ] Test with complex nested markdown
- [ ] Test edge cases (malformed markdown)

---

### 5. Recursive Character Splitting

**Status:** Proposed (Phase 2)
**Use Case:** General text with fallback splitting strategy

#### Options

```typescript
export type RecursiveChunkerOptions = {
  /**
   * Maximum chunk size (in characters).
   * @default 1000
   */
  chunkSize: number;

  /**
   * Chunk overlap (in characters).
   * @default 200
   */
  chunkOverlap: number;

  /**
   * List of separators to try in order (from largest to smallest).
   * The chunker will try to split on the first separator, then fall back
   * to the next if chunks are still too large.
   * @default ["\n\n", "\n", ". ", " ", ""]
   */
  separators: string[];

  /**
   * Whether to keep the separator in the chunk.
   * @default true
   */
  keepSeparator: boolean;

  /**
   * How to keep the separator.
   * - "end": Append to chunk ("Hello.\n")
   * - "start": Prepend to next chunk ("\nWorld")
   * @default "end"
   */
  separatorPosition?: "start" | "end";
};
```

#### Implementation

**File:** `registry/core/chunkers/recursive.ts`

```typescript
export const createRecursiveChunker = (
  options: RecursiveChunkerOptions
): Chunker => {
  const opts: Required<RecursiveChunkerOptions> = {
    chunkSize: options.chunkSize ?? 1000,
    chunkOverlap: options.chunkOverlap ?? 200,
    separators: options.separators ?? ["\n\n", "\n", ". ", " ", ""],
    keepSeparator: options.keepSeparator ?? true,
    separatorPosition: options.separatorPosition ?? "end",
  };

  /**
   * Split text on a given separator.
   */
  const splitText = (text: string, separator: string): string[] => {
    if (separator === "") {
      return text.split("");
    }

    const parts = text.split(separator);

    if (!opts.keepSeparator) {
      return parts;
    }

    // Keep separator with appropriate part
    if (opts.separatorPosition === "end") {
      return parts.map((part, i) =>
        i < parts.length - 1 ? part + separator : part
      );
    } else {
      return parts.map((part, i) =>
        i > 0 ? separator + part : part
      );
    }
  };

  /**
   * Recursively split text using fallback separators.
   */
  const recursiveSplit = (
    text: string,
    separators: string[]
  ): string[] => {
    if (text.length <= opts.chunkSize) {
      return [text];
    }

    if (separators.length === 0) {
      // No separators left, split by character
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += opts.chunkSize) {
        chunks.push(text.slice(i, i + opts.chunkSize));
      }
      return chunks;
    }

    const [separator, ...restSeparators] = separators;
    const parts = splitText(text, separator!);

    // Combine parts into chunks
    const chunks: string[] = [];
    let currentChunk = "";

    for (const part of parts) {
      if (part.trim().length === 0) continue;

      // If part itself is larger than chunk size, recursively split it
      if (part.length > opts.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = "";
        }

        // Recursively split with next separator
        const subChunks = recursiveSplit(part, restSeparators);
        chunks.push(...subChunks);
        continue;
      }

      // Check if adding this part would exceed chunk size
      if (currentChunk.length + part.length > opts.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = part;
      } else {
        currentChunk += part;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  };

  /**
   * Add overlap between chunks.
   */
  const addOverlap = (chunks: string[]): string[] => {
    if (opts.chunkOverlap === 0 || chunks.length <= 1) {
      return chunks;
    }

    const overlapped: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i]!;

      // Add overlap from previous chunk
      if (i > 0) {
        const prevChunk = chunks[i - 1]!;
        const overlap = prevChunk.slice(-opts.chunkOverlap);
        chunk = overlap + chunk;
      }

      overlapped.push(chunk);
    }

    return overlapped;
  };

  return (content: string, _runtimeOptions: ChunkingOptions) => {
    const splitChunks = recursiveSplit(content, opts.separators);
    const overlappedChunks = addOverlap(splitChunks);

    return overlappedChunks.map((chunk, index) => ({
      index,
      content: chunk.trim(),
      tokenCount: chunk.split(/\s+/).filter(Boolean).length,
      metadata: {
        separators: opts.separators,
      },
    }));
  };
};
```

#### Example Usage

```typescript
// Default recursive splitting
const engine = createContextEngine({
  chunker: chunkers.recursive({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ". ", " ", ""]
  })
});

// Custom separators for structured text
const engine = createContextEngine({
  chunker: chunkers.recursive({
    chunkSize: 800,
    separators: ["\n---\n", "\n\n", "\n", ". "],
    keepSeparator: true,
    separatorPosition: "end"
  })
});

// Code-friendly separators
const engine = createContextEngine({
  chunker: chunkers.recursive({
    chunkSize: 1200,
    separators: ["\n\nclass ", "\n\nfunction ", "\n\n", "\n", ";", " "],
    keepSeparator: true
  })
});
```

#### Testing Requirements

- [ ] Test separator hierarchy (falls back correctly)
- [ ] Test separator preservation (start vs end position)
- [ ] Test overlap application
- [ ] Test edge case: text smaller than chunk size
- [ ] Test edge case: no separators found
- [ ] Test with custom separators

---

### 6. Hierarchical Chunking

**Status:** Proposed (Phase 3)
**Use Case:** Long documents, research papers, legal documents

#### Options

```typescript
export type HierarchicalChunkerOptions = {
  /**
   * Size of parent chunks (in words or tokens).
   * @default 1000
   */
  parentSize: number;

  /**
   * Size of child chunks within each parent (in words or tokens).
   * @default 200
   */
  childSize: number;

  /**
   * Overlap between child chunks.
   * @default 40
   */
  childOverlap: number;

  /**
   * Unit for measuring chunk size.
   * @default "words"
   */
  sizeUnit: "words" | "tokens";

  /**
   * Tokenizer (only used if sizeUnit is "tokens").
   */
  tokenizer?: TokenizerType | TokenizerFunction;

  /**
   * Whether to embed both parent and child chunks.
   * - true: Both levels are embedded (recommended for retrieval)
   * - false: Only child chunks are embedded, parent stored as metadata
   * @default true
   */
  embedBoth: boolean;

  /**
   * Overlap between parent chunks.
   * @default 100
   */
  parentOverlap?: number;
};

export type HierarchicalChunk = ChunkText & {
  /**
   * Level of this chunk in the hierarchy.
   */
  level: "parent" | "child";

  /**
   * ID of the parent chunk (for child chunks).
   */
  parentId?: string;

  /**
   * Full content of the parent chunk (for context).
   */
  parentContent?: string;

  /**
   * Position of this chunk within its parent (0-indexed).
   */
  positionInParent?: number;
};
```

#### Implementation

**File:** `registry/core/chunkers/hierarchical.ts`

```typescript
export const createHierarchicalChunker = (
  options: HierarchicalChunkerOptions
): Chunker => {
  const opts: Required<Omit<HierarchicalChunkerOptions, "tokenizer">> = {
    parentSize: options.parentSize ?? 1000,
    childSize: options.childSize ?? 200,
    childOverlap: options.childOverlap ?? 40,
    sizeUnit: options.sizeUnit ?? "words",
    embedBoth: options.embedBoth ?? true,
    parentOverlap: options.parentOverlap ?? 100,
  };

  // Initialize tokenizer if needed
  let encoder: Tiktoken | null = null;
  if (opts.sizeUnit === "tokens" && options.tokenizer) {
    if (typeof options.tokenizer === "string") {
      encoder = getEncoding(options.tokenizer as TiktokenEncoding);
    }
  }

  const measureSize = (text: string): number => {
    if (opts.sizeUnit === "tokens" && encoder) {
      return encoder.encode(text).length;
    }
    return text.split(/\s+/).filter(Boolean).length;
  };

  const splitIntoUnits = (text: string): string[] => {
    if (opts.sizeUnit === "tokens" && encoder) {
      const tokens = encoder.encode(text);
      return tokens.map(t => encoder!.decode([t]));
    }
    return text.split(/\s+/).filter(Boolean);
  };

  const joinUnits = (units: string[]): string => {
    return units.join(" ");
  };

  return (content: string, _runtimeOptions: ChunkingOptions) => {
    const allChunks: HierarchicalChunk[] = [];
    const units = splitIntoUnits(content);

    // Step 1: Create parent chunks
    const parentStride = Math.max(1, opts.parentSize - opts.parentOverlap);
    const parents: Array<{ id: string; content: string; startIdx: number; endIdx: number }> = [];

    let cursor = 0;
    let parentIndex = 0;

    while (cursor < units.length) {
      const slice = units.slice(cursor, cursor + opts.parentSize);
      const parentContent = joinUnits(slice);

      const parentId = `parent-${parentIndex}`;
      parents.push({
        id: parentId,
        content: parentContent,
        startIdx: cursor,
        endIdx: cursor + slice.length,
      });

      // If embedBoth, add parent chunk to output
      if (opts.embedBoth) {
        allChunks.push({
          index: allChunks.length,
          content: parentContent,
          tokenCount: slice.length,
          level: "parent",
          metadata: {
            level: "parent",
            parentId,
            hierarchical: true,
          },
        });
      }

      cursor += parentStride;
      parentIndex += 1;
    }

    // Step 2: Create child chunks within each parent
    const childStride = Math.max(1, opts.childSize - opts.childOverlap);

    for (const parent of parents) {
      const parentUnits = units.slice(parent.startIdx, parent.endIdx);
      let childCursor = 0;
      let childPosition = 0;

      while (childCursor < parentUnits.length) {
        const childSlice = parentUnits.slice(childCursor, childCursor + opts.childSize);
        const childContent = joinUnits(childSlice);

        allChunks.push({
          index: allChunks.length,
          content: childContent,
          tokenCount: childSlice.length,
          level: "child",
          parentId: parent.id,
          parentContent: parent.content,
          positionInParent: childPosition,
          metadata: {
            level: "child",
            parentId: parent.id,
            positionInParent: childPosition,
            hierarchical: true,
          },
        });

        childCursor += childStride;
        childPosition += 1;
      }
    }

    // Free tokenizer
    if (encoder) {
      encoder.free();
    }

    return allChunks;
  };
};
```

#### Example Usage

```typescript
// Basic hierarchical chunking
const engine = createContextEngine({
  chunker: chunkers.hierarchical({
    parentSize: 1000,
    childSize: 200,
    childOverlap: 40,
    embedBoth: true
  })
});

// Token-based with custom ratios
const engine = createContextEngine({
  chunker: chunkers.hierarchical({
    parentSize: 2000,
    childSize: 400,
    childOverlap: 80,
    sizeUnit: "tokens",
    tokenizer: "cl100k_base",
    embedBoth: true
  })
});

// Retrieve child, use parent for context
const results = await engine.retrieve({ query: "...", topK: 5 });

// Child chunks have parentContent for full context
for (const chunk of results.chunks) {
  if (chunk.metadata?.level === "child") {
    console.log("Child chunk:", chunk.content);
    console.log("Parent context:", chunk.metadata.parentContent);
  }
}
```

#### Database Considerations

With hierarchical chunking, the chunks table will store both parent and child chunks. You can filter by level:

```sql
-- Retrieve only child chunks (for embedding search)
SELECT * FROM chunks WHERE metadata->>'level' = 'child';

-- Get parent for a child chunk
SELECT * FROM chunks
WHERE id = (
  SELECT metadata->>'parentId'
  FROM chunks
  WHERE id = 'child-chunk-id'
);
```

#### Testing Requirements

- [ ] Test parent chunk creation with overlap
- [ ] Test child chunk creation within parents
- [ ] Test embedBoth flag (both levels vs children only)
- [ ] Test parent-child relationship preservation
- [ ] Test positionInParent tracking
- [ ] Test with token-based sizing

---

### 7. Code-Aware Chunking

**Status:** Proposed (Phase 4)
**Use Case:** Code documentation, API references, source code indexing

#### Options

```typescript
export type CodeChunkerOptions = {
  /**
   * Maximum chunk size (in characters or tokens).
   * @default 1200
   */
  maxChunkSize: number;

  /**
   * Unit for measuring chunk size.
   * @default "characters"
   */
  sizeUnit: "characters" | "tokens";

  /**
   * Tokenizer (only used if sizeUnit is "tokens").
   */
  tokenizer?: TokenizerType | TokenizerFunction;

  /**
   * Programming language (for syntax-aware splitting).
   * - "auto": Detect from content
   * - Specific language: "typescript", "python", "javascript", etc.
   * @default "auto"
   */
  language: "auto" | "typescript" | "javascript" | "python" | "java" | "go" | "rust" | "c" | "cpp";

  /**
   * Split on function boundaries.
   * @default true
   */
  splitOnFunctions: boolean;

  /**
   * Split on class boundaries.
   * @default true
   */
  splitOnClasses: boolean;

  /**
   * Include imports/requires in each chunk for context.
   * @default true
   */
  includeImports: boolean;

  /**
   * Include class/module context for methods.
   * @default true
   */
  includeClassContext: boolean;

  /**
   * Preserve complete code blocks (don't split mid-function).
   * @default true
   */
  preserveCodeBlocks: boolean;

  /**
   * Include docstrings/comments with the code they document.
   * @default true
   */
  includeDocstrings: boolean;
};
```

#### Implementation

**File:** `registry/core/chunkers/code.ts`

```typescript
type CodeBlock = {
  type: "import" | "class" | "function" | "method" | "comment" | "other";
  name?: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  parent?: string;  // For methods within classes
};

export const createCodeChunker = (
  options: CodeChunkerOptions
): Chunker => {
  const opts: Required<Omit<CodeChunkerOptions, "tokenizer">> = {
    maxChunkSize: options.maxChunkSize ?? 1200,
    sizeUnit: options.sizeUnit ?? "characters",
    language: options.language ?? "auto",
    splitOnFunctions: options.splitOnFunctions ?? true,
    splitOnClasses: options.splitOnClasses ?? true,
    includeImports: options.includeImports ?? true,
    includeClassContext: options.includeClassContext ?? true,
    preserveCodeBlocks: options.preserveCodeBlocks ?? true,
    includeDocstrings: options.includeDocstrings ?? true,
  };

  // Initialize tokenizer if needed
  let encoder: Tiktoken | null = null;
  if (opts.sizeUnit === "tokens" && options.tokenizer) {
    if (typeof options.tokenizer === "string") {
      encoder = getEncoding(options.tokenizer as TiktokenEncoding);
    }
  }

  const measureSize = (text: string): number => {
    if (opts.sizeUnit === "tokens" && encoder) {
      return encoder.encode(text).length;
    }
    return text.length;
  };

  /**
   * Detect programming language from content.
   */
  const detectLanguage = (content: string): string => {
    if (content.includes("function ") || content.includes("const ") || content.includes("=>")) {
      if (content.includes(": ") && content.includes("interface ")) {
        return "typescript";
      }
      return "javascript";
    }
    if (content.includes("def ") || content.includes("import ") && content.includes("from ")) {
      return "python";
    }
    if (content.includes("public class ") || content.includes("private ")) {
      return "java";
    }
    if (content.includes("func ") && content.includes("package ")) {
      return "go";
    }
    if (content.includes("fn ") && content.includes("impl ")) {
      return "rust";
    }
    return "unknown";
  };

  /**
   * Parse code into structural blocks (simplified parser).
   */
  const parseCode = (content: string, language: string): CodeBlock[] => {
    const blocks: CodeBlock[] = [];
    const lines = content.split("\n");

    // This is a simplified implementation
    // A production version would use a proper AST parser for each language

    if (language === "typescript" || language === "javascript") {
      return parseTsJs(lines, language);
    } else if (language === "python") {
      return parsePython(lines);
    }

    // Fallback: treat as single block
    return [{
      type: "other",
      content,
      startLine: 0,
      endLine: lines.length - 1,
      language,
    }];
  };

  /**
   * Parse TypeScript/JavaScript.
   */
  const parseTsJs = (lines: string[], language: string): CodeBlock[] => {
    const blocks: CodeBlock[] = [];
    let i = 0;

    // Extract imports
    const imports: string[] = [];
    while (i < lines.length && (
      lines[i]!.trim().startsWith("import ") ||
      lines[i]!.trim().startsWith("require(") ||
      lines[i]!.trim().startsWith("//") ||
      lines[i]!.trim().length === 0
    )) {
      if (lines[i]!.trim().startsWith("import ") || lines[i]!.trim().startsWith("require(")) {
        imports.push(lines[i]!);
      }
      i++;
    }

    if (imports.length > 0) {
      blocks.push({
        type: "import",
        content: imports.join("\n"),
        startLine: 0,
        endLine: imports.length - 1,
        language,
      });
    }

    // Parse classes, functions
    while (i < lines.length) {
      const line = lines[i]!.trim();

      // Class declaration
      if (line.startsWith("class ") || line.startsWith("export class ")) {
        const className = line.match(/class\s+(\w+)/)?.[1];
        const startLine = i;
        let braceCount = 0;
        let classLines: string[] = [];

        // Find matching closing brace
        while (i < lines.length) {
          classLines.push(lines[i]!);
          braceCount += (lines[i]!.match(/{/g) || []).length;
          braceCount -= (lines[i]!.match(/}/g) || []).length;
          i++;

          if (braceCount === 0 && startLine !== i - 1) {
            break;
          }
        }

        blocks.push({
          type: "class",
          name: className,
          content: classLines.join("\n"),
          startLine,
          endLine: i - 1,
          language,
        });
        continue;
      }

      // Function declaration
      if (
        line.startsWith("function ") ||
        line.startsWith("export function ") ||
        line.startsWith("async function ") ||
        line.match(/^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/)
      ) {
        const funcName =
          line.match(/function\s+(\w+)/)?.[1] ||
          line.match(/(const|let|var)\s+(\w+)/)?.[2];
        const startLine = i;
        let braceCount = 0;
        let funcLines: string[] = [];
        let started = false;

        while (i < lines.length) {
          funcLines.push(lines[i]!);
          const openBraces = (lines[i]!.match(/{/g) || []).length;
          const closeBraces = (lines[i]!.match(/}/g) || []).length;

          if (openBraces > 0) started = true;
          braceCount += openBraces;
          braceCount -= closeBraces;
          i++;

          if (started && braceCount === 0) {
            break;
          }
        }

        blocks.push({
          type: "function",
          name: funcName,
          content: funcLines.join("\n"),
          startLine,
          endLine: i - 1,
          language,
        });
        continue;
      }

      i++;
    }

    return blocks;
  };

  /**
   * Parse Python (simplified).
   */
  const parsePython = (lines: string[]): CodeBlock[] => {
    const blocks: CodeBlock[] = [];
    let i = 0;

    // Extract imports
    const imports: string[] = [];
    while (i < lines.length && (
      lines[i]!.trim().startsWith("import ") ||
      lines[i]!.trim().startsWith("from ") ||
      lines[i]!.trim().startsWith("#") ||
      lines[i]!.trim().length === 0
    )) {
      if (lines[i]!.trim().startsWith("import ") || lines[i]!.trim().startsWith("from ")) {
        imports.push(lines[i]!);
      }
      i++;
    }

    if (imports.length > 0) {
      blocks.push({
        type: "import",
        content: imports.join("\n"),
        startLine: 0,
        endLine: imports.length - 1,
        language: "python",
      });
    }

    // Parse classes, functions
    while (i < lines.length) {
      const line = lines[i]!;
      const indent = line.match(/^\s*/)?.[0].length ?? 0;

      // Class definition
      if (line.trim().startsWith("class ")) {
        const className = line.match(/class\s+(\w+)/)?.[1];
        const startLine = i;
        const classLines: string[] = [line];
        i++;

        // Get all lines with greater indentation
        while (i < lines.length) {
          const currentIndent = lines[i]!.match(/^\s*/)?.[0].length ?? 0;
          if (currentIndent > indent || lines[i]!.trim().length === 0) {
            classLines.push(lines[i]!);
            i++;
          } else {
            break;
          }
        }

        blocks.push({
          type: "class",
          name: className,
          content: classLines.join("\n"),
          startLine,
          endLine: i - 1,
          language: "python",
        });
        continue;
      }

      // Function definition
      if (line.trim().startsWith("def ")) {
        const funcName = line.match(/def\s+(\w+)/)?.[1];
        const startLine = i;
        const funcLines: string[] = [line];
        i++;

        // Get all lines with greater indentation
        while (i < lines.length) {
          const currentIndent = lines[i]!.match(/^\s*/)?.[0].length ?? 0;
          if (currentIndent > indent || lines[i]!.trim().length === 0) {
            funcLines.push(lines[i]!);
            i++;
          } else {
            break;
          }
        }

        blocks.push({
          type: "function",
          name: funcName,
          content: funcLines.join("\n"),
          startLine,
          endLine: i - 1,
          language: "python",
        });
        continue;
      }

      i++;
    }

    return blocks;
  };

  return (content: string, _runtimeOptions: ChunkingOptions) => {
    const language = opts.language === "auto"
      ? detectLanguage(content)
      : opts.language;

    const blocks = parseCode(content, language);
    const chunks: ChunkText[] = [];

    // Get imports for context
    const imports = blocks
      .filter(b => b.type === "import")
      .map(b => b.content)
      .join("\n");

    // Create chunks from blocks
    let index = 0;

    for (const block of blocks) {
      if (block.type === "import") continue; // Already extracted

      let chunkContent = block.content;

      // Prepend imports if enabled
      if (opts.includeImports && imports) {
        chunkContent = imports + "\n\n" + chunkContent;
      }

      const size = measureSize(chunkContent);

      // If block exceeds max size and is splittable, split it
      if (size > opts.maxChunkSize && !opts.preserveCodeBlocks) {
        // Split large block into smaller chunks
        const subChunks = splitLargeBlock(chunkContent, opts.maxChunkSize);

        for (const subChunk of subChunks) {
          chunks.push({
            index: index++,
            content: subChunk,
            tokenCount: measureSize(subChunk),
            metadata: {
              language,
              blockType: block.type,
              blockName: block.name,
              startLine: block.startLine,
              endLine: block.endLine,
            },
          });
        }
      } else {
        // Keep block intact
        chunks.push({
          index: index++,
          content: chunkContent,
          tokenCount: size,
          metadata: {
            language,
            blockType: block.type,
            blockName: block.name,
            startLine: block.startLine,
            endLine: block.endLine,
          },
        });
      }
    }

    // Free tokenizer
    if (encoder) {
      encoder.free();
    }

    return chunks;
  };

  function splitLargeBlock(content: string, maxSize: number): string[] => {
    // Simple line-based splitting for oversized blocks
    const lines = content.split("\n");
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (const line of lines) {
      const lineSize = measureSize(line);

      if (currentSize + lineSize > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n"));
        currentChunk = [];
        currentSize = 0;
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));
    }

    return chunks;
  }
};
```

#### Example Usage

```typescript
// Auto-detect language
const engine = createContextEngine({
  chunker: chunkers.code({
    maxChunkSize: 1200,
    language: "auto",
    splitOnFunctions: true,
    includeImports: true
  })
});

// TypeScript-specific
const engine = createContextEngine({
  chunker: chunkers.code({
    maxChunkSize: 1500,
    language: "typescript",
    splitOnClasses: true,
    splitOnFunctions: true,
    includeImports: true,
    includeClassContext: true
  })
});

// Python code
const engine = createContextEngine({
  chunker: chunkers.code({
    maxChunkSize: 1000,
    language: "python",
    splitOnFunctions: true,
    includeDocstrings: true
  })
});
```

#### Testing Requirements

- [ ] Test function boundary detection (TypeScript, JavaScript, Python)
- [ ] Test class boundary detection
- [ ] Test import extraction and inclusion
- [ ] Test docstring preservation
- [ ] Test with nested structures (methods in classes)
- [ ] Test language auto-detection
- [ ] Test oversized function splitting

---

### 8. Agentic Chunking

**Status:** Proposed (Phase 4)
**Use Case:** High-quality chunking for critical documents (expensive)

#### Options

```typescript
export type AgenticChunkerOptions = {
  /**
   * LLM model to use for chunking decisions.
   * Should be a fast, inexpensive model (e.g., "gpt-4o-mini", "claude-haiku").
   * @default "gpt-4o-mini"
   */
  model: string;

  /**
   * Maximum chunk size guideline (in words).
   * The LLM will try to keep chunks around this size.
   * @default 500
   */
  targetChunkSize: number;

  /**
   * Custom prompt for chunking instructions.
   * If not provided, uses default intelligent chunking prompt.
   */
  prompt?: string;

  /**
   * Chunking mode.
   * - "split": LLM identifies natural split points
   * - "summarize": LLM creates summaries for each chunk
   * - "hybrid": Split + add summary metadata
   * @default "split"
   */
  mode: "split" | "summarize" | "hybrid";

  /**
   * Maximum LLM API calls per document.
   * For very long documents, prevents excessive costs.
   * @default 10
   */
  maxApiCalls: number;

  /**
   * Timeout for each LLM call (milliseconds).
   * @default 30000
   */
  timeoutMs: number;
};
```

#### Implementation

**File:** `registry/core/chunkers/agentic.ts`

```typescript
import { generateText } from "ai";

export const createAgenticChunker = (
  options: AgenticChunkerOptions
): Chunker => {
  const opts: Required<Omit<AgenticChunkerOptions, "prompt">> = {
    model: options.model ?? "gpt-4o-mini",
    targetChunkSize: options.targetChunkSize ?? 500,
    mode: options.mode ?? "split",
    maxApiCalls: options.maxApiCalls ?? 10,
    timeoutMs: options.timeoutMs ?? 30000,
  };

  const defaultPrompt = opts.mode === "split"
    ? `You are a document chunking assistant. Your task is to split the following document into semantically coherent chunks.

Guidelines:
- Each chunk should be around ${opts.targetChunkSize} words
- Preserve natural boundaries (paragraphs, sections, topics)
- Keep related content together
- Don't split mid-sentence or mid-thought

Return a JSON array of chunks:
[
  { "content": "chunk 1 text...", "reasoning": "why this is a good chunk" },
  { "content": "chunk 2 text...", "reasoning": "..." }
]`
    : `You are a document summarization assistant. Your task is to create concise summaries of document sections.

Guidelines:
- Each summary should capture the essence of ${opts.targetChunkSize} words of content
- Be factual and precise
- Preserve key information and concepts

Return a JSON array of summarized chunks:
[
  { "summary": "summary text...", "original": "original text..." },
  { "summary": "...", "original": "..." }
]`;

  return async (content: string, _runtimeOptions: ChunkingOptions) => {
    const chunks: ChunkText[] = [];

    // For very long documents, split into sections first
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const sectionsNeeded = Math.ceil(wordCount / (opts.targetChunkSize * 5));

    if (sectionsNeeded > opts.maxApiCalls) {
      // Fall back to simple splitting for huge documents
      return fallbackToSimpleChunking(content, opts.targetChunkSize);
    }

    try {
      const { text } = await generateText({
        model: opts.model,
        prompt: (options.prompt ?? defaultPrompt) + "\n\nDocument:\n" + content,
        maxTokens: 4000,
        temperature: 0,
        abortSignal: AbortSignal.timeout(opts.timeoutMs),
      });

      // Parse LLM response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("LLM did not return valid JSON array");
      }

      const parsedChunks = JSON.parse(jsonMatch[0]);

      // Transform to ChunkText format
      for (let i = 0; i < parsedChunks.length; i++) {
        const llmChunk = parsedChunks[i];

        let chunkContent: string;
        let metadata: any = { agenticChunking: true, model: opts.model };

        if (opts.mode === "split") {
          chunkContent = llmChunk.content;
          metadata.reasoning = llmChunk.reasoning;
        } else if (opts.mode === "summarize") {
          chunkContent = llmChunk.summary;
          metadata.original = llmChunk.original;
        } else {
          // hybrid
          chunkContent = llmChunk.content;
          metadata.summary = llmChunk.summary;
          metadata.reasoning = llmChunk.reasoning;
        }

        chunks.push({
          index: i,
          content: chunkContent,
          tokenCount: chunkContent.split(/\s+/).filter(Boolean).length,
          metadata,
        });
      }

      return chunks;
    } catch (error) {
      console.warn("Agentic chunking failed, falling back to simple chunking:", error);
      return fallbackToSimpleChunking(content, opts.targetChunkSize);
    }
  };

  function fallbackToSimpleChunking(content: string, targetSize: number): ChunkText[] {
    // Simple paragraph-based splitting
    const paragraphs = content.split(/\n\n+/).filter(Boolean);
    const chunks: ChunkText[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    let index = 0;

    for (const para of paragraphs) {
      const paraSize = para.split(/\s+/).filter(Boolean).length;

      if (currentSize + paraSize > targetSize && currentChunk.length > 0) {
        chunks.push({
          index: index++,
          content: currentChunk.join("\n\n"),
          tokenCount: currentSize,
          metadata: { fallback: true },
        });
        currentChunk = [];
        currentSize = 0;
      }

      currentChunk.push(para);
      currentSize += paraSize;
    }

    if (currentChunk.length > 0) {
      chunks.push({
        index: index++,
        content: currentChunk.join("\n\n"),
        tokenCount: currentSize,
        metadata: { fallback: true },
      });
    }

    return chunks;
  }
};
```

#### Example Usage

```typescript
// Basic agentic chunking (expensive!)
const engine = createContextEngine({
  chunker: chunkers.agentic({
    model: "gpt-4o-mini",
    targetChunkSize: 500,
    mode: "split"
  })
});

// Summarization mode
const engine = createContextEngine({
  chunker: chunkers.agentic({
    model: "claude-haiku",
    targetChunkSize: 300,
    mode: "summarize" // Embeds summaries instead of original text
  })
});

// Custom prompt for domain-specific chunking
const engine = createContextEngine({
  chunker: chunkers.agentic({
    model: "gpt-4o-mini",
    targetChunkSize: 600,
    mode: "hybrid",
    prompt: `Split this legal document into chunks by topic.
Each chunk should cover one legal concept or clause.
Keep chunks around 600 words.`
  })
});

// Per-document agentic chunking (recommended usage)
await engine.ingest({
  sourceId: "important-doc",
  content: criticalDocument,
  chunker: chunkers.agentic({
    model: "gpt-4o-mini",
    mode: "hybrid"
  })
});
```

#### Cost Considerations

Agentic chunking is **expensive**:
- **gpt-4o-mini**: ~$0.15 per 1M input tokens
- **claude-haiku**: ~$0.25 per 1M input tokens

For a 10,000-word document (~13,000 tokens):
- Cost: ~$0.002 per document
- Time: 5-10 seconds

**Recommendation**: Use sparingly for high-value documents or as a per-document override.

#### Testing Requirements

- [ ] Test with various LLM models
- [ ] Test split mode vs summarize mode
- [ ] Test hybrid mode
- [ ] Test fallback to simple chunking on error
- [ ] Test maxApiCalls limit
- [ ] Test timeout handling
- [ ] Benchmark cost and latency

---

## Type Definitions

### Consolidated Type File

**File:** `registry/core/chunkers/types.ts`

```typescript
// Re-export from core types
export type { ChunkText, ChunkingOptions, Chunker } from "../types";

// Chunker factory type
export type ChunkerFactory<TOptions> = (options: TOptions) => Chunker;

// All chunker option types
export type { WordChunkerOptions } from "./word";
export type { TokenChunkerOptions, TokenizerType, TokenizerFunction } from "./token";
export type { SemanticChunkerOptions } from "./semantic";
export type { MarkdownChunkerOptions } from "./markdown";
export type { RecursiveChunkerOptions } from "./recursive";
export type { HierarchicalChunkerOptions, HierarchicalChunk } from "./hierarchical";
export type { CodeChunkerOptions } from "./code";
export type { AgenticChunkerOptions } from "./agentic";

// Unified chunkers namespace type
export interface Chunkers {
  word: ChunkerFactory<Partial<WordChunkerOptions>>;
  token: ChunkerFactory<TokenChunkerOptions>;
  semantic: ChunkerFactory<SemanticChunkerOptions>;
  markdown: ChunkerFactory<MarkdownChunkerOptions>;
  recursive: ChunkerFactory<RecursiveChunkerOptions>;
  hierarchical: ChunkerFactory<HierarchicalChunkerOptions>;
  code: ChunkerFactory<CodeChunkerOptions>;
  agentic: ChunkerFactory<AgenticChunkerOptions>;
  custom: (fn: Chunker) => Chunker;
}
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Core infrastructure + high-value chunkers

#### Tasks
1. **Setup infrastructure**
   - [ ] Create `registry/core/chunkers/` directory
   - [ ] Create `chunkers/types.ts` with all type definitions
   - [ ] Create `chunkers/index.ts` with namespace export
   - [ ] Update `core/types.ts` to support new `chunker` field

2. **Implement word chunker**
   - [ ] Move existing logic to `chunkers/word.ts`
   - [ ] Add factory function `createWordChunker`
   - [ ] Add to `chunkers` namespace
   - [ ] Write tests

3. **Implement token chunker**
   - [ ] Install `js-tiktoken` dependency
   - [ ] Implement `chunkers/token.ts`
   - [ ] Support multiple tokenizers
   - [ ] Write tests

4. **Implement semantic chunker**
   - [ ] Implement `chunkers/semantic.ts`
   - [ ] Support paragraph/sentence/section splitting
   - [ ] Implement overlap modes
   - [ ] Write tests

5. **Update resolution logic**
   - [ ] Implement `resolveChunker()` in `core/chunking.ts`
   - [ ] Support backward compatibility
   - [ ] Update `ingest.ts` to use new resolution
   - [ ] Write migration tests

6. **Documentation**
   - [ ] Update README with chunker examples
   - [ ] Add migration guide for users
   - [ ] Document each chunker's options

### Phase 2: Content-Aware (Weeks 3-4)

**Goal**: Markdown and recursive chunkers

#### Tasks
1. **Implement markdown chunker**
   - [ ] Implement markdown parser in `chunkers/markdown.ts`
   - [ ] Support header context inclusion
   - [ ] Respect code blocks, lists, tables
   - [ ] Write tests

2. **Implement recursive chunker**
   - [ ] Implement `chunkers/recursive.ts`
   - [ ] Support separator hierarchy
   - [ ] Handle edge cases
   - [ ] Write tests

3. **Documentation**
   - [ ] Add markdown chunker examples
   - [ ] Add recursive chunker examples

### Phase 3: Advanced (Weeks 5-6)

**Goal**: Hierarchical chunking

#### Tasks
1. **Implement hierarchical chunker**
   - [ ] Implement `chunkers/hierarchical.ts`
   - [ ] Support parent-child relationships
   - [ ] Test with long documents
   - [ ] Write tests

2. **Database updates**
   - [ ] Document hierarchical chunk storage
   - [ ] Add query examples

3. **Documentation**
   - [ ] Add hierarchical chunker guide
   - [ ] Add use cases and examples

### Phase 4: Specialized (Weeks 7-8)

**Goal**: Code and agentic chunkers

#### Tasks
1. **Implement code chunker**
   - [ ] Implement `chunkers/code.ts`
   - [ ] Support TypeScript/JavaScript
   - [ ] Support Python
   - [ ] Write tests

2. **Implement agentic chunker**
   - [ ] Implement `chunkers/agentic.ts`
   - [ ] Integrate with AI SDK
   - [ ] Add fallback logic
   - [ ] Write tests
   - [ ] Document cost implications

3. **Final documentation**
   - [ ] Complete API reference
   - [ ] Add comparison guide (when to use which chunker)
   - [ ] Add performance benchmarks

---

## Migration Guide

### For Existing Users

#### No Changes Required

If you're using the current chunking API, nothing changes:

```typescript
// This continues to work exactly as before
export default defineUnragConfig({
  defaults: {
    chunking: { chunkSize: 200, chunkOverlap: 40 }
  }
});
```

#### Adopting New Chunkers

To adopt the new chunking system:

**Step 1**: Import chunkers

```typescript
import { chunkers } from "@unrag/core";
```

**Step 2**: Replace `chunking` with `chunker`

```typescript
// Before
export default defineUnragConfig({
  defaults: {
    chunking: { chunkSize: 200, chunkOverlap: 40 }
  }
});

// After
export default defineUnragConfig({
  defaults: {
    chunker: chunkers.semantic({
      maxChunkSize: 500,
      splitOn: "paragraph"
    })
  }
});
```

**Step 3**: Test with your content

Run a few test ingestions and compare chunk quality.

### Breaking Changes

**None**. The new system is 100% backward compatible.

### Deprecation Timeline

- **v0.3.0**: New chunkers added, old API still supported
- **v0.4.0**: Old API still supported (no deprecation)
- **v1.0.0+**: Both APIs remain supported indefinitely

We have no plans to deprecate the simple `chunking: { chunkSize, chunkOverlap }` API.

---

## Testing Requirements

### Unit Tests

Each chunker must have comprehensive unit tests:

```typescript
// chunkers/__tests__/semantic.test.ts
describe("semantic chunker", () => {
  it("splits on paragraphs", () => {
    const chunker = chunkers.semantic({
      maxChunkSize: 100,
      splitOn: "paragraph"
    });

    const content = "Para 1.\n\nPara 2.\n\nPara 3.";
    const chunks = chunker(content, {} as ChunkingOptions);

    expect(chunks.length).toBe(3);
  });

  it("respects maxChunkSize", () => {
    // ...
  });

  it("applies overlap correctly", () => {
    // ...
  });

  // ... more tests
});
```

### Integration Tests

Test chunkers with the full ingest pipeline:

```typescript
describe("chunker integration", () => {
  it("works with token chunker in full ingest", async () => {
    const engine = createContextEngine({
      store: mockStore,
      embedding: mockEmbedding,
      chunker: chunkers.token({
        maxTokens: 512,
        tokenizer: "cl100k_base"
      })
    });

    const result = await engine.ingest({
      sourceId: "test",
      content: longDocument
    });

    expect(result.chunkCount).toBeGreaterThan(0);
    // Verify chunks respect token limits
  });
});
```

### Benchmark Tests

Compare chunker performance:

```typescript
describe("chunker benchmarks", () => {
  const testContent = generateLongDocument(10000); // 10k words

  it("benchmarks word chunker", () => {
    const start = performance.now();
    const chunks = chunkers.word()(testContent, defaultOpts);
    const duration = performance.now() - start;

    console.log(`Word chunker: ${duration}ms for ${chunks.length} chunks`);
  });

  it("benchmarks token chunker", () => {
    // ...
  });

  // Compare all chunkers
});
```

### Regression Tests

Ensure backward compatibility:

```typescript
describe("backward compatibility", () => {
  it("old chunking API still works", async () => {
    const engine = createContextEngine({
      store: mockStore,
      embedding: mockEmbedding,
      defaults: { chunkSize: 200, chunkOverlap: 40 } // Old API
    });

    const result = await engine.ingest({
      sourceId: "test",
      content: "test content",
      chunking: { chunkSize: 100 } // Per-ingest override
    });

    expect(result.chunkCount).toBeGreaterThan(0);
  });
});
```

---

## Performance Considerations

### Chunker Performance Comparison

| Chunker | Speed | Memory | Cost | Use Case |
|---------|-------|--------|------|----------|
| Word | ⚡⚡⚡ Very Fast | Low | Free | Simple documents, backward compat |
| Token | ⚡⚡ Fast | Medium | Free | Production RAG (accurate) |
| Semantic | ⚡⚡ Fast | Low | Free | Natural language, articles |
| Markdown | ⚡ Medium | Medium | Free | Documentation, READMEs |
| Recursive | ⚡⚡ Fast | Low | Free | General text |
| Hierarchical | ⚡ Medium | High | Free | Long documents |
| Code | ⚡ Medium | Medium | Free | Source code |
| Agentic | 🐌 Slow | Low | $$$ | Critical documents only |

### Optimization Guidelines

1. **Choose the right chunker**
   - For most use cases: `token` or `semantic`
   - For markdown: `markdown`
   - For code: `code`
   - For long documents: `hierarchical`
   - Avoid `agentic` unless absolutely needed

2. **Tokenizer optimization**
   - Reuse tokenizer instances (they're cached in memory)
   - Free tokenizer resources when done (`encoder.free()`)
   - Use appropriate tokenizer for your embedding model

3. **Chunk size tuning**
   - Smaller chunks = better precision, more chunks to embed
   - Larger chunks = better context, fewer API calls
   - Sweet spot: 300-512 tokens for most RAG use cases

4. **Batch ingestion**
   - Process multiple documents in parallel
   - Use `embeddingProcessing.concurrency` to control rate limits

---

## Examples

### Example 1: Production RAG with Token Chunking

```typescript
// unrag.config.ts
import { chunkers } from "@unrag/core";

export default defineUnragConfig({
  embedding: {
    provider: "openai",
    config: {
      model: "text-embedding-3-large",
      dimensions: 1536
    }
  },
  defaults: {
    chunker: chunkers.token({
      maxTokens: 512,
      overlapTokens: 50,
      tokenizer: "cl100k_base",
      preserveSentences: true
    }),
    retrieval: {
      topK: 8
    }
  }
});
```

### Example 2: Documentation Site with Markdown Chunking

```typescript
// unrag.config.ts
import { chunkers } from "@unrag/core";

export default defineUnragConfig({
  embedding: {
    provider: "openai"
  },
  defaults: {
    chunker: chunkers.markdown({
      maxChunkSize: 800,
      respectCodeBlocks: true,
      respectHeaders: true,
      headerLevels: [1, 2, 3],
      includeHeaderContext: true,
      headerContextFormat: "full"
    })
  }
});

// Ingest documentation
const docs = await fs.readFile("./docs/README.md", "utf-8");
await engine.ingest({
  sourceId: "docs:readme",
  content: docs
});

// Chunks will include header context:
// # Installation
// ## Using npm
//
// Run `npm install unrag` to install...
```

### Example 3: Code Search with Code Chunker

```typescript
// unrag.config.ts
import { chunkers } from "@unrag/core";

export default defineUnragConfig({
  embedding: {
    provider: "openai"
  },
  defaults: {
    chunker: chunkers.code({
      maxChunkSize: 1200,
      language: "auto",
      splitOnFunctions: true,
      splitOnClasses: true,
      includeImports: true
    })
  }
});

// Ingest source files
const sourceCode = await fs.readFile("./src/index.ts", "utf-8");
await engine.ingest({
  sourceId: "src:index",
  content: sourceCode
});

// Each chunk is a function or class with imports
```

### Example 4: Research Papers with Hierarchical Chunking

```typescript
// unrag.config.ts
import { chunkers } from "@unrag/core";

export default defineUnragConfig({
  embedding: {
    provider: "openai"
  },
  defaults: {
    chunker: chunkers.hierarchical({
      parentSize: 2000,
      childSize: 400,
      childOverlap: 80,
      sizeUnit: "tokens",
      tokenizer: "cl100k_base",
      embedBoth: true
    })
  }
});

// Ingest long paper
await engine.ingest({
  sourceId: "paper:arxiv-123",
  content: researchPaper
});

// Retrieve precise chunks with full parent context
const results = await engine.retrieve({ query: "attention mechanism" });

for (const chunk of results.chunks) {
  if (chunk.metadata?.level === "child") {
    console.log("Relevant excerpt:", chunk.content);
    console.log("Full section:", chunk.metadata.parentContent);
  }
}
```

### Example 5: Mixed Strategy (Per-Document Override)

```typescript
// Default to semantic chunking
export default defineUnragConfig({
  defaults: {
    chunker: chunkers.semantic({
      maxChunkSize: 500,
      splitOn: "paragraph"
    })
  }
});

// Override for markdown documentation
await engine.ingest({
  sourceId: "docs:readme",
  content: markdownContent,
  chunker: chunkers.markdown({
    maxChunkSize: 800,
    respectHeaders: true
  })
});

// Override for source code
await engine.ingest({
  sourceId: "src:utils",
  content: sourceCode,
  chunker: chunkers.code({
    language: "typescript",
    splitOnFunctions: true
  })
});

// Override for critical document (expensive!)
await engine.ingest({
  sourceId: "contract:important",
  content: legalContract,
  chunker: chunkers.agentic({
    model: "gpt-4o-mini",
    mode: "hybrid"
  })
});
```

### Example 6: Comparison of Chunking Strategies

```typescript
// Test different chunkers on the same content
const testContent = await fs.readFile("./test-doc.md", "utf-8");

const strategies = [
  { name: "Word", chunker: chunkers.word({ chunkSize: 200 }) },
  { name: "Token", chunker: chunkers.token({ maxTokens: 512 }) },
  { name: "Semantic", chunker: chunkers.semantic({ maxChunkSize: 500 }) },
  { name: "Markdown", chunker: chunkers.markdown({ maxChunkSize: 800 }) },
];

for (const strategy of strategies) {
  const chunks = strategy.chunker(testContent, defaultOpts);
  console.log(`${strategy.name}: ${chunks.length} chunks`);
  console.log("First chunk:", chunks[0]?.content.slice(0, 100));
  console.log("---");
}
```

---

## Conclusion

This specification defines a comprehensive, extensible chunking system for Unrag that:

1. **Maintains backward compatibility** with the existing simple API
2. **Provides progressive enhancement** through named chunkers
3. **Supports advanced use cases** with specialized chunkers
4. **Enables per-document flexibility** via ingest-time overrides
5. **Is fully type-safe** with strong TypeScript support

The hybrid approach ensures existing users experience no disruption while enabling power users to leverage advanced chunking strategies for better RAG quality.

### Next Steps

1. Review and approve this specification
2. Create GitHub issues for each implementation phase
3. Begin Phase 1 implementation (foundation + core chunkers)
4. Gather community feedback during beta
5. Iterate and refine based on real-world usage

---

**Appendix A: Glossary**

- **Chunker**: A function that splits text into chunks
- **Token**: A unit of text as understood by an LLM tokenizer
- **Stride**: The step size between consecutive chunks in sliding window chunking
- **Overlap**: The number of units (words/tokens) shared between consecutive chunks
- **Parent Chunk**: In hierarchical chunking, a large chunk containing multiple child chunks
- **Child Chunk**: In hierarchical chunking, a small precise chunk with parent context

**Appendix B: References**

- [LangChain Text Splitters](https://python.langchain.com/docs/modules/data_connection/document_transformers/)
- [LlamaIndex Chunking Guide](https://docs.llamaindex.ai/en/stable/module_guides/loading/node_parsers/modules.html)
- [OpenAI Tokenizer](https://github.com/openai/tiktoken)
- [Anthropic Chunking Best Practices](https://docs.anthropic.com/claude/docs/embeddings-guide#chunking)

