import { useState } from "react";
import { Shield, Users, UserPlus, Shuffle, X, AlertCircle, CheckCircle2, Loader2, History } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { SeverityBadge } from "../components/ui/SeverityBadge";
import { useAlerts } from "../hooks/useAlerts";
import { useSession } from "../hooks/useSession";
import { useAssignments, useAnalysts, useAssignmentActions, useAssignmentAudit } from "../hooks/useAssignments";

/**
 * SOC Admin dashboard — Phase 19.
 *
 * Every figure comes from GET /api/assignments and GET /api/analysts. Nothing
 * is hardcoded and no assignment state is held here: after a mutation the
 * queries are invalidated and the table re-reads SERVER state.
 *
 * The role check below is UX ONLY. The real boundary is server-side in
 * assignmentRoutes.ts, which returns 403 to an analyst regardless of what the
 * browser renders.
 */
export function Admin() {
  // Phase 21 ROOT-CAUSE FIX. This previously read:
  //     const { user } = useSession();
  //     const canAssign = session?.role === "admin";
  // useSession() returns SocUser | null DIRECTLY — there is no `.user`
  // property — so `user` was always undefined and canAssign always false.
  // Destructuring also THREW a TypeError when signed out (null).
  // Role lives at session.role.
  const session = useSession();
  const { alerts } = useAlerts();
  const assignmentsQuery = useAssignments();
  const analystsQuery = useAnalysts();
  const actions = useAssignmentActions();
  // Admin-only endpoint; enabled only once the role check has passed.
  const auditQuery = useAssignmentAudit(session?.role === "admin");

  const [newAnalyst, setNewAnalyst] = useState("");

  const isAdmin = session?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader icon={Shield} title="SOC Admin" description="Administrator access required" />
        <div className="flex-1 overflow-y-auto p-6">
          <Panel eyebrow="Access" title="Administrator role required">
            <p className="text-2xs leading-relaxed text-text-secondary">
              Assignment management is restricted to administrators. This restriction is enforced
              on the server: assignment endpoints return HTTP 403 for an analyst token regardless
              of what this interface displays.
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  const assignments = assignmentsQuery.data?.assignments ?? [];
  const workload = assignmentsQuery.data?.workload ?? [];
  const analysts = analystsQuery.data?.analysts ?? [];
  const activeAnalysts = analysts.filter((a) => a.active);

  const assignedFor = (ref: string) => assignments.find((a) => a.alertRef === ref)?.assignedTo ?? null;

  const totals = {
    total: alerts.length,
    assigned: alerts.filter((a) => assignedFor(a.ref) !== null).length,
    unassigned: alerts.filter((a) => assignedFor(a.ref) === null).length,
    investigating: alerts.filter((a) => a.status === "investigating").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  };

  const loading = assignmentsQuery.isLoading || analystsQuery.isLoading;
  const loadError = assignmentsQuery.error || analystsQuery.error;

  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={Shield} title="SOC Admin" description="Analyst roster, workload and alert assignment" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4">

          {/* Feedback band — one place, so every action reports the same way. */}
          {(actions.state.error || actions.state.success || loadError) && (
            <div
              className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-2xs leading-relaxed ${
                actions.state.error || loadError
                  ? "border-status-high/35 bg-status-high/[0.06] text-text-secondary"
                  : "border-status-success/35 bg-status-success/[0.06] text-text-secondary"
              }`}
            >
              {actions.state.error || loadError ? (
                <AlertCircle size={13} className="mt-0.5 shrink-0 text-status-high" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-status-success" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                {actions.state.error ??
                  actions.state.success ??
                  (loadError instanceof Error ? loadError.message : "Could not load assignment data.")}
              </span>
              <button onClick={actions.clear} className="shrink-0 text-text-muted hover:text-text-primary" aria-label="Dismiss">
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          )}

          <Panel eyebrow="Queue" title="Alert distribution">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
              {[
                ["Total alerts", totals.total],
                ["Assigned", totals.assigned],
                ["Unassigned", totals.unassigned],
                ["Investigating", totals.investigating],
                ["Resolved", totals.resolved],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-2xs text-text-muted">{label}</dt>
                  <dd className="mono text-lg font-semibold tabular text-text-primary">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-2xs text-text-muted">
              Assignment counts come from the server. Alert totals come from the current session queue.
            </p>
          </Panel>

          <Panel
            eyebrow="Roster"
            title="Analyst workload"
            actions={<Users size={14} className="text-text-muted" aria-hidden="true" />}
          >
            {loading ? (
              <p className="text-2xs text-text-muted">Loading roster…</p>
            ) : workload.length === 0 ? (
              <p className="text-2xs text-text-muted">No analysts on the roster. Add one below.</p>
            ) : (
              <ul className="space-y-1">
                {workload.map((row) => (
                  <li key={row.analyst.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-elevated">
                    <span className="min-w-0 flex-1 text-2xs text-text-primary">
                      {row.analyst.name}
                      {!row.analyst.active && <span className="ml-2 text-text-muted">(inactive)</span>}
                    </span>
                    <span className="mono w-24 shrink-0 text-right text-2xs tabular text-text-secondary">
                      {row.count} alert{row.count === 1 ? "" : "s"}
                    </span>
                    {row.analyst.active && (
                      <Button icon={X} onClick={() => actions.removeAnalyst(row.analyst.name)} disabled={actions.state.busy}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <input
                value={newAnalyst}
                onChange={(e) => setNewAnalyst(e.target.value)}
                placeholder="New analyst name"
                className="min-w-[180px] flex-1 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-2xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              <Button
                icon={UserPlus}
                onClick={() => { void actions.addAnalyst(newAnalyst).then(() => setNewAnalyst("")); }}
                disabled={actions.state.busy || newAnalyst.trim() === ""}
              >
                Add analyst
              </Button>
            </div>
            <p className="mt-2 text-2xs leading-relaxed text-text-muted">
              Removing an analyst deactivates them and returns their alerts to the unassigned queue.
              No alert is deleted.
            </p>
          </Panel>

          <Panel eyebrow="Assignment" title="Who is handling which alert">
            {actions.state.busy && (
              <p className="mb-2 flex items-center gap-1.5 text-2xs text-text-muted">
                <Loader2 size={11} className="animate-spin" aria-hidden="true" /> Contacting the server…
              </p>
            )}
            {alerts.length === 0 ? (
              <p className="text-2xs text-text-muted">
                No alerts in the queue. Upload a log in Log Explorer to generate some.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-2xs">
                  <thead>
                    <tr className="border-b border-border text-left text-text-muted">
                      <th className="py-1.5 pr-3 font-medium">Alert</th>
                      <th className="py-1.5 pr-3 font-medium">Severity</th>
                      <th className="py-1.5 pr-3 font-medium">Status</th>
                      <th className="py-1.5 pr-3 font-medium">Assigned analyst</th>
                      <th className="py-1.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => {
                      const assigned = assignedFor(alert.ref);
                      return (
                        <tr key={alert.ref} className="border-b border-border/50 align-middle">
                          <td className="py-2 pr-3">
                            <span className="mono text-text-muted">{alert.ref}</span>
                            <span className="ml-2 text-text-primary">{alert.title.slice(0, 40)}</span>
                          </td>
                          <td className="py-2 pr-3"><SeverityBadge severity={alert.severity} /></td>
                          <td className="py-2 pr-3 text-text-secondary">{alert.status}</td>
                          <td className="py-2 pr-3">
                            {assigned === null ? (
                              <span className="text-text-muted">Unassigned</span>
                            ) : (
                              <span className="font-medium text-text-primary">{assigned}</span>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <select
                                value={assigned ?? ""}
                                disabled={actions.state.busy || activeAnalysts.length === 0}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  // Empty option means unassign — the server
                                  // stores null, never "".
                                  if (v === "") void actions.unassign(alert.ref);
                                  else void actions.assign(alert.ref, v);
                                }}
                                className="rounded-md border border-border bg-bg-elevated px-2 py-1 text-2xs text-text-primary focus:border-accent focus:outline-none disabled:opacity-50"
                                aria-label={`Assign ${alert.ref}`}
                              >
                                <option value="">Unassigned</option>
                                {activeAnalysts.map((a) => (
                                  <option key={a.id} value={a.name}>{a.name}</option>
                                ))}
                              </select>
                              <Button
                                icon={Shuffle}
                                onClick={() => void actions.roundRobin(alert.ref)}
                                disabled={actions.state.busy}
                              >
                                Round-robin
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-2xs leading-relaxed text-text-muted">
              Assignment is authorised on the server. This interface hides controls from analysts
              for clarity only — the assignment endpoints reject a non-admin token with HTTP 403.
            </p>
          </Panel>

          {/* §12 — the SERVER's audit trail. No frontend-only log exists;
              this reads GET /api/assignments/audit, which is admin-gated. */}
          <Panel
            eyebrow="Accountability"
            title="Assignment audit trail"
            actions={<History size={14} className="text-text-muted" aria-hidden="true" />}
          >
            {auditQuery.isLoading ? (
              <p className="text-2xs text-text-muted">Loading audit trail…</p>
            ) : auditQuery.error ? (
              <p className="text-2xs text-text-secondary">
                Could not load the audit trail. Assignment still works; only this view is affected.
              </p>
            ) : (auditQuery.data?.audit.length ?? 0) === 0 ? (
              <p className="text-2xs text-text-muted">
                No assignment activity yet. Assign an alert and it will be recorded here.
              </p>
            ) : (
              <ul className="space-y-1">
                {auditQuery.data!.audit.slice(0, 25).map((e) => {
                  const when = new Date(e.at).toLocaleTimeString("en-GB", { hour12: false });
                  const detail =
                    e.action === "reassigned"
                      ? `reassigned ${e.alertRef} from ${e.previousAnalyst} to ${e.newAnalyst}`
                      : e.action === "assigned" || e.action === "round_robin_assigned"
                        ? `${e.action === "round_robin_assigned" ? "round-robin assigned" : "assigned"} ${e.alertRef} to ${e.newAnalyst}`
                        : e.action === "unassigned"
                          ? `unassigned ${e.alertRef} from ${e.previousAnalyst}`
                          : e.action === "analyst_added"
                            ? `added analyst ${e.newAnalyst}`
                            : e.action === "analyst_removed"
                              ? `removed analyst ${e.previousAnalyst}`
                              : e.action;
                  return (
                    <li key={e.id} className="flex flex-wrap items-baseline gap-2 rounded-md px-2 py-1 hover:bg-bg-elevated">
                      <span className="mono shrink-0 text-2xs text-text-muted">{when}</span>
                      <span className="text-2xs text-text-primary">
                        <span className="font-medium">{e.actor}</span> {detail}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-2xs leading-relaxed text-text-muted">
              Recorded server-side on successful, authorised operations only. A rejected analyst
              request writes no audit entry.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
