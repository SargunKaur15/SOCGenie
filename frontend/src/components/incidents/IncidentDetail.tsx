import { ArrowLeft, RefreshCw } from "lucide-react";
import { SeverityBadge } from "../ui/SeverityBadge";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { IncidentSummary } from "./IncidentSummary";
import { IncidentStatusWorkflow } from "./IncidentStatusWorkflow";
import { IncidentTimeline } from "./IncidentTimeline";
import { RelatedAlerts } from "./RelatedAlerts";
import { AffectedAssets } from "./AffectedAssets";
import { IncidentResponseActions } from "./IncidentResponseActions";
import { IncidentNotes } from "./IncidentNotes";
import { IncidentActivity } from "./IncidentActivity";
import { CorrelationSummary } from "./CorrelationSummary";
// Shared with the Investigation Workspace — no duplicate implementations.
import { MitreMapping } from "../investigation/MitreMapping";
import { EvidencePanel } from "../investigation/EvidencePanel";
import { INCIDENT_STATUS_LABEL, type SocIncident, type IncidentWorkflowStatus } from "../../mocks/incidentStore";
import type { SocAlert } from "../../mocks/alertStore";

export function IncidentDetail({
  incident,
  relatedAlerts,
  primaryAlert,
  analyst,
  lastUpdatedSec,
  refreshing,
  onBack,
  onRefresh,
  onSetStatus,
  onEscalate,
  onAssign,
  onSimulateIsolation,
  onAddNote,
  onEditNote,
  onOpenAlert,
  onOpenMitre,
}: {
  incident: SocIncident;
  relatedAlerts: SocAlert[];
  primaryAlert: SocAlert | null;
  analyst: string;
  lastUpdatedSec: number;
  refreshing: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSetStatus: (s: IncidentWorkflowStatus) => void;
  onEscalate: () => void;
  onAssign: (a: string) => void;
  onSimulateIsolation: () => void;
  onAddNote: (body: string) => void;
  onEditNote: (id: string, body: string) => void;
  onOpenAlert: (alert: SocAlert) => void;
  onOpenMitre: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-5">
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-2xs font-medium text-text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft size={13} aria-hidden="true" /> Back to Incidents
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-text-primary">{incident.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="mono text-2xs text-text-muted">{incident.ref}</span>
              <SeverityBadge severity={incident.severity} />
              <Badge>{INCIDENT_STATUS_LABEL[incident.status]}</Badge>
              <span className="text-2xs text-text-muted">
                Assigned to{" "}
                <span className="font-medium text-text-secondary">{incident.assignedTo ?? "nobody"}</span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <p className="mono text-xl font-semibold tabular text-text-primary">{incident.riskScore}</p>
              <p className="text-2xs text-text-muted">risk / 100</p>
            </div>
            <span className="hidden text-2xs text-text-muted sm:inline">Updated {lastUpdatedSec}s ago</span>
            <Button onClick={onRefresh} disabled={refreshing}>
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
          <IncidentSummary incident={incident} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <IncidentStatusWorkflow status={incident.status} onChange={onSetStatus} />
              <IncidentTimeline events={incident.timeline} />
              <RelatedAlerts alerts={relatedAlerts} onOpenAlert={onOpenAlert} />
              <AffectedAssets assets={incident.assets} />
              {primaryAlert && <EvidencePanel alert={primaryAlert} />}
              <MitreMapping
                techniqueIds={incident.techniqueIds}
                primaryId={incident.techniqueIds[0] ?? null}
                severity={incident.severity}
                onOpenMatrix={onOpenMitre}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <CorrelationSummary incident={incident} />
              <IncidentResponseActions
                incident={incident}
                onSetStatus={onSetStatus}
                onEscalate={onEscalate}
                onAssign={onAssign}
                onSimulateIsolation={onSimulateIsolation}
              />
              <IncidentNotes
                notes={incident.notes}
                analyst={analyst}
                onAdd={onAddNote}
                onEdit={onEditNote}
              />
              <IncidentActivity entries={incident.activity} />
            </div>
          </div>

          <p className="pb-2 text-center text-2xs text-text-muted">
            Simulated incident data. Status changes, notes, assignment and activity are held in
            local application memory and reset on reload.
          </p>
        </div>
      </div>
    </div>
  );
}
