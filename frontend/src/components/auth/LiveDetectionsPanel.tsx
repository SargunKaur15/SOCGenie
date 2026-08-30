import { useMemo } from "react";
import { AlertCircle, KeyRound, Radar, Share2, Terminal, UserCog } from "lucide-react";
import { useAlerts } from "../../hooks/useAlerts";
import { useMitre } from "../../hooks/queries";
import { SeverityBadge } from "../ui/SeverityBadge";

/**
 * Live Detections — the four most recent real alerts from the same store the
 * authenticated Alerts workspace and Command Center read from. Nothing here
 * is invented for the login screen: severity, technique ID and elapsed time
 * are the alert's real fields.
 */

const TACTIC_ICON: Record<string, typeof AlertCircle> = {
  "Credential Access": KeyRound,
  Execution: Terminal,
  "Initial Access": UserCog,
  Persistence: UserCog,
  "Privilege Escalation": UserCog,
  "Lateral Movement": Radar,
  Discovery: Radar,
  "Command and Control": Share2,
  Exfiltration: Share2,
};

function agoLabel(minutesAgo: number): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  return `${Math.floor(minutesAgo / 60)}h ago`;
}

export function LiveDetectionsPanel() {
  const { alerts } = useAlerts();
  const { data: techniques } = useMitre();

  const tacticFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of techniques ?? []) map.set(t.technique_id, t.tactic);
    return map;
  }, [techniques]);

  const recent = useMemo(
    () => [...alerts].sort((a, b) => a.minutesAgo - b.minutesAgo).slice(0, 4),
    [alerts]
  );

  return (
    <div className="rounded-xl border border-border bg-bg-surface/60 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <h2 className="text-2xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Live detections
          </h2>
        </div>
        <span className="text-2xs font-medium text-accent">View all</span>
      </div>

      <ul className="flex flex-col gap-1">
        {recent.map((a) => {
          const tactic = a.techniqueId ? tacticFor.get(a.techniqueId) : undefined;
          const Icon = (tactic && TACTIC_ICON[tactic]) || AlertCircle;
          return (
            <li
              key={a.ref}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-bg-elevated/60"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                  a.severity === "critical"
                    ? "border-status-critical/30 bg-status-critical/10 text-status-critical"
                    : a.severity === "high"
                      ? "border-status-high/30 bg-status-high/10 text-status-high"
                      : a.severity === "medium"
                        ? "border-status-medium/30 bg-status-medium/10 text-status-medium"
                        : "border-status-low/30 bg-status-low/10 text-status-low"
                }`}
              >
                <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-text-primary">{a.title}</p>
                <p className="mono truncate text-2xs text-text-muted">
                  {a.techniqueId ?? "—"}
                  {tactic && <span> · {tactic}</span>}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <SeverityBadge severity={a.severity} />
                <span className="text-2xs text-text-muted">{agoLabel(a.minutesAgo)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
