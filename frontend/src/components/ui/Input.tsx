import type { LucideIcon } from "lucide-react";

export function Input({
  icon: Icon,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          size={13}
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
      )}
      <input
        className={`h-8 w-full rounded-md border border-border bg-bg-elevated py-1.5 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent ${
          Icon ? "pl-7" : "pl-3"
        } ${className}`}
        {...props}
      />
    </div>
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-8 rounded-md border border-border bg-bg-elevated px-2.5 text-xs text-text-secondary focus:border-accent ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
