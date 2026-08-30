import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Panel } from "../ui/Panel";
import { INITIAL_FEED, nextFeedEvent, type FeedEvent } from "../../mocks/dashboard";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

const TONE: Record<FeedEvent["tone"], string> = {
  critical: "bg-status-critical",
  high: "bg-status-high",
  medium: "bg-status-medium",
  info: "bg-accent",
  success: "bg-status-success",
};

export function LiveSecurityFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(INITIAL_FEED);
  const [paused, setPaused] = useState(false);
  const counter = useRef(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      counter.current += 1;
      setEvents((prev) => [nextFeedEvent(counter.current), ...prev].slice(0, 24));
    }, 6000);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <Panel
      eyebrow="Simulated telemetry"
      title="Live Security Feed"
      className="flex h-full flex-col"
      noPadding
      actions={
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              {!paused && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-60" />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${paused ? "bg-text-muted" : "bg-status-success"}`} />
            </span>
            <span className="text-2xs font-semibold uppercase tracking-wide text-text-muted">
              {paused ? "Paused" : "Live"}
            </span>
          </span>
          <button
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:text-text-primary"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
        </div>
      }
    >
      <ul className="max-h-[300px] flex-1 overflow-y-auto">
        {events.map((e, i) => (
          <li
            key={e.id}
            className={`flex items-start gap-2.5 border-b border-border/60 px-4 py-2 ${
              i === 0 && !reduced ? "animate-fade-in-up" : ""
            }`}
          >
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE[e.tone]}`} aria-hidden="true" />
            <span className="mono shrink-0 text-2xs tabular text-text-muted">[{e.time}]</span>
            <span className="text-2xs text-text-secondary">{e.message}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
