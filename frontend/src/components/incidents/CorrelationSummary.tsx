import { Panel } from "../ui/Panel";
import type { SocIncident } from "../../mocks/incidentStore";

export function CorrelationSummary({ incident }: { incident: SocIncident }) {
  const hosts = new Set(incident.assets.map((a) => a.host)).size;
  const users = new Set(incident.assets.map((a) => a.user).filter(Boolean)).size;

  const stats = [
    { label: "Alerts correlated", value: incident.alertRefs.length },
    { label: "Events correlated", value: incident.eventsCorrelated },
    { label: "Hosts involved", value: hosts },
    { label: "Users involved", value: users },
    { label: "MITRE techniques", value: incident.techniqueIds.length },
    { label: "Risk score", value: incident.riskScore },
  ];

  return (
    <Panel eyebrow="Correlation" title="Correlation Summary">
      <dl className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-bg-elevated px-3 py-2.5 text-center">
            <dd className="mono text-lg font-semibold tabular text-text-primary">{s.value}</dd>
            <dt className="mt-0.5 text-2xs leading-tight text-text-muted">{s.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-border pt-2.5 text-2xs text-text-muted">
        Alerts were grouped by shared entity within a 30-minute window.
      </p>
    </Panel>
  );
}
