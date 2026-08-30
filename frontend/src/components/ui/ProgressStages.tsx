import { Check, Loader2 } from "lucide-react";

export type StageState = "pending" | "active" | "done";

/** Multi-stage operations show NAMED stages, never an opaque spinner.
 *  The stage list doubles as an explanation of the detection architecture. */
export function ProgressStages({ stages }: { stages: { label: string; state: StageState }[] }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {stages.map((stage) => (
        <li key={stage.label} className="flex items-center gap-2.5 text-2xs">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
              stage.state === "done"
                ? "border-status-success/40 bg-status-success/10 text-status-success"
                : stage.state === "active"
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-bg-elevated text-text-muted"
            }`}
          >
            {stage.state === "done" ? (
              <Check size={9} strokeWidth={3} />
            ) : stage.state === "active" ? (
              <Loader2 size={9} className="animate-spin" />
            ) : (
              <span className="h-1 w-1 rounded-full bg-current" />
            )}
          </span>
          <span className={stage.state === "pending" ? "text-text-muted" : "text-text-secondary"}>
            {stage.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
