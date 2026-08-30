import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-elevated text-text-muted">
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-text-secondary">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
