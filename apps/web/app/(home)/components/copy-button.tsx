'use client';

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      className="ml-2 p-1.5 rounded hover:bg-[var(--color-fd-accent)] transition-colors text-[var(--color-fd-muted-foreground)] hover:text-[var(--color-fd-foreground)]"
      onClick={() => navigator.clipboard.writeText(text)}
      title="Copy to clipboard"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    </button>
  );
}

