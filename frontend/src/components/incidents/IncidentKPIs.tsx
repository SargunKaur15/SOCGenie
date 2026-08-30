import { ShieldAlert, Flame, Search, ShieldOff, CheckCircle2, Timer, TrendingUp, TrendingDown } from "lucide-react";
import type { SocIncident } from "../../mocks/incidentStore";

const TONE = {
  critical: { text: "text-status-critical", box: "bg-status-critical/10 border-status-critical/25" },
  high: { text: "text-status-high", box: "bg-status-high/10 border-status-high/25" },
  medium: { text: "text-status-medium", box: "bg-status-medium/10 border-status-medium/25" },
  info: { text: "text-accent", box: "bg-accent/10 border-accent/25" },
  success: { text: "text-status-success", box: "bg-status-success/10 border-status-success/25" },
} as const;

type Tone = keyof typeof TONE;

/** Counts derive from the store, so the cards can never disagree with the table. */
export function IncidentKPIs({ incidents }: { incidents: SocIncident[] }) {
  const open = incidents.filter((i) => i.status !== "resolved").length;
  const critical = incidents.filter((i) => i.severity === "critical" && i.status !== "resolved").length;
  const investigating = incidents.filter((i) => i.status === "investigating").length;
  const contained = incidents.filter((i) => i.status === "contained").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;

  // Mean time from creation to last update across resolved incidents.
  const resolvedSet = incidents.filter((i) => i.status === "resolved");
  const avgMinutes = resolvedSet.length
    ? Math.round(resolvedSet.reduce((s, i) => s + (i.minutesAgo - i.updatedMinutesAgo), 0) / resolvedSet.length)
    : null;

  const cards: { id: string; label: string; value: string; icon: typeof ShieldAlert; tone: Tone; trend: number; riseIsBad: boolean }[] = [
    { id: "open", label: "Open Incidents", value: String(open), icon: ShieldAlert, tone: "info", trend: 12.5, riseIsBad: true },
    { id: "critical", label: "Critical Incidents", value: String(critical), icon: Flame, tone: "critical", trend: 8.3, riseIsBad: true },
    { id: "investigating", label: "Investigating", value: String(investigating), icon: Search, tone: "medium", trend: -6.2, riseIsBad: true },
    { id: "contained", label: "Contained", value: String(contained), icon: ShieldOff, tone: "high", trend: 4.1, riseIsBad: false },
    { id: "resolved", label: "Resolved", value: String(resolved), icon: CheckCircle2, tone: "success", trend: 9.7, riseIsBad: false },
    { id: "mttr", label: "Avg Response Time", value: avgMinutes === null ? "—" : `${avgMinutes}m`, icon: Timer, tone: "info", trend: -3.4, riseIsBad: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        const rising = c.trend >= 0;
        const bad = rising === c.riseIsBad;
        const Trend = rising ? TrendingUp : TrendingDown;
        return (
          <div key={c.id} className="rounded-lg border border-border bg-bg-surface p-4 shadow-panel transition-colors hover:border-accent/30">
            <div className="flex items-start justify-between gap-3">
              <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">{c.label}</p>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${TONE[c.tone].box}`}>
                <Icon size={14} strokeWidth={1.9} className={TONE[c.tone].text} aria-hidden="true" />
              </span>
            </div>
            <p className="mono mt-3 text-2xl font-semibold tabular text-text-primary">{c.value}</p>
            <p className="mt-1.5 flex items-center gap-1 text-2xs">
              <Trend size={12} className={bad ? "text-status-high" : "text-status-success"} aria-hidden="true" />
              <span className={bad ? "text-status-high" : "text-status-success"}>{Math.abs(c.trend).toFixed(1)}%</span>
              <span className="text-text-muted">vs previous period</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
