export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className = "",
  noPadding = false,
}: {
  title?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <section className={`rounded-lg border border-border bg-bg-surface shadow-panel ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">{eyebrow}</p>
            )}
            {title && <h2 className="truncate text-sm font-medium text-text-primary">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>{children}</div>
    </section>
  );
}
