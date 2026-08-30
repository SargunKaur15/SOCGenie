type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-bg-elevated text-text-secondary",
  accent: "border-accent/30 bg-accent/10 text-accent",
  success: "border-status-success/30 bg-status-success/10 text-status-success",
  warning: "border-status-medium/30 bg-status-medium/10 text-status-medium",
  danger: "border-status-critical/30 bg-status-critical/10 text-status-critical",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
