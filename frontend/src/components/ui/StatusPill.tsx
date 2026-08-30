type Tone = "success" | "info" | "warning" | "neutral";

const DOT: Record<Tone, string> = {
  success: "bg-status-success",
  info: "bg-accent",
  warning: "bg-status-medium",
  neutral: "bg-text-muted",
};
const TEXT: Record<Tone, string> = {
  success: "text-status-success",
  info: "text-accent",
  warning: "text-status-medium",
  neutral: "text-text-secondary",
};

export function StatusPill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap px-3 py-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]}`} aria-hidden="true" />
      <span className="text-2xs uppercase tracking-wide text-text-muted">{label}</span>
      <span className={`text-2xs font-semibold uppercase tracking-wide ${TEXT[tone]}`}>{value}</span>
    </div>
  );
}
