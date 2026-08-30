import { Search, FilterX } from "lucide-react";
import { SeverityBadge } from "../ui/SeverityBadge";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import {
  INVESTIGATION_STATUS_LABEL,
  type InvestigationStatus,
  type InvestigationView,
} from "../../mocks/investigationStore";

const STATUS_TONE: Record<InvestigationStatus, string> = {
  new: "text-accent",
  triaged: "text-status-low",
  investigating: "text-status-medium",
  contained: "text-status-high",
  resolved: "text-status-success",
};

function riskTone(score: number) {
  if (score >= 75) return "text-status-critical";
  if (score >= 50) return "text-status-high";
  if (score >= 25) return "text-status-medium";
  return "text-status-low";
}

export function InvestigationList({
  investigations,
  onOpen,
  filtersActive,
  onClearFilters,
}: {
  investigations: InvestigationView[];
  onOpen: (view: InvestigationView) => void;
  filtersActive: boolean;
  onClearFilters: () => void;
}) {
  if (investigations.length === 0) {
    return (
      <EmptyState
        icon={filtersActive ? FilterX : Search}
        title="No investigations found"
        description={
          filtersActive
            ? "No investigations match the current search and filters."
            : "Investigations are created from alerts. Open an alert to begin one."
        }
        action={filtersActive ? <Button onClick={onClearFilters}>Clear filters</Button> : undefined}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-bg-secondary">
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-text-muted">
            <th scope="col" className="px-4 py-2.5 font-semibold">Severity</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Investigation</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Alert</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Host</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Assigned</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Opened</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Updated</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">Risk</th>
          </tr>
        </thead>
        <tbody>
          {investigations.map((v) => (
            <tr
              key={v.alertRef}
              onClick={() => onOpen(v)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(v);
                }
              }}
              className="cursor-pointer border-b border-border/60 text-[13px] transition-colors hover:bg-bg-elevated/60"
            >
              <td className="px-4 py-2.5"><SeverityBadge severity={v.alert.severity} /></td>
              <td className="px-3 py-2.5">
                <p className="font-medium text-text-primary">{v.alert.title}</p>
                <p className="mono text-2xs text-text-muted">{v.investigationId}</p>
              </td>
              <td className="mono px-3 py-2.5 text-2xs text-text-secondary">
                {v.alertRef}
                {v.alert.techniqueId && <span className="ml-2 text-accent">{v.alert.techniqueId}</span>}
              </td>
              <td className="px-3 py-2.5 text-xs text-text-secondary">{v.alert.host}</td>
              <td className="px-3 py-2.5 text-xs text-text-secondary">
                {v.assignedTo ?? <span className="text-text-muted">Unassigned</span>}
              </td>
              <td className="px-3 py-2.5 text-right text-2xs text-text-muted">{v.openedMinutesAgo} min ago</td>
              <td className="px-3 py-2.5 text-right text-2xs text-text-muted">{v.updatedMinutesAgo} min ago</td>
              <td className={`px-3 py-2.5 text-2xs font-medium ${STATUS_TONE[v.status]}`}>
                {INVESTIGATION_STATUS_LABEL[v.status]}
              </td>
              <td className={`mono px-4 py-2.5 text-right font-semibold tabular ${riskTone(v.alert.riskScore)}`}>
                {v.alert.riskScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
