import { Check, Circle, Loader2 } from "lucide-react";
import { Panel } from "../ui/Panel";

/**
 * Shared lifecycle stepper for incidents and investigations (Phase C
 * consolidation — see the readiness audit's incidents/investigation
 * duplication finding). The two domains have genuinely different stage
 * counts and vocabularies (4 incident stages vs 5 investigation stages), so
 * those stay as data passed in, not hardcoded here — only the presentation
 * (the stepper markup, the status-change button row) was actually
 * duplicated.
 */
export function WorkflowStepper<TStatus extends string>({
  eyebrow,
  title,
  stages,
  currentIndex,
  statusOrder,
  statusLabel,
  onChange,
}: {
  eyebrow: string;
  title: string;
  stages: { key: TStatus; label: string }[];
  currentIndex: number;
  /** All selectable statuses, for the button row below the stepper — not
   *  always the same set as `stages` (e.g. a stage can group statuses). */
  statusOrder: readonly TStatus[];
  statusLabel: Record<TStatus, string>;
  onChange: (s: TStatus) => void;
}) {
  return (
    <Panel eyebrow={eyebrow} title={title}>
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
        {stages.map((stage, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={stage.key} className="flex flex-1 items-start gap-2 sm:flex-col sm:items-center sm:text-center">
              <div className="flex items-center gap-2 sm:w-full sm:flex-col">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                    done
                      ? "border-status-success/40 bg-status-success/10 text-status-success"
                      : active
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border bg-bg-elevated text-text-muted"
                  }`}
                >
                  {done ? <Check size={13} strokeWidth={3} /> : active ? <Loader2 size={13} /> : <Circle size={9} />}
                </span>
                {i < stages.length - 1 && (
                  <span className={`hidden h-px flex-1 sm:block sm:w-full ${done ? "bg-status-success/40" : "bg-border"}`} aria-hidden="true" />
                )}
              </div>
              <div className="pb-4 sm:pb-0">
                <p className={`text-xs font-medium ${active ? "text-text-primary" : done ? "text-text-secondary" : "text-text-muted"}`}>
                  {stage.label}
                </p>
                <p className="mt-0.5 text-2xs text-text-muted">{done ? "Complete" : active ? "Active" : "Pending"}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
        {statusOrder.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            disabled={currentIndex === statusOrder.indexOf(s)}
            className={`rounded-md border px-2.5 py-1.5 text-2xs font-medium transition-colors disabled:cursor-not-allowed ${
              currentIndex === statusOrder.indexOf(s)
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border bg-bg-elevated text-text-secondary hover:border-accent/40 hover:text-text-primary"
            }`}
          >
            {statusLabel[s]}
          </button>
        ))}
      </div>
    </Panel>
  );
}
