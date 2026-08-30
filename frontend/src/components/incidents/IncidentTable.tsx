import { ShieldAlert, FilterX } from "lucide-react";
import { SeverityBadge } from "../ui/SeverityBadge";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { INCIDENT_STATUS_LABEL, type SocIncident, type IncidentWorkflowStatus } from "../../mocks/incidentStore";

const STATUS_TONE: Record<IncidentWorkflowStatus, string> = {
  new: "text-accent",
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

export function IncidentTable({
  incidents,
  onOpen,
  filtersActive,
  onClearFilters,
}: {
  incidents: SocIncident[];
  onOpen: (incident: SocIncident) => void;
  filtersActive: boolean;
  onClearFilters: () => void;
}) {
  if (incidents.length === 0) {
    return (
      <EmptyState
        icon={filtersActive ? FilterX : ShieldAlert}
        title="No incidents found"
        description={filtersActive ? "No incidents match the current search and filters." : "No incidents have been created yet."}
        action={filtersActive ? <Button onClick={onClearFilters}>Clear filters</Button> : undefined}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-bg-secondary">
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-text-muted">
            <th scope="col" className="px-4 py-2.5 font-semibold">Severity</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Incident</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Host</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Source</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Assigned</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Created</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">Risk</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr
              key={i.ref}
              onClick={() => onOpen(i)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(i);
                }
              }}
              className="cursor-pointer border-b border-border/60 text-[13px] transition-colors hover:bg-bg-elevated/60"
            >
              <td className="px-4 py-2.5"><SeverityBadge severity={i.severity} /></td>
              <td className="px-3 py-2.5">
                <p className="font-medium text-text-primary">{i.title}</p>
                <p className="mono text-2xs text-text-muted">{i.ref} · {i.alertRefs.length} alerts</p>
              </td>
              <td className="px-3 py-2.5 text-xs text-text-secondary">{i.host}</td>
              <td className="mono px-3 py-2.5 text-2xs text-text-secondary">{i.sourceIp}</td>
              <td className="px-3 py-2.5 text-xs text-text-secondary">
                {i.assignedTo ?? <span className="text-text-muted">Unassigned</span>}
              </td>
              <td className="px-3 py-2.5 text-right text-2xs text-text-muted">{i.minutesAgo} min ago</td>
              <td className={`px-3 py-2.5 text-2xs font-medium ${STATUS_TONE[i.status]}`}>
                {INCIDENT_STATUS_LABEL[i.status]}
              </td>
              <td className={`mono px-4 py-2.5 text-right font-semibold tabular ${riskTone(i.riskScore)}`}>{i.riskScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
