'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

type MermaidRenderResult = {
  svg: string;
  bindFunctions?: (element: Element) => void;
};

type MermaidModule = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<MermaidRenderResult>;
};

let mermaidPromise: Promise<MermaidModule> | null = null;
let mermaidInitialized = false;

async function getMermaid(): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => (m as any).default ?? (m as any));
  }
  const mermaid = await mermaidPromise;

  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      // Site is hard-pinned to dark mode (see `app/layout.tsx`)
      theme: 'dark',
      securityLevel: 'strict',
      fontFamily: 'inherit',
    });
    mermaidInitialized = true;
  }

  return mermaid;
}

export function Mermaid({
  chart,
  className,
}: {
  chart: string;
  className?: string;
}) {
  const reactId = useId();
  const mermaidId = useMemo(() => `mermaid-${reactId.replaceAll(':', '')}`, [reactId]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string>('');
  const [bind, setBind] = useState<MermaidRenderResult['bindFunctions']>();
  const [error, setError] = useState<string | null>(null);

  const normalizedChart = useMemo(() => chart.replaceAll('\\n', '\n').trim(), [chart]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      setSvg('');
      setBind(undefined);

      try {
        const mermaid = await getMermaid();
        const res = await mermaid.render(mermaidId, normalizedChart);
        if (cancelled) return;
        setSvg(res.svg);
        setBind(() => res.bindFunctions);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    }

    if (normalizedChart.length > 0) run();
    return () => {
      cancelled = true;
    };
  }, [mermaidId, normalizedChart]);

  useEffect(() => {
    if (!svg) return;
    if (!bind) return;
    const el = containerRef.current;
    if (!el) return;
    bind(el);
  }, [svg, bind]);

  if (error) {
    return (
      <div className={['not-prose my-6 flex justify-center', className ?? ''].join(' ')}>
        <div className="w-full max-w-3xl rounded-lg border border-[var(--color-fd-border)] bg-[var(--color-fd-muted)] p-4">
          <div className="text-sm text-[var(--color-fd-muted-foreground)]">
            Mermaid diagram failed to render: {error}
          </div>
          <pre className="mt-3 overflow-x-auto text-sm leading-relaxed">{normalizedChart}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className={['not-prose my-6 flex justify-center', className ?? ''].join(' ')}>
      <div className="w-full max-w-3xl rounded-lg border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] p-4 overflow-x-auto">
        {svg ? (
          <div
            ref={containerRef}
            className="flex justify-center [&>svg]:h-auto [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="text-sm text-[var(--color-fd-muted-foreground)]">Rendering diagram…</div>
        )}
      </div>
    </div>
  );
}


