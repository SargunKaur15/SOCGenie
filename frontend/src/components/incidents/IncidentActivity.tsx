import { Panel } from "../ui/Panel";
import type { IncidentActivityEntry } from "../../mocks/incidentStore";

export function IncidentActivity({ entries }: { entries: IncidentActivityEntry[] }) {
  return (
    <Panel eyebrow="Audit log" title="Incident Activity" noPadding>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-2xs text-text-muted">
          No analyst actions recorded yet in this session.
        </p>
      ) : (
        <ul className="max-h-[260px] overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 border-b border-border/60 px-4 py-2">
              <span className="mono shrink-0 text-2xs tabular text-text-muted">{e.time}</span>
              <span className="min-w-0 text-2xs text-text-secondary">
                <span className="font-medium text-text-primary">{e.actor}</span> {e.action}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-border px-4 py-2.5 text-2xs text-text-muted">
        Recorded in local application state for this session.
      </p>
    </Panel>
  );
}
