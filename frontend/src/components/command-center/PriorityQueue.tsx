import { ArrowUpRight, Inbox } from "lucide-react";
import { SeverityBadge } from "../ui/SeverityBadge";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { DETECTION_SOURCE_LABEL } from "../../lib/constants";
import { relativeTime } from "../../lib/format";
import type { Alert } from "../../lib/types";

export function PriorityQueue({ alerts, onOpen }: { alerts: Alert[]; onOpen: (a: Alert) => void }) {
  const queue = alerts
    .filter((a) => a.status === "new" || a.status === "escalated")
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5);

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nothing requires attention"
        description="No new or escalated alerts in the queue. Detection continues to run."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {queue.map((alert) => (
        <li key={alert.alert_ref} className="flex items-start justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={alert.severity} />
              <span className="mono text-2xs text-text-muted">{alert.alert_ref}</span>
              <Badge tone={alert.ml_available ? "accent" : "neutral"}>
                {DETECTION_SOURCE_LABEL[alert.detection_source]}
              </Badge>
            </div>
            <p className="mt-1.5 truncate text-[13px] font-medium text-text-primary">{alert.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-muted">
              <span>
                Risk <span className="mono font-semibold text-text-secondary">{alert.risk_score}</span>
              </span>
              {alert.host && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-text-secondary">{alert.host}</span>
                </>
              )}
              {alert.mitre_technique_id && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="mono text-text-secondary">{alert.mitre_technique_id}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{relativeTime(alert.created_at)}</span>
            </div>
          </div>
          <button
            onClick={() => onOpen(alert)}
            className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-2xs font-medium text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
          >
            Investigate
            <ArrowUpRight size={12} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
