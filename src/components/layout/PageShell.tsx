export function PageShell({
  eyebrow,
  title,
  toolbar,
  children,
}: {
  eyebrow?: string;
  title: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-stone-200/70 bg-[#f5f1eb] pb-4">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-[0.2em] text-[#d4a853] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-serif text-3xl text-[#1e3a5f]">{title}</h1>
        {toolbar ? <div className="mt-4">{toolbar}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-4">{children}</div>
    </div>
  );
}

export function SectionShell({
  title,
  toolbar,
  children,
  footer,
}: {
  title: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="flex w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-stone-100 bg-white px-6 py-4">
        <h2 className="font-serif text-xl text-[#1e3a5f]">{title}</h2>
        {toolbar ? <div className="mt-4">{toolbar}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-stone-100 px-6 py-4">{footer}</div>
      ) : null}
    </section>
  );
}
