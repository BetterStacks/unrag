import type { Metadata } from 'next';
import InstallWizardClient from './install-wizard-client';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Unrag - Install wizard',
  description:
    'Configure a shareable Unrag installation and generate a single preset-backed command that installs core, connectors, extractors, and config in one go.',
  openGraph: {
    title: 'Unrag - Install wizard',
    description:
      'Configure a shareable Unrag installation and generate a single preset-backed command that installs core, connectors, extractors, and config in one go.',
    url: '/install',
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
    title: 'Unrag - Install wizard',
    description:
      'Configure a shareable Unrag installation and generate a single preset-backed command that installs core, connectors, extractors, and config in one go.',
    images: ['/twitter-image.png'],
  },
  keywords: ['Unrag', 'install', 'RAG', 'vector search', 'embeddings', 'TypeScript', 'pgvector'],
};

export default function InstallPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-lemon-50 dark:bg-lemon-950 flex items-center justify-center">
          <div className="text-sm text-olive-700 dark:text-olive-400">Loading install wizard…</div>
        </div>
      }
    >
      <InstallWizardClient />
    </Suspense>
  );
}
