import { Check, MinusCircle } from "lucide-react";
import type { ReplayStep } from "../../lib/ai/types";

/** Shows the pipeline the engine actually ran — not invented "reasoning". */
export function AIReplay({ steps }: { steps: ReplayStep[] }) {
  return (
    <div>
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
        How this analysis was produced
      </p>
      <ol className="space-y-1">
        {steps.map((s) => (
          <li key={s.step} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                s.status === "complete"
                  ? "border-status-success/40 bg-status-success/10 text-status-success"
                  : "border-border bg-bg-elevated text-text-muted"
              }`}
            >
              {s.status === "complete" ? <Check size={9} strokeWidth={3} /> : <MinusCircle size={9} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-2xs font-medium text-text-primary">{s.step}</span>
                {s.evidenceCount !== null && (
                  <span className="mono text-2xs tabular text-text-muted">{s.evidenceCount} items</span>
                )}
              </span>
              <span className="block text-2xs leading-relaxed text-text-muted">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
