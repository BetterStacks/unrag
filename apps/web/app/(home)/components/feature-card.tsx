export function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="group p-6 rounded-xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] hover:border-[var(--unrag-green-500,hsl(89,31%,54%))]/40 transition-all duration-300">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-[var(--color-fd-foreground)] mb-2">{title}</h3>
      <p className="text-[var(--color-fd-muted-foreground)] text-sm leading-relaxed">{description}</p>
    </div>
  );
}

