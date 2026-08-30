import { useMemo, useState } from "react";
import { Pause, Play, Search } from "lucide-react";
import { Input } from "../ui/Input";
import { sanitizeLogLine } from "../ui/CodeBlock";
import { formatTime } from "../../lib/format";
import type { EventOut } from "../../lib/types";

const OUTCOME_DOT: Record<string, string> = {
  failure: "bg-status-medium",
  success: "bg-status-success",
  reset: "bg-status-high",
};

/**
 * Phase 1 renders the current event set with filter and pause controls.
 * Phase 3 connects real ingestion; polling replaces the static list.
 */
export function LiveEventStream({ events }: { events: EventOut[] }) {
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => events.filter((e) => e.raw_line.toLowerCase().includes(query.toLowerCase())),
    [events, query]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="flex-1">
          <Input
            icon={Search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter events…"
            aria-label="Filter events"
          />
        </div>
        <button
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 text-2xs font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-2xs text-text-muted">
            {query ? "No events match this filter." : "No events ingested yet."}
          </p>
        ) : (
          <ul>
            {filtered.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2 text-2xs hover:bg-bg-elevated/50"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${OUTCOME_DOT[event.outcome ?? ""] ?? "bg-accent"}`}
                  aria-hidden="true"
                />
                <span className="mono shrink-0 tabular text-text-muted">{formatTime(event.timestamp)}</span>
                <span className="mono shrink-0 font-medium text-text-secondary">{event.action}</span>
                <span className="mono truncate text-text-muted">{sanitizeLogLine(event.raw_line)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {paused && (
        <div className="shrink-0 border-t border-border bg-bg-elevated px-4 py-1.5 text-2xs text-text-muted">
          Stream paused — new events are not being displayed.
        </div>
      )}
    </div>
  );
}
