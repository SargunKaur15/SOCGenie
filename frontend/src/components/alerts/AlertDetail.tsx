import { X, Crosshair, MousePointerClick } from "lucide-react";
import { SeverityBadge } from "../ui/SeverityBadge";
import { Badge } from "../ui/Badge";
import { KeyValueList } from "../ui/KeyValueList";
import { EmptyState } from "../ui/EmptyState";
import { AlertEvidence } from "./AlertEvidence";
import { AlertActions } from "./AlertActions";
import { AlertNotes } from "./AlertNotes";
import { mitreTechniques } from "../../lib/data/fixtures";
import { STATUS_LABEL, SOURCE_LABEL, type SocAlert, type TriageStatus } from "../../mocks/alertStore";

function riskBand(score: number) {
  if (score >= 75) return { label: "CRITICAL", tone: "text-status-critical" };
  if (score >= 50) return { label: "HIGH", tone: "text-status-high" };
  if (score >= 25) return { label: "MEDIUM", tone: "text-status-medium" };
  return { label: "LOW", tone: "text-status-low" };
}

/**
 * Master-detail panel, not a modal.
 *
 * The design system reserves modals for confirmations; an investigation has a
 * timeline, evidence and MITRE context that does not fit one. This panel gives
 * fast triage in-context, and "Open investigation" hands off to the full
 * Investigation Workspace rather than duplicating it.
 */
export function AlertDetail({
  alert,
  onClose,
  onSetStatus,
  onEscalate,
  onAddNote,
  onOpenInvestigation,
}: {
  alert: SocAlert | null;
  onClose: () => void;
  onSetStatus: (status: TriageStatus) => void;
  onEscalate: () => void;
  onAddNote: (body: string) => void;
  onOpenInvestigation: () => void;
}) {
  if (!alert) {
    return (
      <div className="hidden h-full items-center justify-center rounded-lg border border-border bg-bg-surface xl:flex">
        <EmptyState
          icon={MousePointerClick}
          title="No alert selected"
          description="Select an alert from the table to review its evidence and triage it."
        />
      </div>
    );
  }

  const band = riskBand(alert.riskScore);
  // Reuses the curated MITRE dataset — no second technique architecture.
  const technique = alert.techniqueId
    ? mitreTechniques.find((t) => t.technique_id === alert.techniqueId)
    : undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-bg-surface shadow-panel">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <span className="mono text-2xs text-text-muted">{alert.ref}</span>
            <Badge tone={alert.detectionSource === "ml" ? "accent" : "neutral"}>
              {SOURCE_LABEL[alert.detectionSource]}
            </Badge>
            <Badge>{STATUS_LABEL[alert.status]}</Badge>
          </div>
          <h2 className="mt-1.5 text-sm font-semibold text-text-primary">{alert.title}</h2>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <div className="text-right">
            <p className="mono text-xl font-semibold tabular text-text-primary">{alert.riskScore}</p>
            <p className={`text-2xs font-semibold ${band.tone}`}>{band.label}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close alert detail"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Overview</h3>
          <KeyValueList
            columns={2}
            items={[
              { label: "Detected", value: `${alert.minutesAgo} min ago` },
              { label: "Status", value: STATUS_LABEL[alert.status] },
              { label: "Source IP", value: alert.sourceIp },
              { label: "Destination", value: alert.destinationIp ?? "—" },
              { label: "Host", value: alert.host },
              { label: "User", value: alert.user ?? "—" },
              { label: "Detection source", value: SOURCE_LABEL[alert.detectionSource] },
              { label: "Incident", value: alert.escalatedTo ?? "Not escalated" },
            ]}
          />
        </section>

        <AlertEvidence alert={alert} />

        <section>
          <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
            MITRE ATT&CK
          </h3>
          {technique ? (
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Crosshair size={13} className="text-accent" aria-hidden="true" />
                <span className="mono text-2xs font-semibold text-accent">{technique.technique_id}</span>
                <span className="text-xs font-medium text-text-primary">{technique.name}</span>
              </div>
              <p className="mt-1 text-2xs text-text-muted">{technique.tactic}</p>
              <p className="mt-2 text-2xs leading-relaxed text-text-secondary">{technique.description}</p>
              <p className="mt-2 border-t border-border pt-2 text-2xs text-text-muted">
                <span className="font-medium text-text-secondary">Mitigation. </span>
                {technique.mitigation}
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-2xs text-text-muted">
              No confident ATT&amp;CK mapping for this detection.
            </p>
          )}
        </section>

        <AlertActions
          alert={alert}
          onSetStatus={onSetStatus}
          onEscalate={onEscalate}
          onOpenInvestigation={onOpenInvestigation}
        />

        <AlertNotes notes={alert.notes} onAdd={onAddNote} />
      </div>
    </div>
  );
}
