import { useEffect } from "react";
import { Check, X, ShieldAlert, History, Workflow } from "lucide-react";
import type { SocAlert } from "../../mocks/alertStore";
import { ACTION_STATE_LABEL, type ActionState } from "../../mocks/automationStore";
import { triageAlert } from "../../lib/automation/triage";
import { useAlerts, useAutomation } from "../../hooks/useAlerts";
import { useCurrentAnalystName } from "../../hooks/useSession";
import { Button } from "../ui/Button";

/**
 * Phase 15 automation for one alert.
 *
 * Advisory and additive: triage is deterministic and derived from values
 * already on the alert. Nothing here executes.
 *
 * A high-impact action an analyst approves ends at
 * "APPROVED — NOT EXECUTED (no execution backend)". That is not a placeholder
 * awaiting a better label — SOCGenie has no way to block an address or isolate
 * a host, and reporting success would be a fabrication.
 */
export function AutomationPanel({ alert }: { alert: SocAlert }) {
  const { alerts } = useAlerts();
  const { records, audit, store } = useAutomation();
  const analyst = useCurrentAnalystName();

  const triage = triageAlert(alert, alerts);

  // Registering is idempotent — re-triage never resets an analyst decision.
  useEffect(() => {
    store.register(
      alert.ref,
      triage.playbook.id,
      triage.playbook.version,
      triage.actions.map((a) => ({ id: a.id, kind: a.kind, impact: a.impact })),
      analyst
    );
  }, [alert.ref, triage.playbook.id, triage.playbook.version, triage.actions, analyst, store]);

  const stateOf = (actionId: string): ActionState =>
    records.find((r) => r.alertRef === alert.ref && r.actionId === actionId)?.state ?? "recommended";

  const entries = audit.filter((a) => a.alertRef === alert.ref);

  const tone: Record<ActionState, string> = {
    recommended: "border-border bg-bg-elevated text-text-secondary",
    pending_approval: "border-status-medium/40 bg-status-medium/10 text-status-medium",
    approved_not_executed: "border-status-high/40 bg-status-high/10 text-status-high",
    rejected: "border-border bg-bg-elevated text-text-muted",
    completed: "border-status-success/40 bg-status-success/10 text-status-success",
    queued_no_provider: "border-status-medium/40 bg-status-medium/10 text-status-medium",
  };

  return (
    <section className="border-t border-border px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
        <Workflow size={11} aria-hidden="true" /> Automation
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-baseline gap-2">
          <span className="text-2xs text-text-muted">Priority</span>
          <span className="mono rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-2xs font-semibold text-accent">
            {triage.priority}
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-2xs text-text-muted">Recommendation</span>
          <span className="mono text-2xs font-semibold text-text-primary">{triage.recommendation}</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-2xs text-text-muted">Playbook</span>
          <span className="mono text-2xs text-text-primary">
            {triage.playbook.id}@{triage.playbook.version}
          </span>
        </span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-2xs text-text-muted hover:text-text-secondary">
          Why this triage
        </summary>
        <ul className="mt-1.5 space-y-0.5">
          {triage.explanation.map((line) => (
            <li key={line} className="text-2xs leading-relaxed text-text-secondary">• {line}</li>
          ))}
        </ul>
      </details>

      <p className="mb-1.5 mt-3 text-2xs font-semibold uppercase tracking-wider text-text-muted">
        Recommended actions
      </p>
      <ul className="space-y-1.5">
        {triage.actions.map((action) => {
          const state = stateOf(action.id);
          const decided = state !== "recommended" && state !== "pending_approval";
          return (
            <li key={action.id} className="rounded-md border border-border bg-bg-elevated px-2.5 py-2">
              <div className="flex flex-wrap items-start gap-2">
                {action.impact === "high" && (
                  <ShieldAlert size={12} className="mt-0.5 shrink-0 text-status-high" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 text-2xs font-medium text-text-primary">{action.title}</span>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-2xs font-semibold ${tone[state]}`}>
                  {ACTION_STATE_LABEL[state]}
                </span>
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-text-secondary">{action.rationale}</p>

              {!decided && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Button icon={Check} onClick={() => store.approve(alert.ref, action.id, analyst)}>
                    {action.impact === "high" ? "Approve" : "Mark done"}
                  </Button>
                  <Button icon={X} onClick={() => store.reject(alert.ref, action.id, analyst)}>
                    Reject
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {entries.length > 0 && (
        <details className="mt-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-2xs text-text-muted hover:text-text-secondary">
            <History size={11} aria-hidden="true" /> Audit trail · {entries.length}
          </summary>
          <ul className="mt-1.5 space-y-0.5">
            {entries.map((e) => (
              <li key={e.id} className="mono text-2xs text-text-secondary">
                {new Date(e.at).toLocaleTimeString("en-GB", { hour12: false })} · {e.actor} · {e.actionId} ·{" "}
                {e.event}
                {e.reason ? ` — ${e.reason}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-2 text-2xs leading-relaxed text-text-muted">
        Automation is advisory. SOCGenie has no execution backend, so approving a high-impact action
        records the decision and stops there — it never blocks an address, disables an account or
        isolates a host. Notifications are queued only; no provider is configured.
      </p>
    </section>
  );
}
