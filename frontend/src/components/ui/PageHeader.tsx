import type { LucideIcon } from "lucide-react";

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-elevated text-accent">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-text-primary">{title}</h1>
          <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
