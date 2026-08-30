import { FlaskConical } from "lucide-react";
import type { SocAlert } from "../../mocks/alertStore";

export function AlertEvidence({ alert }: { alert: SocAlert }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-2xs font-semibold uppercase tracking-wider text-text-muted">Evidence</h3>
        <span className="flex items-center gap-1 text-2xs text-text-muted">
          <FlaskConical size={10} aria-hidden="true" /> Synthetic telemetry
        </span>
      </div>
      <dl className="overflow-hidden rounded-lg border border-border">
        {alert.evidence.map((e, i) => (
          <div
            key={e.label}
            className={`flex items-start justify-between gap-4 px-3 py-2 ${
              i % 2 === 0 ? "bg-bg-elevated/50" : ""
            }`}
          >
            <dt className="shrink-0 text-2xs text-text-muted">{e.label}</dt>
            <dd className="mono min-w-0 break-all text-right text-2xs text-text-primary">{e.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
