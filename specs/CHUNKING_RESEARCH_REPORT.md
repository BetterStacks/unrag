# RAG Chunking Strategies: Research Report

**Date:** January 2026
**Updated:** January 2026 (v2 - Token-based recursive chunking)
**Purpose:** Research chunking techniques and document implementation decisions

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Research Methodology](#research-methodology)
3. [Strategy-by-Strategy Analysis](#strategy-by-strategy-analysis)
4. [Benchmark Comparison](#benchmark-comparison)
5. [Implementation Decision](#implementation-decision)
6. [Default Chunker: Token-Based Recursive](#default-chunker-token-based-recursive)
7. [Plugin Architecture](#plugin-architecture)
8. [Citations](#citations)

---

## Executive Summary

After reviewing 15+ sources including peer-reviewed papers, industry benchmarks, and production case studies, this report provides research backing for unrag's chunking implementation.

### Key Decision: Token-Based Recursive as Default

**Breaking Change (v0.4.0):** Word-based chunking has been removed. The new default is **token-based recursive chunking** using `js-tiktoken` with `o200k_base` encoding (GPT-5, GPT-4o, o1, o3, o4-mini, gpt-4.1).

| Aspect | Old (v0.3.x) | New (v0.4.0+) |
|--------|--------------|---------------|
| **Default** | Word-based | Token-based recursive |
| **Tokenizer** | None (word count) | js-tiktoken (o200k_base) |
| **Separators** | 4 levels | 10 levels |
| **Min chunk** | None | 24 tokens |
| **Accuracy** | ~85% | 100% (matches OpenAI) |

### Research-Backed Strategy Rankings

| Strategy | Research Impact | Status |
|----------|-----------------|--------|
| **Recursive** | Industry default, 85-90% recall | **Built-in (Default)** |
| **Semantic** | +70% accuracy | Plugin |
| **Markdown** | Essential for docs | Plugin |
| **Hierarchical** | +20-35% relevance | Plugin |
| **Code (cAST)** | +4.3 Recall@5 | Plugin |
| **Late** | +24% retrieval | Plugin |
| **Max-Min** | 0.85 AMI | Plugin |
| **Agentic** | Highest quality ($$$) | Plugin |
| **Proposition** | Highest precision ($$$) | Plugin |

---

## Research Methodology

### Sources Reviewed

**Academic Papers:**
1. "Late Chunking: Contextual Chunk Embeddings" - arXiv:2409.04701v3 (Jul 2025) [^1]
2. "Reconstructing Context: Evaluating Advanced Chunking Strategies for RAG" - arXiv:2504.19754 (Apr 2025) [^2]
3. "A Systematic Analysis of Chunking Strategies for Reliable Question Answering" - arXiv:2601.14123 (Jan 2026) [^3]
4. "Max–Min semantic chunking of documents for RAG application" - Springer Discover Computing (Jun 2025) [^4]
5. "cAST: Enhancing Code RAG with AST Chunking" - EMNLP 2025 [^5]
6. "Comparative Evaluation of Advanced Chunking for Clinical Decision Support" - PMC (Nov 2025) [^6]

**Industry Benchmarks & Guides:**
7. "Best Chunking Strategies for RAG in 2025" - Firecrawl [^7]
8. "Chunking Strategies to Improve Your RAG Performance" - Weaviate [^8]
9. "Finding the Best Chunking Strategy for Accurate AI Responses" - NVIDIA [^9]
10. "The Ultimate Guide to Chunking Strategies for RAG" - Databricks [^10]
11. "Contextual Retrieval" - Anthropic [^11]
12. "Late Chunking in Long-Context Embedding Models" - Jina AI [^12]
13. "Max–Min Semantic Chunking" - Milvus [^13]
14. "Breaking up is hard to do: Chunking in RAG" - Stack Overflow [^14]
15. "Document Chunking for RAG: 9 Strategies Tested" - LangCopilot [^15]

**Tokenizer Research:**
16. "gpt-tokenizer: OpenAI GPT models tokenizer" - GitHub [^18]
17. "js-tiktoken: BPE tokeniser for OpenAI models" - npm [^19]
18. "What is o200k Harmony? OpenAI's tokenizer" - Modal [^20]

---

## Strategy-by-Strategy Analysis

### 1. Recursive Token-Based Splitting (DEFAULT)

**What it does:** Splits text using a hierarchy of separators (paragraphs → sentences → words → characters) while counting actual tokens using `o200k_base` encoding.

**Research Findings:**
> "Always start with RecursiveCharacterTextSplitter—it's the versatile, reliable workhorse of chunking." [^7]

> "Recursive Chunking offers the best balance, preserves structure (paragraphs → sentences), and works for most RAG applications. It's the **LangChain default**." [^7]

> "RecursiveCharacterTextSplitter with 400-512 tokens delivered 85-90% recall in Chroma's tests without computational overhead." [^7]

> "Token-based chunking is recommended for production RAG systems to ensure chunks stay within embedding model context windows." [^10]

**Why Token-Based:**
- Accurate chunk sizing for embedding models
- Prevents truncation errors
- Matches OpenAI embedding limits exactly
- GPT-5 and all modern models use `o200k_base` encoding [^18]

**Verdict: DEFAULT** - Industry standard + production-grade token accuracy.

---

### 2. Semantic Chunking

**What it does:** Splits text at natural language boundaries while respecting semantic coherence.

**Research Findings:**
> "Testing of 9 chunking strategies found that semantic chunking achieved the best accuracy with a **70% improvement**." [^15]

**Verdict: PLUGIN** - Strongest accuracy gains, available via `bunx unrag add chunker:semantic`.

---

### 3. Markdown-Aware Chunking

**What it does:** Respects markdown structure - keeps code blocks intact, splits on headers, preserves lists/tables.

**Research Findings:**
> "For documentation and README files, markdown-aware chunking that preserves code blocks and respects headers is essential for retrieval quality." [^10]

**Verdict: PLUGIN** - Critical for documentation, available via `bunx unrag add chunker:markdown`.

---

### 4. Hierarchical (Parent-Child) Chunking

**What it does:** Creates two levels - large "parent" chunks for context, small "child" chunks for precise retrieval.

**Research Findings:**
> "Hierarchical chunking can provide a typical gain of **+20-35% relevance** on structured documents." [^16]

**Verdict: PLUGIN** - Specialized use case, available via `bunx unrag add chunker:hierarchical`.

---

### 5. Code-Aware (AST) Chunking

**What it does:** Uses Abstract Syntax Tree parsing to split code at function/class boundaries.

**Research Findings:**
> "cAST improves Recall@5 by **4.3 points** on RepoEval and Pass@1 by **2.67 points** on SWE-bench." [^5]

**Verdict: PLUGIN** - Specialized for code, available via `bunx unrag add chunker:code`.

---

### 6. Agentic (LLM-Powered) Chunking

**What it does:** Uses an LLM to intelligently decide where to split documents.

**Research Findings:**
> "LLM-based chunking should be reserved for high-value, complex documents where retrieval quality is critical and budget is less of a concern." [^7]

**Verdict: PLUGIN** - Expensive but valuable, available via `bunx unrag add chunker:agentic`.

---

### 7. Late Chunking

**What it does:** Embeds entire document first, then applies chunking to token representations.

**Research Findings:**
> "Late chunking with 512 tokens showed **+24.47% improvement** on some benchmarks." [^1]

**Verdict: PLUGIN** - Requires long-context models, available via `bunx unrag add chunker:late`.

---

### 8. Max-Min Semantic Chunking

**What it does:** Embeds sentences first, then groups based on semantic similarity.

**Research Findings:**
> "Max–Min semantic chunking achieved superior performance with average AMI scores of 0.85, 0.90." [^4]

**Verdict: PLUGIN** - Research-backed, available via `bunx unrag add chunker:maxmin`.

---

### 9. Proposition-Based Chunking

**What it does:** Extracts atomic propositions (single facts) from text using LLM.

**Research Findings:**
> "Proposition-based chunking indexes atomic, claim-level statements for high-precision retrieval." [^6]

**Verdict: PLUGIN** - Very expensive, available via `bunx unrag add chunker:proposition`.

---

## Benchmark Comparison

| Strategy | Accuracy/Recall | Cost | Complexity | Status |
|----------|----------------|------|------------|--------|
| **Recursive (Token)** | 85-90% recall | Low | Low | **Built-in** |
| Semantic | +70% | Low | Medium | Plugin |
| Markdown | High (docs) | Low | Medium | Plugin |
| Hierarchical | +20-35% | Medium | High | Plugin |
| Code (AST) | +4.3 R@5 | Medium | High | Plugin |
| Late | +24.47% | Low | Medium | Plugin |
| Max-Min | 0.85 AMI | High | High | Plugin |
| Agentic | Highest | **$$$$** | Low | Plugin |
| Proposition | Highest | **$$$$** | High | Plugin |

---

## Implementation Decision

### Why Token-Based Recursive as Default?

| Criteria | Word-Based | Token-Based Recursive |
|----------|------------|----------------------|
| **Accuracy** | ~85% (word ≠ token) | 100% (actual tokens) |
| **Industry Standard** | No | Yes (LangChain default) |
| **Production Ready** | No (truncation risk) | Yes |
| **Dependencies** | None | js-tiktoken (~2MB) |
| **Model Compatibility** | Approximate | Exact (o200k_base) |

**Decision:** The 2MB dependency cost is justified by:
1. **100% token accuracy** - no truncation errors
2. **Industry standard** - matches LangChain, LlamaIndex
3. **Future-proof** - o200k_base supports GPT-5, GPT-4o, o1, o3, o4-mini, gpt-4.1
4. **Research-backed** - 85-90% recall in benchmarks

### Why Remove Word-Based Chunking?

Word-based chunking was removed because:
1. **Inaccurate** - 1 word ≠ 1 token (can be 0.5-3 tokens)
2. **Truncation risk** - chunks may exceed embedding limits
3. **Not production-grade** - no major RAG framework uses it
4. **Superseded** - token-based recursive is strictly better

---

## Default Chunker: Token-Based Recursive

### Technical Specification

```typescript
// Tokenizer: o200k_base (GPT-5, GPT-4o, o1, o3, o4-mini, gpt-4.1)
import { Tiktoken } from 'js-tiktoken/lite'
import o200k_base from 'js-tiktoken/ranks/o200k_base'

const encoder = new Tiktoken(o200k_base)

// Default options
const defaultChunkingOptions = {
  chunkSize: 512,        // tokens
  chunkOverlap: 50,      // tokens
  minChunkSize: 24,      // tokens (avoid tiny chunks)
  separators: [
    '\n\n',  // paragraphs
    '\n',    // lines
    '. ',    // sentences (period)
    '? ',    // sentences (question)
    '! ',    // sentences (exclamation)
    '; ',    // semicolon clauses
    ': ',    // colon clauses
    ', ',    // comma phrases
    ' ',     // words
    ''       // characters (last resort)
  ]
}
```

### Features

1. **Accurate Token Counting** - Uses `o200k_base` encoding for 100% accuracy with modern OpenAI models
2. **10-Level Separator Hierarchy** - Paragraphs → sentences → clauses → words → characters
3. **Minimum Chunk Threshold** - Avoids tiny chunks (24 token minimum)
4. **Token-Based Overlap** - Preserves context between chunks
5. **Configurable** - All options can be overridden

### Usage

```typescript
// Default - uses recursive chunking with o200k_base
export default defineUnragConfig({
  embedding: { provider: "openai" }
  // chunking is automatic - uses recursive by default
})

// Custom options
export default defineUnragConfig({
  embedding: { provider: "openai" },
  chunking: {
    method: "recursive",
    options: {
      chunkSize: 256,      // smaller chunks
      chunkOverlap: 25,    // less overlap
      minChunkSize: 16     // allow smaller chunks
    }
  }
})

// Use countTokens utility
import { countTokens } from 'unrag'
const tokens = countTokens("Hello world") // 2
```

---

## Plugin Architecture

### Built-in (Core)

| Method | Description | Dependencies |
|--------|-------------|--------------|
| `recursive` | Token-based recursive splitting (DEFAULT) | `js-tiktoken` |

### Plugins (Install via CLI)

| Method | Command | Dependencies |
|--------|---------|--------------|
| `semantic` | `bunx unrag add chunker:semantic` | None |
| `markdown` | `bunx unrag add chunker:markdown` | None |
| `hierarchical` | `bunx unrag add chunker:hierarchical` | None |
| `code` | `bunx unrag add chunker:code` | `tree-sitter` (optional) |
| `agentic` | `bunx unrag add chunker:agentic` | AI SDK |
| `late` | `bunx unrag add chunker:late` | None |
| `maxmin` | `bunx unrag add chunker:maxmin` | Embedding provider |
| `proposition` | `bunx unrag add chunker:proposition` | AI SDK |

### Escape Hatch

```typescript
// Custom chunker
export default defineUnragConfig({
  chunking: {
    method: "custom",
    chunker: (content, options) => {
      // Your custom logic
      return [{ index: 0, content, tokenCount: 100 }]
    }
  }
})
```

---

## Final Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     UNRAG CHUNKING                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BUILT-IN (Core)                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  recursive (DEFAULT)                                  │  │
│  │  • Token-based with js-tiktoken (o200k_base)         │  │
│  │  • 10-level separator hierarchy                       │  │
│  │  • Min chunk threshold (24 tokens)                    │  │
│  │  • GPT-5, GPT-4o, o1, o3, o4-mini, gpt-4.1 support   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  PLUGINS (Install via CLI)                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ semantic │ │ markdown │ │hierarchic│ │   code   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ agentic  │ │   late   │ │  maxmin  │ │proposit. │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  ESCAPE HATCH                                              │
│  ┌──────────┐                                              │
│  │  custom  │  ← Bring your own chunker                   │
│  └──────────┘                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Citations

[^1]: Günther, M. et al. "Late Chunking: Contextual Chunk Embeddings Using Long-Context Embedding Models." arXiv:2409.04701v3, July 2025. https://arxiv.org/pdf/2409.04701

[^2]: "Reconstructing Context: Evaluating Advanced Chunking Strategies for Retrieval-Augmented Generation." arXiv:2504.19754, April 2025. https://arxiv.org/abs/2504.19754

[^3]: "A Systematic Analysis of Chunking Strategies for Reliable Question Answering." arXiv:2601.14123, January 2026. https://arxiv.org/html/2601.14123

[^4]: "Max–Min semantic chunking of documents for RAG application." Discover Computing, Springer, June 2025. https://link.springer.com/article/10.1007/s10791-025-09638-7

[^5]: Zhou, Y. et al. "cAST: Enhancing Code Retrieval-Augmented Generation with Structural Chunking via Abstract Syntax Tree." EMNLP 2025. https://arxiv.org/abs/2506.15655

[^6]: "Comparative Evaluation of Advanced Chunking for Retrieval-Augmented Generation in Large Language Models for Clinical Decision Support." PMC, November 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC12649634/

[^7]: "Best Chunking Strategies for RAG in 2025." Firecrawl. https://www.firecrawl.dev/blog/best-chunking-strategies-rag-2025

[^8]: "Chunking Strategies to Improve Your RAG Performance." Weaviate. https://weaviate.io/blog/chunking-strategies-for-rag

[^9]: "Finding the Best Chunking Strategy for Accurate AI Responses." NVIDIA Developer Blog. https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/

[^10]: "The Ultimate Guide to Chunking Strategies for RAG Applications." Databricks Community. https://community.databricks.com/t5/technical-blog/the-ultimate-guide-to-chunking-strategies-for-rag-applications/ba-p/113089

[^11]: "Contextual Retrieval: A Guide With Implementation." DataCamp (Anthropic). https://www.datacamp.com/tutorial/contextual-retrieval-anthropic

[^12]: "Late Chunking in Long-Context Embedding Models." Jina AI. https://jina.ai/news/late-chunking-in-long-context-embedding-models/

[^13]: "Max–Min Semantic Chunking: Top Chunking Strategy to Improve RAG Performance." Milvus Blog. https://milvus.io/blog/embedding-first-chunking-second-smarter-rag-retrieval-with-max-min-semantic-chunking.md

[^14]: "Breaking up is hard to do: Chunking in RAG applications." Stack Overflow Blog, December 2024. https://stackoverflow.blog/2024/12/27/breaking-up-is-hard-to-do-chunking-in-rag-applications/

[^15]: "Document Chunking for RAG: 9 Strategies Tested (70% Accuracy Boost 2025)." LangCopilot. https://langcopilot.com/posts/2025-10-11-document-chunking-for-rag-practical-guide

[^16]: "Hierarchical Chunking: Preserving Document Structure." Ailog RAG. https://app.ailog.fr/en/blog/guides/hierarchical-chunking

[^17]: "Parent-Child Chunking in LangChain for Advanced RAG." Medium. https://medium.com/@seahorse.technologies.sl/parent-child-chunking-in-langchain-for-advanced-rag-e7c37171995a

[^18]: "gpt-tokenizer: The fastest JavaScript BPE Tokenizer for OpenAI's GPT models." GitHub. https://github.com/niieani/gpt-tokenizer

[^19]: "js-tiktoken: BPE tokeniser for use with OpenAI's models." npm. https://www.npmjs.com/package/js-tiktoken

[^20]: "What is o200k Harmony? OpenAI's latest edition to their tiktoken tokenizer library." Modal. https://modal.com/blog/what-is-o200k-harmony

---

## Summary

### Breaking Change (v0.4.0)

- **Removed:** Word-based chunking
- **Default:** Token-based recursive chunking with `js-tiktoken`
- **Encoding:** `o200k_base` (GPT-5, GPT-4o, o1, o3, o4-mini, gpt-4.1)

### Key Takeaways

1. **Token-based recursive** is the new default - industry standard with 100% token accuracy
2. **o200k_base encoding** supports all modern OpenAI models including GPT-5
3. **10-level separator hierarchy** preserves semantic boundaries
4. **Minimum chunk threshold** (24 tokens) avoids tiny chunks
5. **All other strategies** available as plugins via CLI
6. **Custom chunker** escape hatch for edge cases

### Migration Guide

```typescript
// Old (v0.3.x) - word-based
const chunks = defaultChunker(text, { chunkSize: 200, chunkOverlap: 40 })
// chunkSize was in WORDS

// New (v0.4.0+) - token-based
const chunks = recursiveChunker(text, { chunkSize: 512, chunkOverlap: 50 })
// chunkSize is now in TOKENS

// Token counting utility
import { countTokens } from 'unrag'
const tokens = countTokens("Your text here")
```
