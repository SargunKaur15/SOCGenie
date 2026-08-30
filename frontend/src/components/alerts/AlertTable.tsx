import { Bell, FilterX } from "lucide-react";
import { SeverityBadge } from "../ui/SeverityBadge";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { STATUS_LABEL, SOURCE_LABEL, type SocAlert, type TriageStatus } from "../../mocks/alertStore";

const STATUS_TONE: Record<TriageStatus, string> = {
  open: "text-accent",
  investigating: "text-status-medium",
  contained: "text-status-success",
  monitoring: "text-status-low",
  resolved: "text-status-success",
  false_positive: "text-text-muted",
};

function riskTone(score: number) {
  if (score >= 75) return "text-status-critical";
  if (score >= 50) return "text-status-high";
  if (score >= 25) return "text-status-medium";
  return "text-status-low";
}

export function AlertTable({
  alerts,
  selectedRef,
  checked,
  onToggleCheck,
  onToggleAll,
  onOpen,
  filtersActive,
  onClearFilters,
}: {
  alerts: SocAlert[];
  selectedRef: string | null;
  checked: string[];
  onToggleCheck: (ref: string) => void;
  onToggleAll: () => void;
  onOpen: (alert: SocAlert) => void;
  filtersActive: boolean;
  onClearFilters: () => void;
}) {
  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={filtersActive ? FilterX : Bell}
        title="No alerts found"
        description={
          filtersActive
            ? "No alerts match the current search and filters."
            : "No alerts have been generated yet."
        }
        action={filtersActive ? <Button onClick={onClearFilters}>Clear filters</Button> : undefined}
      />
    );
  }

  const allChecked = alerts.every((a) => checked.includes(a.ref));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-bg-secondary">
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-text-muted">
            <th scope="col" className="w-10 px-3 py-2.5 pl-4">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={onToggleAll}
                aria-label="Select all alerts"
                className="h-3.5 w-3.5 rounded border-border bg-bg-elevated accent-accent"
              />
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Severity</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Alert ID</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Alert</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Source</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Host</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">MITRE</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Risk</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Detected</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
            <th scope="col" className="px-3 py-2.5 pr-4 font-semibold">Source</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => {
            const isSelected = a.ref === selectedRef;
            return (
              <tr
                key={a.ref}
                onClick={() => onOpen(a)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(a);
                  }
                }}
                className={`cursor-pointer border-b border-border/60 text-[13px] transition-colors ${
                  isSelected ? "bg-accent/[0.07]" : "hover:bg-bg-elevated/60"
                }`}
              >
                <td className="px-3 py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checked.includes(a.ref)}
                    onChange={() => onToggleCheck(a.ref)}
                    aria-label={`Select ${a.ref}`}
                    className="h-3.5 w-3.5 rounded border-border bg-bg-elevated accent-accent"
                  />
                </td>
                <td className="px-3 py-2.5"><SeverityBadge severity={a.severity} /></td>
                <td className="mono px-3 py-2.5 text-2xs text-text-muted">{a.ref}</td>
                <td className="px-3 py-2.5">
                  <span className="font-medium text-text-primary">{a.title}</span>
                  {a.escalatedTo && (
                    <span className="mono ml-2 text-2xs text-accent">→ {a.escalatedTo}</span>
                  )}
                </td>
                <td className="mono px-3 py-2.5 text-2xs text-text-secondary">{a.sourceIp}</td>
                <td className="px-3 py-2.5 text-xs text-text-secondary">{a.host}</td>
                <td className="mono px-3 py-2.5 text-2xs text-accent">{a.techniqueId ?? "—"}</td>
                <td className={`mono px-3 py-2.5 text-right font-semibold tabular ${riskTone(a.riskScore)}`}>
                  {a.riskScore}
                </td>
                <td className="px-3 py-2.5 text-right text-2xs text-text-muted">{a.minutesAgo} min ago</td>
                <td className={`px-3 py-2.5 text-2xs font-medium ${STATUS_TONE[a.status]}`}>
                  {STATUS_LABEL[a.status]}
                </td>
                <td className="px-3 py-2.5 pr-4">
                  <Badge tone={a.detectionSource === "ml" ? "accent" : "neutral"}>
                    {SOURCE_LABEL[a.detectionSource]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
