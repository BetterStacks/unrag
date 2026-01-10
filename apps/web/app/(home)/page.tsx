import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { TerminalWindow } from './components/terminal-window';
import { AnimatedInstall } from './components/animated-install';
import { CodeBlock } from './components/code-block';
import { CopyButton } from './components/copy-button';
import { Button } from '@/components/ui/button';
import { GITHUB_REPO } from '@/constants';
import { GlowingStarsBackground } from './components/glowing-stars-background';
import { RegistrySection } from './components/registry-section';
import bannerImg from '@/public/banner.png'
import FeatureAnnouncement from "@/app/(home)/components/feature-announcement";

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
  title: 'Unrag - RAG primitives you own and understand',
  description:
    'When you can read the code, you can trust it. Unrag installs small TypeScript primitives for vector storage and retrieval directly into your codebase, no framework to outgrow, no service to depend on, just source files that ship with your app.',
  openGraph: {
    title: 'Unrag - RAG primitives you own and understand',
    description:
      'When you can read the code, you can trust it. Unrag installs small TypeScript primitives for vector storage and retrieval directly into your codebase—no framework to outgrow, no service to depend on, just source files that ship with your app.',
    url: '/',
    siteName: 'Unrag',
    type: 'website',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Unrag',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Unrag - RAG primitives you own and understand',
    description:
      'When you can read the code, you can trust it. Unrag installs small TypeScript primitives for vector storage and retrieval directly into your codebase—no framework to outgrow, no service to depend on, just source files that ship with your app.',
    images: ['/twitter-image.png'],
  },
  keywords: ['RAG', 'vector search', 'embeddings', 'TypeScript', 'code ownership', 'pgvector', 'open source'],
};

export default function HomePage() {
  const LICENSE_URL = `${GITHUB_REPO}/blob/main/LICENSE`;

  const reveal = (delayMs: number) =>
    ({ ['--unrag-reveal-delay' as any]: `${delayMs}ms` }) as React.CSSProperties;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-fd-background)]">
      {/* Landscape background */}
      <Image src={bannerImg} alt="Nigh-time view of a windy amber road through the mountains" className="absolute inset-0 z-[1] w-screen h-screen opacity-30 hidden md:block" />

      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24 overflow-hidden bg-[hsl(0,0%,2%)]">
        {/* Glowing stars background */}
        <GlowingStarsBackground className="z-[1]" />

        {/* Blender to match the bottom section */}
        <div className="absolute bottom-0 z-[2] w-screen h-1/2 bg-linear-to-b from-transparent to-[#050505] to-80%" />

        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsla(0,0%,100%,0.05),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(0,0%,2%)] opacity-60 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(0,0%,2%)_70%)] opacity-45 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center translate-y-[-10%]">
          <FeatureAnnouncement href="/docs/rag" className="mb-6" content="Complete RAG Handbook" />

          {/* Headline */}
          <h1
            className="unrag-reveal text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent mb-6 leading-[1]"
            style={reveal(0)}
          >
            Composable & extendable primitives to build rag systems
          </h1>

          {/* Description */}
          <p className="unrag-reveal text-lg text-white/55 max-w-2xl mx-auto leading-snug" style={reveal(140)}>
            A simple system of ergonomically designed primitives that you can customize, extend, and build on to create versatile, robust and extendable RAG systems.
          </p>

          {/* Main command */}
          <div className="unrag-reveal my-6 flex justify-center" style={reveal(280)}>
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur font-mono text-sm">
              <span className="text-white/55">$</span>
              <span className="text-white">bunx unrag@latest init</span>
              <CopyButton text="bunx unrag@latest init" />
            </div>
          </div>

          {/* Terminal Demo */}
          <section className="unrag-reveal relative px-6 mb-12" style={reveal(420)}>
            <div className="max-w-lg mx-auto">
            <TerminalWindow title="~/your-project">
              <AnimatedInstall />
            </TerminalWindow>
          </div>
          </section>

          {/* CTA Buttons */}
          <div className="unrag-reveal flex flex-col sm:flex-row gap-4 justify-center items-center" style={reveal(560)}>
            <Button asChild variant="cta">
              <Link href="/install">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Get started
              </Link>
            </Button>
            <Link
              href="/docs/getting-started/quickstart"
              className="group inline-flex items-center gap-2 px-4 py-2.5 text-[var(--color-fd-muted-foreground)] font-medium text-sm hover:text-[var(--color-fd-foreground)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Documentation
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="relative px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-fd-foreground)] mb-4">
              Two methods. That&#39;s it.
            </h2>
            <p className="text-[var(--color-fd-muted-foreground)] text-lg max-w-2xl mx-auto">
              This isn&#39;t a simplified demo—it&#39;s the actual API. Ingest your content, retrieve what&#39;s relevant.
              No hidden complexity, no configuration mazes, no abstractions you&#39;ll need to fight later.
              Just a few hundred lines of TypeScript you can read, understand, and make your own.
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

      {/* Registry Section */}
      <RegistrySection />

      {/* Final CTA */}
      <section className="relative px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-fd-foreground)] mb-4">
            Ready to own your RAG?
          </h2>
          <p className="text-[var(--color-fd-muted-foreground)] text-lg mb-8">
            One command. A few hundred lines of code. Full control.
          </p>

          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg bg-[var(--color-fd-card)] border border-[var(--color-fd-border)] font-mono text-sm">
            <span className="text-[var(--color-fd-muted-foreground)]">$</span>
            <span className="text-[var(--color-fd-foreground)]">bunx unrag@latest init</span>
            <CopyButton text="bunx unrag@latest init" />
          </div>

          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Link
              href="/docs/getting-started/quickstart"
              className="text-[var(--color-fd-foreground)] hover:text-[var(--color-fd-muted-foreground)] font-medium transition-colors"
            >
              Read the quickstart →
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[var(--color-fd-muted-foreground)] hover:text-[var(--color-fd-foreground)] font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
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

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[var(--color-fd-border)] text-center text-sm text-[var(--color-fd-muted-foreground)]">
        <p>
          Built with care.{' '}
          <a
            href={LICENSE_URL}
            className="underline hover:text-[var(--color-fd-foreground)] transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apache-2.0 Licensed
          </a>
          .{' '}
          <a
            href={GITHUB_REPO}
            className="underline hover:text-[var(--color-fd-foreground)] transition-colors"
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
