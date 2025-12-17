'use client';

import { useState, useEffect, useCallback } from 'react';

function TypeWriter({ text, delay = 50, onComplete }: { text: string; delay?: number; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx < text.length) {
      const timeout = setTimeout(() => {
        setDisplayed((prev) => prev + text[idx]);
        setIdx((i) => i + 1);
      }, delay);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [idx, text, delay, onComplete]);

  return (
    <span>
      {displayed}
      {idx < text.length && <span className="animate-pulse">▌</span>}
    </span>
  );
}

export function AnimatedInstall() {
  const [phase, setPhase] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use setTimeout chain for reliable phase progression
  const startPhaseSequence = useCallback(() => {
    // Phase 1: Show first two lines
    setTimeout(() => setPhase(1), 400);
    // Phase 2: Show next two lines (400 + 600 = 1000ms after typing ends)
    setTimeout(() => setPhase(2), 1000);
    // Phase 3: Show final line (400 + 600 + 500 = 1500ms after typing ends)
    setTimeout(() => setPhase(3), 1500);
  }, []);

  // Static placeholder for SSR - same structure as animated version
  if (!mounted) {
    return (
      <div className="space-y-1 text-left">
        <div className="text-[var(--color-fd-muted-foreground)]">
          <span className="text-[var(--color-fd-muted-foreground)]">$</span> bunx unrag init
        </div>
        <div className="opacity-0">✓ Created unrag.config.ts</div>
        <div className="opacity-0">✓ Installed lib/unrag/core/*</div>
        <div className="opacity-0">✓ Installed lib/unrag/store/drizzle</div>
        <div className="opacity-0">✓ Installed lib/unrag/embedding/ai</div>
        <div className="opacity-0 mt-2 text-cyan-300">Done. Your RAG module is ready.</div>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-left">
      <div className="text-[var(--color-fd-muted-foreground)]">
        <span className="text-[var(--color-fd-muted-foreground)]">$</span>{' '}
        <TypeWriter text="bunx unrag init" delay={60} onComplete={startPhaseSequence} />
      </div>
      
      <div
        className={`text-[var(--color-fd-foreground)] transition-opacity duration-300 ${
          phase >= 1 ? 'opacity-80' : 'opacity-0'
        }`}
      >
        ✓ Created unrag.config.ts
      </div>
      
      <div
        className={`text-[var(--color-fd-foreground)] transition-opacity duration-300 ${
          phase >= 1 ? 'opacity-80' : 'opacity-0'
        }`}
        style={{ transitionDelay: phase >= 1 && phase < 2 ? '150ms' : '0ms' }}
      >
        ✓ Installed lib/unrag/core/*
      </div>
      
      <div
        className={`text-[var(--color-fd-foreground)] transition-opacity duration-300 ${
          phase >= 2 ? 'opacity-80' : 'opacity-0'
        }`}
      >
        ✓ Installed lib/unrag/store/drizzle
      </div>
      
      <div
        className={`text-[var(--color-fd-foreground)] transition-opacity duration-300 ${
          phase >= 2 ? 'opacity-80' : 'opacity-0'
        }`}
        style={{ transitionDelay: phase >= 2 && phase < 3 ? '150ms' : '0ms' }}
      >
        ✓ Installed lib/unrag/embedding/ai
      </div>
      
      <div
        className={`text-[var(--color-fd-foreground)] font-medium mt-2 transition-opacity duration-300 ${
          phase >= 3 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Done. Your RAG module is ready.
      </div>
    </div>
  );
}
