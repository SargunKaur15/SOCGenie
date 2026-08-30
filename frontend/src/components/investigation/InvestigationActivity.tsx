import { Panel } from "../ui/Panel";
import type { ActivityEntry } from "../../mocks/investigation";

export function InvestigationActivity({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Panel eyebrow="Audit log" title="Investigation Activity" noPadding className="flex flex-col">
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
      <p className="border-t border-border px-4 py-2.5 text-2xs text-text-muted">
        Recorded in local application state for this session.
      </p>
    </Panel>
  );
}
