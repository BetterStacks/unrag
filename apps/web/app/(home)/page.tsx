import type { Metadata } from 'next';
import Link from 'next/link';
import { TerminalWindow } from './components/terminal-window';
import { AnimatedInstall } from './components/animated-install';
import { CodeBlock } from './components/code-block';
import { FeatureCard } from './components/feature-card';
import { CopyButton } from './components/copy-button';
import { GITHUB_REPO } from '@/constants';

const CODE_EXAMPLE = `import { createUnragEngine } from "@unrag/config";

const engine = createUnragEngine();

// Ingest: chunk → embed → store in Postgres
await engine.ingest({
  sourceId: "docs:readme",
  content: "Your document content here...",
});

// Retrieve: embed query → similarity search
const result = await engine.retrieve({
  query: "How do I get started?",
  topK: 5,
});

console.log(result.chunks);`;

export const metadata: Metadata = {
  title: 'UnRAG | Install RAG as source files, not dependencies',
  description:
    'UnRAG vendors small, auditable ingest/retrieve primitives into your codebase as source you own. Two methods: ingest() and retrieve(). Built for Postgres + pgvector.',
  openGraph: {
    title: 'UnRAG | Install RAG as source files, not dependencies',
    description:
      'UnRAG vendors small, auditable ingest/retrieve primitives into your codebase as source you own. Two methods: ingest() and retrieve(). Built for Postgres + pgvector.',
    url: '/',
    siteName: 'UnRAG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UnRAG | Install RAG as source files, not dependencies',
    description:
      'UnRAG vendors small, auditable ingest/retrieve primitives into your codebase as source you own. Two methods: ingest() and retrieve(). Built for Postgres + pgvector.',
  },
  keywords: ['RAG', 'retrieval augmented generation', 'pgvector', 'Postgres', 'TypeScript', 'ingest', 'retrieve'],
};

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(var(--color-fd-foreground) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-fd-foreground) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-fd-accent)] border border-[var(--color-fd-border)] text-xs font-medium text-[var(--color-fd-muted-foreground)] mb-8">
            <span className="w-2 h-2 rounded-full bg-[var(--unrag-green-500,hsl(89,31%,54%))] animate-pulse" />
            Not a dependency. Source code you own.
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[var(--color-fd-foreground)] mb-6">
            <span className="text-[var(--unrag-green-500,hsl(89,31%,54%))]">Un</span>RAG
          </h1>

          <p className="text-xl md:text-2xl text-[var(--color-fd-muted-foreground)] max-w-2xl mx-auto mb-12 leading-relaxed">
            Install RAG as source files, not dependencies.
            <br />
            <span className="text-[var(--color-fd-foreground)]">Two methods. Zero abstraction.</span>
          </p>

          {/* Terminal Demo */}
          <div className="max-w-lg mx-auto mb-12">
            <TerminalWindow title="~/your-project">
              <AnimatedInstall />
            </TerminalWindow>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/docs"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[var(--unrag-green-500,hsl(89,31%,54%))] text-[var(--unrag-ink,hsl(220,12%,5%))] font-semibold hover:opacity-90 transition-opacity"
            >
              Get Started
              <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-[var(--color-fd-border)] text-[var(--color-fd-foreground)] font-semibold hover:bg-[var(--color-fd-accent)] transition-colors"
            >
              <svg className="mr-2 w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="relative px-6 py-20 border-t border-[var(--color-fd-border)] bg-[var(--color-fd-card)]/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-fd-foreground)] mb-4">
              The entire API
            </h2>
            <p className="text-[var(--color-fd-muted-foreground)] text-lg">
              This is not a simplified example. This is the real thing.
            </p>
          </div>

          <TerminalWindow title="your-app.ts">
            <CodeBlock
              code={CODE_EXAMPLE}
              highlight={[4, 5, 6, 7, 8, 10, 11, 12, 13]}
            />
          </TerminalWindow>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-6 py-24 border-t border-[var(--color-fd-border)] text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-fd-foreground)] mb-4">
            Ready to own your RAG?
          </h2>
          <p className="text-[var(--color-fd-muted-foreground)] text-lg mb-8">
            One command. A few hundred lines of code. Full control.
          </p>

          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg bg-[var(--color-fd-card)] border border-[var(--color-fd-border)] font-mono text-sm">
            <span className="text-[var(--unrag-green-500,hsl(89,31%,54%))]">$</span>
            <span className="text-[var(--color-fd-foreground)]">bunx unrag init</span>
            <CopyButton text="bunx unrag init" />
          </div>

          <div className="mt-8">
            <Link
              href="/docs/getting-started/quickstart"
              className="text-[var(--unrag-green-500,hsl(89,31%,54%))] hover:underline font-medium"
            >
              Read the quickstart guide →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[var(--color-fd-border)] text-center text-sm text-[var(--color-fd-muted-foreground)]">
        <p>
          Built with care. MIT Licensed.{' '}
          <a
            href={GITHUB_REPO}
            className="underline hover:text-[var(--color-fd-foreground)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
