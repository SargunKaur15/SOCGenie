import { Info } from "lucide-react";
import type { Priority, RecommendedAction, RecommendedStep } from "../../lib/ai/types";

const PRIORITY_TONE: Record<Priority, string> = {
  high: "border-status-critical/40 bg-status-critical/10 text-status-critical",
  medium: "border-status-medium/40 bg-status-medium/10 text-status-medium",
  low: "border-border bg-bg-elevated text-text-muted",
};

export function AIPlan({
  steps,
  actions,
  hunting,
}: {
  steps: RecommendedStep[];
  actions: RecommendedAction[];
  hunting: string[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Investigation plan
        </p>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-md border border-border bg-bg-elevated px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-text-primary">
                  <span className="mono mr-1.5 text-text-muted">{i + 1}.</span>
                  {s.title}
                </span>
                <span className={`rounded border px-1.5 py-0.5 text-2xs font-semibold ${PRIORITY_TONE[s.priority]}`}>
                  {s.priority}
                </span>
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-text-secondary">{s.reason}</p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Threat hunting suggestions
        </p>
        <ul className="space-y-1">
          {hunting.map((h) => (
            <li key={h} className="mono text-2xs leading-relaxed text-text-secondary">• {h}</li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Recommended response
        </p>
        <ul className="space-y-2">
          {actions.map((a) => (
            <li key={a.action} className="rounded-md border border-border bg-bg-elevated px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-text-primary">{a.action}</span>
                <span className={`rounded border px-1.5 py-0.5 text-2xs font-semibold ${PRIORITY_TONE[a.priority]}`}>
                  {a.priority}
                </span>
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-text-secondary">{a.reason}</p>
            </li>
          ))}
        </ul>

        {/* Advisory-only is a structural guarantee: the type requires it and
            nothing in this component can execute an action. */}
        <p className="mt-2.5 flex items-start gap-1.5 rounded-md border border-status-medium/30 bg-status-medium/[0.05] px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
          <Info size={12} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
          Every action above is a recommendation requiring analyst approval. Nothing is executed
          automatically, no endpoint is isolated and no account is modified.
        </p>
      </div>
    </div>
  );
}
