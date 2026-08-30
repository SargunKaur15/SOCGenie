import { Check, Circle, Loader2 } from "lucide-react";
import { Panel } from "../ui/Panel";
import { INCIDENT_STATUS_LABEL, INCIDENT_STATUS_ORDER, type IncidentWorkflowStatus } from "../../mocks/incidentStore";

/** Detection → Investigation → Containment → Resolution, derived from the
 *  incident's current workflow status so the two can never disagree. */
const STAGES = [
  { key: "new" as const, label: "Detection" },
  { key: "investigating" as const, label: "Investigation" },
  { key: "contained" as const, label: "Containment" },
  { key: "resolved" as const, label: "Resolution" },
];

export function IncidentStatusWorkflow({
  status,
  onChange,
}: {
  status: IncidentWorkflowStatus;
  onChange: (s: IncidentWorkflowStatus) => void;
}) {
  const currentIndex = INCIDENT_STATUS_ORDER.indexOf(status);

  return (
    <Panel eyebrow="Response lifecycle" title="Incident Status">
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
        {STAGES.map((stage, i) => {
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
                {i < STAGES.length - 1 && (
                  <span className={`hidden h-px flex-1 sm:block sm:w-full ${done ? "bg-status-success/40" : "bg-border"}`} aria-hidden="true" />
                )}
              </div>
              <div className="pb-4 sm:pb-0">
                <p className={`text-xs font-medium ${active ? "text-text-primary" : done ? "text-text-secondary" : "text-text-muted"}`}>
                  {stage.label}
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
        {INCIDENT_STATUS_ORDER.map((s) => (
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
            {INCIDENT_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </Panel>
  );
}
