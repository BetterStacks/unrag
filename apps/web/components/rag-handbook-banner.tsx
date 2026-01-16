'use client';

import Link from 'next/link';
import Image from 'next/image';
import handbookImage from '@/public/rag-handbook.png'
import { ArrowRight } from 'lucide-react';
import {Button} from "@/components/ui/button";

/**
 * RAG Handbook Banner Component
 * Displays in the right sidebar (Table of Contents) footer to promote the RAG handbook.
 */
export default function RAGHandbookBanner() {
  return (
    <div className="mt-16">
      {/* Link wrapping the entire banner */}
      <Link
        href="/docs/rag"
        className="group flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-fd-accent)]"
        aria-label="Explore the Complete RAG Handbook - Learn RAG from first principles to production operations"
      >
        {/* Banner Image */}
        <Image
            src={handbookImage}
            alt="RAG handbook banner image"
            priority={false}
            className="group-hover:rotate-3 transition-all"
        />

        <p className="text-xs font-semibold tracking-wide text-lemon-600 dark:text-lemon-400 uppercase">
          Free comprehensive guide
        </p>

        <h3 className="text-xl font-bold leading-tight text-slate-900 dark:text-[#f5f5f5] -mt-1">
          Complete RAG Handbook
        </h3>

        <p className="text-xs leading-relaxed text-slate-600 dark:text-[#d1d5db] opacity-80 my-1">
          Learn RAG from first principles to production operations. Tackle decisions, tradeoffs and failure modes in production RAG operations
        </p>

        <Button size="xs" variant="cta" className="w-min group-hover:scale-[1.02] group-hover:bg-primary/90 cursor-pointer">
          Take me there
          <ArrowRight
              className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
          />
        </Button>
      </Link>

      {/* Accessibility note for screen readers */}
      <span className="sr-only">
        The RAG handbook covers retrieval augmented generation from foundational principles through production deployment, including quality-latency-cost tradeoffs and operational considerations. Click to access the complete handbook.
      </span>
    </div>
  );
}
