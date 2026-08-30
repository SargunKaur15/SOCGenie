import type { SocAlert } from "../../mocks/alertStore";

const CARDS = [
  { key: "critical", label: "Critical", tone: "text-status-critical", bg: "bg-status-critical/10 border-status-critical/25" },
  { key: "high", label: "High", tone: "text-status-high", bg: "bg-status-high/10 border-status-high/25" },
  { key: "medium", label: "Medium", tone: "text-status-medium", bg: "bg-status-medium/10 border-status-medium/25" },
  { key: "low", label: "Low", tone: "text-status-low", bg: "bg-status-low/10 border-status-low/25" },
  { key: "open", label: "Open", tone: "text-accent", bg: "bg-accent/10 border-accent/25" },
  { key: "investigating", label: "Investigating", tone: "text-status-medium", bg: "bg-status-medium/10 border-status-medium/25" },
  { key: "resolved", label: "Resolved", tone: "text-status-success", bg: "bg-status-success/10 border-status-success/25" },
] as const;

/** Counts are derived from the store, so they always agree with the table. */
export function AlertSummary({
  alerts,
  activeFilter,
  onSelect,
}: {
  alerts: SocAlert[];
  activeFilter: string | null;
  onSelect: (key: string) => void;
}) {
  const counts: Record<string, number> = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    high: alerts.filter((a) => a.severity === "high").length,
    medium: alerts.filter((a) => a.severity === "medium").length,
    low: alerts.filter((a) => a.severity === "low").length,
    open: alerts.filter((a) => a.status === "open").length,
    investigating: alerts.filter((a) => a.status === "investigating").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  };

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
      {CARDS.map((c) => {
        const active = activeFilter === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onSelect(c.key)}
            aria-pressed={active}
            className={`rounded-lg border bg-bg-surface px-3 py-2.5 text-left transition-colors ${
              active ? c.bg : "border-border hover:border-accent/30"
            }`}
          >
            <p className="text-2xs uppercase tracking-wider text-text-muted">{c.label}</p>
            <p className={`mono mt-1 text-xl font-semibold tabular ${c.tone}`}>{counts[c.key]}</p>
          </button>
        );
      })}
    </div>
  );
}
