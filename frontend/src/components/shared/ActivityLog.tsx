import { Panel } from "../ui/Panel";

interface BaseEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
}

/**
 * Shared audit-log list for incidents and investigations (Phase C
 * consolidation). The investigation version previously had no empty-state
 * message (the incident version did) — folding both into one component
 * fixes that inconsistency rather than picking one behavior arbitrarily.
 */
export function ActivityLog<TEntry extends BaseEntry>({
  eyebrow = "Audit log",
  title,
  entries,
  emptyMessage,
}: {
  eyebrow?: string;
  title: string;
  entries: TEntry[];
  emptyMessage: string;
}) {
  return (
    <Panel eyebrow={eyebrow} title={title} noPadding className="flex flex-col">
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-2xs text-text-muted">{emptyMessage}</p>
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
