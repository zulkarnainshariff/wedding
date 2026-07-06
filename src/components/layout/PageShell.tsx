export function PageShell({
  eyebrow,
  title,
  titleAction,
  toolbar,
  children,
}: {
  eyebrow?: string;
  title: string;
  titleAction?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative z-30 shrink-0 border-b border-border/60 bg-background/80 pb-2 backdrop-blur-sm">
        {eyebrow && (
          <p className="theme-eyebrow text-xs font-semibold uppercase">
            {eyebrow}
          </p>
        )}
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="min-w-0 font-serif text-3xl text-brand-deep">{title}</h1>
          {titleAction ? <div className="shrink-0">{titleAction}</div> : null}
        </div>
        {toolbar ? <div className="mt-4">{toolbar}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-2">{children}</div>
    </div>
  );
}

export function SectionShell({
  title,
  toolbar,
  children,
  footer,
  stickyHeader = false,
}: {
  title: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  stickyHeader?: boolean;
}) {
  return (
    <section className="theme-card flex w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-sm">
      <div
        className={[
          "theme-gradient-header shrink-0 border-b border-border/50 px-6 py-4",
          stickyHeader ? "sticky top-0 z-20 bg-surface/95 backdrop-blur-sm" : "",
        ].join(" ")}
      >
        <h2 className="font-serif text-xl text-brand-deep">{title}</h2>
        {toolbar ? <div className="mt-4">{toolbar}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-stone-100 px-6 py-4">{footer}</div>
      ) : null}
    </section>
  );
}
