import { FlaskConical, Play, ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SIMULATION_SCENARIOS } from "../lib/data/fixtures";

const FLOW = ["Event", "Normalise", "ML", "Rules", "Fusion", "Risk", "MITRE", "Alert", "Correlate", "Incident"];

export function SimulationLab() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={FlaskConical}
        title="Simulation Lab"
        description="Generate synthetic security events to exercise the detection pipeline"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-status-success/25 bg-status-success/[0.05] px-4 py-3">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-status-success" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-medium text-text-primary">Defensive simulation only</p>
              <p className="mt-0.5 text-2xs text-text-secondary">
                Scenarios write synthetic event records inside SOCGenie. No packets are sent, no process is executed,
                and no system is targeted.
              </p>
            </div>
          </div>

          <Panel eyebrow="Shared path" title="Simulated events use the same pipeline as uploaded logs">
            <div className="flex flex-wrap items-center gap-y-2">
              {FLOW.map((stage, i) => (
                <div key={stage} className="flex items-center">
                  <span className="rounded-md border border-border bg-bg-elevated px-2.5 py-1 text-2xs text-text-secondary">
                    {stage}
                  </span>
                  {i < FLOW.length - 1 && <span className="mx-1.5 text-text-muted" aria-hidden="true">→</span>}
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-border pt-3 text-2xs text-text-muted">
              There is no separate simulation code path. The generator produces normalised events and calls the same
              pipeline entry point as a file upload.
            </p>
          </Panel>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SIMULATION_SCENARIOS.map((s) => (
              <article key={s.key} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-bg-surface p-4 shadow-panel">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-text-primary">{s.name}</p>
                  <p className="mt-1 text-2xs text-text-secondary">{s.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge>{s.expected_detection}</Badge>
                    <Badge tone="accent"><span className="mono">{s.technique}</span></Badge>
                  </div>
                </div>
                <Button icon={Play} disabled title="Simulation execution is not available">Run</Button>
              </article>
            ))}
          </div>

          <p className="pb-2 text-center text-2xs text-text-muted">
            Scenarios become runnable in Phase 14, once the full detection pipeline exists for them to exercise.
          </p>
        </div>
      </div>
    </div>
  );
}
