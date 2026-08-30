/* ---------------------------------------------------------------------------
   Automation approval state and audit trail — Phase 15.

   Same observable-store convention as alertStore / incidentStore, so React
   subscribes via useSyncExternalStore.

   THE CENTRAL HONESTY PROPERTY: there is no execution backend. A high-impact
   action that an analyst approves terminates at APPROVED_NOT_EXECUTED. This
   store cannot produce an "executed" state for one, because no code path sets
   it. That is enforced structurally, not by convention.

   Notifications terminate at QUEUED_NO_PROVIDER for the same reason: no email,
   Slack or SMS integration exists, so none is claimed.
--------------------------------------------------------------------------- */
import type { ActionImpact, ActionKind } from "../lib/automation/playbooks";

export type ActionState =
  | "recommended"
  | "pending_approval"
  | "approved_not_executed"
  | "rejected"
  | "completed"
  | "queued_no_provider";

export const ACTION_STATE_LABEL: Record<ActionState, string> = {
  recommended: "Recommended",
  pending_approval: "Pending approval",
  approved_not_executed: "APPROVED — NOT EXECUTED (no execution backend)",
  rejected: "Rejected",
  completed: "Completed by analyst",
  queued_no_provider: "QUEUED — provider not configured",
};

export interface AuditEntry {
  id: string;
  alertRef: string;
  actionId: string;
  actor: string;
  at: string;
  event: string;
  reason: string | null;
}

export interface ActionRecord {
  alertRef: string;
  actionId: string;
  playbookId: string;
  playbookVersion: string;
  kind: ActionKind;
  impact: ActionImpact;
  state: ActionState;
  decidedBy: string | null;
  decidedAt: string | null;
  reason: string | null;
}

const key = (alertRef: string, actionId: string) => `${alertRef}::${actionId}`;

let records = new Map<string, ActionRecord>();
let audit: AuditEntry[] = [];
let snapshotRecords: ActionRecord[] = [];
let snapshotAudit: AuditEntry[] = [];
let seq = 0;

const listeners = new Set<() => void>();
function emit() {
  snapshotRecords = [...records.values()];
  snapshotAudit = [...audit];
  listeners.forEach((l) => l());
}

function log(alertRef: string, actionId: string, actor: string, event: string, reason: string | null) {
  seq += 1;
  audit = [
    { id: `AUD-${seq}`, alertRef, actionId, actor, at: new Date().toISOString(), event, reason },
    ...audit,
  ];
}

export const automationStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): ActionRecord[] {
    return snapshotRecords;
  },

  getAuditSnapshot(): AuditEntry[] {
    return snapshotAudit;
  },

  get(alertRef: string, actionId: string): ActionRecord | undefined {
    return records.get(key(alertRef, actionId));
  },

  forAlert(alertRef: string): ActionRecord[] {
    return [...records.values()].filter((r) => r.alertRef === alertRef);
  },

  auditFor(alertRef: string): AuditEntry[] {
    return snapshotAudit.filter((a) => a.alertRef === alertRef);
  },

  /**
   * Registers playbook actions for an alert. Idempotent: re-triaging never
   * resets a decision an analyst already made.
   */
  register(
    alertRef: string,
    playbookId: string,
    playbookVersion: string,
    actions: { id: string; kind: ActionKind; impact: ActionImpact }[],
    actor: string
  ): number {
    let added = 0;
    for (const a of actions) {
      const k = key(alertRef, a.id);
      if (records.has(k)) continue;
      records.set(k, {
        alertRef, actionId: a.id, playbookId, playbookVersion,
        kind: a.kind, impact: a.impact,
        // High-impact actions start gated. Low-impact ones are advisory.
        state: a.impact === "high" ? "pending_approval" : "recommended",
        decidedBy: null, decidedAt: null, reason: null,
      });
      log(alertRef, a.id, actor, `registered from playbook ${playbookId}@${playbookVersion}`, null);
      added += 1;
    }
    if (added > 0) emit();
    return added;
  },

  /**
   * Approves an action.
   *
   * A high-impact action becomes APPROVED_NOT_EXECUTED — never "executed".
   * There is no backend that can block an address or isolate a host, and
   * reporting success would be a fabrication.
   */
  approve(alertRef: string, actionId: string, actor: string, reason: string | null = null): ActionRecord | null {
    const record = records.get(key(alertRef, actionId));
    if (!record) return null;
    if (record.state === "approved_not_executed" || record.state === "rejected") return record;

    const next: ActionState =
      record.kind === "notify"
        ? "queued_no_provider"
        : record.impact === "high"
          ? "approved_not_executed"
          : "completed";

    const updated: ActionRecord = {
      ...record, state: next, decidedBy: actor, decidedAt: new Date().toISOString(), reason,
    };
    records.set(key(alertRef, actionId), updated);
    log(alertRef, actionId, actor, `approved -> ${ACTION_STATE_LABEL[next]}`, reason);
    emit();
    return updated;
  },

  reject(alertRef: string, actionId: string, actor: string, reason: string | null = null): ActionRecord | null {
    const record = records.get(key(alertRef, actionId));
    if (!record) return null;
    if (record.state === "rejected") return record;

    const updated: ActionRecord = {
      ...record, state: "rejected", decidedBy: actor, decidedAt: new Date().toISOString(), reason,
    };
    records.set(key(alertRef, actionId), updated);
    log(alertRef, actionId, actor, "rejected", reason);
    emit();
    return updated;
  },

  /** Test/diagnostic only. */
  reset() {
    records = new Map();
    audit = [];
    seq = 0;
    emit();
  },
};

/**
 * There is no execute() on this store, deliberately.
 *
 * Adding one would require an execution backend. Until that exists, an
 * "executed" state is unreachable by construction rather than by policy.
 */
export const EXECUTION_BACKEND_AVAILABLE = false as const;
