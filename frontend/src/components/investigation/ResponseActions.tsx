import { useSession, useCurrentAnalystName } from "../../hooks/useSession";
import { assigneeLabel, normaliseAssignee } from "../../lib/data/roster";
import { Search, ShieldOff, CheckCircle2, ShieldAlert, UserCheck, Info, ListChecks, RotateCcw } from "lucide-react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { Select } from "../ui/Input";
import { ANALYSTS } from "../../mocks/investigation";
import type { InvestigationStatus } from "../../mocks/investigationStore";
import type { SocAlert } from "../../mocks/alertStore";

/**
 * Response actions mutate local application state only.
 *
 * "Contained" records an analyst decision — it does not isolate anything. The
 * disclosure below is not decoration: claiming a real endpoint action would be
 * the single most misleading thing this interface could do.
 */
export function ResponseActions({
  alert,
  assignedTo,
  status,
  onSetStatus,
  onEscalate,
  onAssign,
  onReopen,
}: {
  alert: SocAlert;
  /** The ASSIGNEE stored on the record. null when unassigned.
   *  Never the signed-in viewer — that conflation was the root-cause bug. */
  assignedTo: string | null;
  status: InvestigationStatus;
  onSetStatus: (s: InvestigationStatus) => void;
  onEscalate: () => void;
  onAssign: (name: string) => void;
  onReopen: () => void;
}) {
  // Authorisation comes from the AUTHENTICATED session, never from a prop.
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
  /** The assignee is whatever was passed in — never the signed-in viewer. */
  const assignedAnalyst = normaliseAssignee(assignedTo);

  // TEMPORARY DIAGNOSTIC (Phase 21) — remove once confirmed in the browser.
  // Uses the ACTUAL session object; no invented property names.
  console.log("[SOCGenie assignment auth]", {
    session,
    role: session?.role,
    roleLabel: session?.roleLabel,
    canAssign,
    assignedTo: assignedAnalyst,
  });

  return (
    <Panel eyebrow="Response" title="Response Actions">
      <div className="flex flex-wrap gap-2">
        <Button icon={ListChecks} onClick={() => onSetStatus("triaged")} disabled={status === "triaged"}>
          Mark triaged
        </Button>
        <Button icon={Search} onClick={() => onSetStatus("investigating")} disabled={status === "investigating"}>
          Mark investigating
        </Button>
        <Button icon={ShieldOff} onClick={() => onSetStatus("contained")} disabled={status === "contained"}>
          Mark contained
        </Button>
        <Button icon={CheckCircle2} onClick={() => onSetStatus("resolved")} disabled={status === "resolved"}>
          Mark resolved
        </Button>
        <Button icon={RotateCcw} onClick={onReopen} disabled={status !== "resolved"}>
          Reopen
        </Button>
        <Button icon={ShieldAlert} onClick={onEscalate} disabled={Boolean(alert.escalatedTo)}>
          {alert.escalatedTo ? `Escalated · ${alert.escalatedTo}` : "Escalate to incident"}
        </Button>
      </div>

      {/* Phase 19/20: assignment is an ADMIN action.
          For an analyst the <Select> is NOT RENDERED AT ALL — not disabled,
          not CSS-hidden. There is no interactive assignment node in the
          analyst DOM. The server independently returns 403, so this is a
          UX layer over a real boundary, not the boundary itself. */}
      {canAssign ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <label htmlFor="assign" className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-text-muted">
            <UserCheck size={12} aria-hidden="true" /> Assign analyst
          </label>
          <Select id="assign" value={assignedAnalyst ?? ""} onChange={(e) => onAssign(e.target.value)} aria-label="Assign analyst">
            <option value="">Unassigned</option>
            {ANALYSTS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-text-muted">
            <UserCheck size={12} aria-hidden="true" /> Assigned to
          </span>
          <span className="text-2xs text-text-primary">{assigneeLabel(assignedAnalyst, me)}</span>
          <span className="text-2xs text-text-muted">— managed by SOC Admin.</span>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-status-medium/25 bg-status-medium/[0.05] px-3 py-2.5">
        <Info size={13} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
        <p className="text-2xs leading-relaxed text-text-secondary">
          <span className="font-semibold text-text-primary">Simulation only.</span>{" "}
          These actions record an analyst decision in local application state. No endpoint is
          isolated, no account is disabled and no network change is made.
        </p>
      </div>
    </Panel>
  );
}
