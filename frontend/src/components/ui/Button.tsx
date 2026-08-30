import type { LucideIcon } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-bg-primary hover:opacity-90 border border-transparent",
  secondary: "border border-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-accent/40",
  ghost: "border border-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
  destructive: "border border-status-critical/40 bg-status-critical/10 text-status-critical hover:bg-status-critical/15",
};

export function Button({
  variant = "secondary",
  icon: Icon,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon }) {
  return (
    <button
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={13} strokeWidth={2} aria-hidden="true" />}
      {children}
    </button>
  );
}
