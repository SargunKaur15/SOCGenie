import { Server, Radar, Brain, Gauge, ShieldAlert } from "lucide-react";

interface Stage {
  key: string;
  label: string;
  icon: typeof Server;
  value: number | null;
  note?: string;
}

/**
 * Renders the actual detection pipeline with live counts.
 * The ML stage reports null until Phase 11 — we show a dash, not a number.
 */
export function PipelineFlow({
  events,
  ruleMatches,
  mlPredictions,
  alerts,
  incidents,
}: {
  events: number;
  ruleMatches: number;
  mlPredictions: number | null;
  alerts: number;
  incidents: number;
}) {
  const stages: Stage[] = [
    { key: "events", label: "Events", icon: Server, value: events },
    { key: "rules", label: "Rule matches", icon: Radar, value: ruleMatches },
    { key: "ml", label: "ML predictions", icon: Brain, value: mlPredictions, note: mlPredictions === null ? "Engine not loaded" : undefined },
    { key: "risk", label: "Alerts", icon: Gauge, value: alerts },
    { key: "incidents", label: "Incidents", icon: ShieldAlert, value: incidents },
  ];

  return (
    <div className="flex items-start justify-between gap-1 overflow-x-auto">
      {stages.map((stage, i) => {
        const Icon = stage.icon;
        const unavailable = stage.value === null;
        return (
          <div key={stage.key} className="flex flex-1 items-start">
            <div className="flex min-w-[92px] flex-1 flex-col items-center text-center">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-lg border ${
                  unavailable ? "border-border bg-bg-elevated text-text-muted" : "border-border bg-bg-elevated text-accent"
                }`}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <span className="mono mt-2 text-base font-semibold tabular text-text-primary">
                {unavailable ? <span className="text-text-muted">—</span> : stage.value!.toLocaleString()}
              </span>
              <span className="mt-0.5 text-2xs text-text-muted">{stage.label}</span>
              {stage.note && <span className="mt-0.5 text-2xs text-text-muted/70">{stage.note}</span>}
            </div>
            {i < stages.length - 1 && (
              <div className="mt-[22px] h-px w-4 shrink-0 bg-border sm:w-8" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
