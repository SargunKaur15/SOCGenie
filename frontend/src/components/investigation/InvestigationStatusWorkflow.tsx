import { Check, Circle, Loader2 } from "lucide-react";
import { Panel } from "../ui/Panel";
import {
  INVESTIGATION_STATUS_LABEL,
  INVESTIGATION_STATUS_ORDER,
  type InvestigationStatus,
} from "../../mocks/investigationStore";

/** NEW → TRIAGED → INVESTIGATING → CONTAINED → RESOLVED */
export function InvestigationStatusWorkflow({
  status,
  onChange,
}: {
  status: InvestigationStatus;
  onChange: (s: InvestigationStatus) => void;
}) {
  const currentIndex = INVESTIGATION_STATUS_ORDER.indexOf(status);

  return (
    <Panel eyebrow="Lifecycle" title="Investigation Status">
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
        {INVESTIGATION_STATUS_ORDER.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={s} className="flex flex-1 items-start gap-2 sm:flex-col sm:items-center sm:text-center">
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
                {i < INVESTIGATION_STATUS_ORDER.length - 1 && (
                  <span className={`hidden h-px flex-1 sm:block sm:w-full ${done ? "bg-status-success/40" : "bg-border"}`} aria-hidden="true" />
                )}
              </div>
              <div className="pb-4 sm:pb-0">
                <p className={`text-xs font-medium ${active ? "text-text-primary" : done ? "text-text-secondary" : "text-text-muted"}`}>
                  {INVESTIGATION_STATUS_LABEL[s]}
                </p>
                <p className="mt-0.5 text-2xs text-text-muted">
                  {done ? "Complete" : active ? "Active" : "Pending"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
        {INVESTIGATION_STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            disabled={s === status}
            className={`rounded-md border px-2.5 py-1.5 text-2xs font-medium transition-colors disabled:cursor-not-allowed ${
              s === status
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border bg-bg-elevated text-text-secondary hover:border-accent/40 hover:text-text-primary"
            }`}
          >
            {INVESTIGATION_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </Panel>
  );
}
