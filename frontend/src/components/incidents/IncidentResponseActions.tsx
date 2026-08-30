import { Search, ShieldOff, CheckCircle2, ArrowUpCircle, UserCheck, Info, Laptop } from "lucide-react";
import { useSession, useCurrentAnalystName } from "../../hooks/useSession";
import { assigneeLabel } from "../../lib/data/roster";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { Select } from "../ui/Input";
import { INCIDENT_ANALYSTS, type SocIncident, type IncidentWorkflowStatus } from "../../mocks/incidentStore";

/**
 * Response actions mutate local application state only.
 *
 * "Isolate endpoint" records an analyst decision and marks the assets as
 * contained in the UI. Nothing is isolated. The notice below is not decoration:
 * claiming a real containment action would be the most misleading thing this
 * interface could do.
 */
export function IncidentResponseActions({
  incident,
  onSetStatus,
  onEscalate,
  onAssign,
  onSimulateIsolation,
}: {
  incident: SocIncident;
  onSetStatus: (s: IncidentWorkflowStatus) => void;
  onEscalate: () => void;
  onAssign: (analyst: string) => void;
  onSimulateIsolation: () => void;
}) {
  // Phase 19: assignment is an ADMIN action. Analysts previously saw this
  // control and could reassign any incident. Hiding it is UX only — the
  // server returns 403 to a non-admin token regardless.
  // Phase 21 ROOT-CAUSE FIX. This previously read:
  //     const { user } = useSession();
  //     const canAssign = user?.role === "admin";
  // useSession() returns SocUser | null DIRECTLY — there is no `.user`
  // property — so `user` was always undefined and canAssign always false.
  // Destructuring also THREW a TypeError when signed out (null).
  // Role lives at session.role.
  const session = useSession();
  const canAssign = session?.role === "admin";
  const me = useCurrentAnalystName();
  return (
    <Panel eyebrow="Response" title="Response Actions">
      <div className="flex flex-wrap gap-2">
        <Button icon={Search} onClick={() => onSetStatus("investigating")} disabled={incident.status === "investigating"}>
          Mark investigating
        </Button>
        <Button icon={ShieldOff} onClick={() => onSetStatus("contained")} disabled={incident.status === "contained"}>
          Mark contained
        </Button>
        <Button icon={CheckCircle2} onClick={() => onSetStatus("resolved")} disabled={incident.status === "resolved"}>
          Resolve incident
        </Button>
        <Button icon={ArrowUpCircle} onClick={onEscalate} disabled={incident.severity === "critical"}>
          {incident.severity === "critical" ? "Already critical" : "Escalate severity"}
        </Button>
      </div>

      {canAssign ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <label htmlFor="inc-assign" className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-text-muted">
            <UserCheck size={12} aria-hidden="true" /> Assign analyst
          </label>
          <Select
            id="inc-assign"
            value={incident.assignedTo ?? ""}
            onChange={(e) => onAssign(e.target.value)}
            aria-label="Assign analyst"
          >
            <option value="">Unassigned</option>
            {INCIDENT_ANALYSTS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-text-muted">
            <UserCheck size={12} aria-hidden="true" /> Assigned analyst
          </span>
          <span className="text-2xs text-text-primary">{assigneeLabel(incident.assignedTo, me)}</span>
          <span className="text-2xs text-text-muted">— managed by SOC Admin.</span>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-status-medium/30 bg-status-medium/[0.05] p-3">
        <div className="flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-wider text-status-medium">Simulation only</p>
            <p className="mt-1 text-2xs leading-relaxed text-text-secondary">
              The action below records an analyst decision in local application state. No endpoint
              is isolated, no account is disabled and no network change is made.
            </p>
            <Button
              icon={Laptop}
              onClick={onSimulateIsolation}
              disabled={incident.isolationSimulated}
              className="mt-2.5"
            >
              {incident.isolationSimulated ? "Isolation recorded (simulated)" : "Isolate endpoint (simulated)"}
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
