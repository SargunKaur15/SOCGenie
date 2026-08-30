import { Panel } from "../ui/Panel";
import { SeverityBadge } from "../ui/SeverityBadge";
import type { MitreRow } from "../../mocks/dashboard";

export function MitreTechniques({
  rows,
  onSelect,
}: {
  rows: MitreRow[];
  onSelect: () => void;
}) {
  const max = Math.max(...rows.map((r) => r.count));

  return (
    <Panel
      eyebrow="Adversary behaviour"
      title="Top MITRE ATT&CK Techniques"
      actions={
        <button onClick={onSelect} className="text-2xs font-medium text-accent hover:underline">
          View matrix
        </button>
      }
      className="h-full"
      noPadding
    >
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  <span className="mono text-2xs font-semibold text-accent">{r.id}</span>
                  <span className="truncate text-xs text-text-primary">{r.name}</span>
                </p>
                <p className="mt-0.5 text-2xs text-text-muted">{r.tactic}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <SeverityBadge severity={r.severity} />
                <span className="mono w-6 text-right text-xs font-semibold tabular text-text-primary">
                  {r.count}
                </span>
              </div>
            </div>
            {/* Relative activity bar — proportion of the busiest technique */}
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full bg-accent/70 transition-[width] duration-500"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-2.5 text-2xs text-text-muted">
        Technique IDs follow the published ATT&CK Enterprise matrix. Event counts are simulated.
      </p>
    </Panel>
  );
}
