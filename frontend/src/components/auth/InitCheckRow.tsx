import { Check, Info, Loader2 } from "lucide-react";
import type { CheckStatus } from "../../hooks/useInitializationChecks";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * A single initialization status line.
 *
 * `info` renders in neutral muted tones — never amber or red. An unavailable
 * subsystem in Phase 1 is an expected state, not a failure, and colouring it as
 * a warning would misrepresent it.
 *
 * Checks resolve one at a time in useInitializationChecks' own real async
 * sequence (~260ms apart), so the checkmark's pop-in animation is already
 * sequential by construction — no artificial per-row delay is layered on top
 * of it, only the row's own much shorter slide-in stagger.
 */
export function InitCheckRow({
  label,
  status,
  detail,
  index,
}: {
  label: string;
  status: CheckStatus;
  detail?: string;
  index: number;
}) {
  const settled = status === "ok" || status === "info";
  const reduced = usePrefersReducedMotion();

  return (
    <li
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-200 ${
        status === "running" ? "bg-bg-elevated" : ""
      } ${settled ? "animate-status-in" : ""}`}
      style={settled ? { animationDelay: `${index * 20}ms`, animationFillMode: "both" } : undefined}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
          status === "ok"
            ? `border-status-success/40 bg-status-success/10 text-status-success shadow-[0_0_8px_-2px_rgb(var(--status-success)/0.6)] ${
                reduced ? "" : "animate-check-in"
              }`
            : status === "info"
              ? "border-border bg-bg-elevated text-text-muted"
              : status === "running"
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-bg-elevated text-text-muted/50"
        }`}
      >
        {status === "ok" ? (
          <Check size={11} strokeWidth={3} />
        ) : status === "info" ? (
          <Info size={11} strokeWidth={2.5} />
        ) : status === "running" ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <span className="h-1 w-1 rounded-full bg-current" />
        )}
      </span>

      <span
        className={`flex-1 text-sm transition-colors duration-200 ${
          status === "pending" ? "text-text-muted" : "text-text-primary"
        }`}
      >
        {label}
      </span>

      <span className="shrink-0 text-xs text-text-muted">
        {status === "pending" ? "" : status === "running" ? "Checking…" : detail}
      </span>
    </li>
  );
}
