export function TerminalWindow({ children, title = 'terminal' }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[var(--color-fd-border)] bg-[hsl(0,0%,4%)]">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-fd-card)] border-b border-[var(--color-fd-border)]">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-xs text-[var(--color-fd-muted-foreground)] font-mono ml-2">{title}</span>
      </div>
      <div className="p-4 font-mono text-sm leading-relaxed">{children}</div>
    </div>
  );
}
