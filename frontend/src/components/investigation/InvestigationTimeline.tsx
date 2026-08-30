import { useState } from "react";
import { Panel } from "../ui/Panel";
import type { TimelineEvent } from "../../mocks/investigation";

const TONE: Record<string, string> = {
  critical: "bg-status-critical",
  high: "bg-status-high",
  medium: "bg-status-medium",
  low: "bg-status-low",
  info: "bg-accent",
};

export function InvestigationTimeline({ events }: { events: TimelineEvent[] }) {
  const [openId, setOpenId] = useState<string | null>(events[0]?.id ?? null);

  return (
    <Panel eyebrow="Chronology" title="Investigation Timeline" noPadding>
      <ol className="relative px-4 py-3">
        {/* Spine */}
        <span className="absolute left-[26px] top-5 bottom-5 w-px bg-border" aria-hidden="true" />
        {events.map((e) => {
          const open = openId === e.id;
          return (
            <li key={e.id} className="relative pl-8">
              <span
                className={`absolute left-[10px] top-3 h-2.5 w-2.5 rounded-full ring-2 ring-bg-surface ${TONE[e.severity] ?? "bg-accent"}`}
                aria-hidden="true"
              />
              <button
                onClick={() => setOpenId(open ? null : e.id)}
                aria-expanded={open}
                className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-bg-elevated"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="mono text-2xs tabular text-text-muted">{e.time}</span>
                  <span className="mono text-2xs font-semibold text-text-secondary">{e.type}</span>
                </div>
                <p className={`mt-0.5 text-xs ${open ? "text-text-primary" : "text-text-secondary"}`}>
                  {e.description}
                </p>
                {open && (
                  <p className="mt-1.5 text-2xs text-text-muted">
                    Host {e.host} · severity {e.severity}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
