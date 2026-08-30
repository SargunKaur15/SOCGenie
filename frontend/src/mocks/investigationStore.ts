/* ---------------------------------------------------------------------------
   SOCGenie investigation store — SIMULATED DATA, Phase 6.

   This is an OVERLAY, not a second source of truth. Alerts remain owned by
   mocks/alertStore.ts; this module holds only the workflow metadata an
   investigation adds on top of an alert — lifecycle status, assigned analyst
   and audit activity — keyed by alert reference.

   Adding a "triaged" state to the alert TriageStatus union would have forced a
   change to every Record<TriageStatus, ...> across the Alerts and dashboard
   components, which Phase 6 asked me not to disturb. Keeping investigation
   lifecycle separate leaves those files untouched.
--------------------------------------------------------------------------- */
import { alertStore, type SocAlert } from "./alertStore";

/** NEW -> TRIAGED -> INVESTIGATING -> CONTAINED -> RESOLVED */
export type InvestigationStatus = "new" | "triaged" | "investigating" | "contained" | "resolved";

export const INVESTIGATION_STATUS_ORDER: InvestigationStatus[] = [
  "new", "triaged", "investigating", "contained", "resolved",
];

export const INVESTIGATION_STATUS_LABEL: Record<InvestigationStatus, string> = {
  new: "New",
  triaged: "Triaged",
  investigating: "Investigating",
  contained: "Contained",
  resolved: "Resolved",
};

export interface InvestigationActivityEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
}

/** Workflow metadata layered over an alert. */
export interface InvestigationRecord {
  /** Alert reference this investigation is opened against. */
  alertRef: string;
  investigationId: string;
  status: InvestigationStatus;
  assignedTo: string | null;
  openedMinutesAgo: number;
  updatedMinutesAgo: number;
  activity: InvestigationActivityEntry[];
}

/** The list row: the alert plus its investigation overlay. */
export interface InvestigationView extends InvestigationRecord {
  alert: SocAlert;
}

/** Seeds a lifecycle state from the alert's own triage state, so an
 *  investigation never contradicts the alert it was opened from. */
function seedStatus(alert: SocAlert): InvestigationStatus {
  switch (alert.status) {
    case "investigating": return "investigating";
    case "contained": return "contained";
    case "resolved": return "resolved";
    case "false_positive": return "resolved";
    case "monitoring": return "triaged";
    default: return "new";
  }
}

const stamp = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

let records: InvestigationRecord[] = [];
let snapshot = records;
let actSeq = 0;
const listeners = new Set<() => void>();

function emit() {
  snapshot = records;
  listeners.forEach((l) => l());
}

function push(alertRef: string, actor: string, action: string) {
  actSeq += 1;
  const entry: InvestigationActivityEntry = { id: `iv-${actSeq}`, time: stamp(), actor, action };
  records = records.map((r) =>
    r.alertRef === alertRef ? { ...r, activity: [entry, ...r.activity], updatedMinutesAgo: 0 } : r
  );
}

/** Ensures every alert has an investigation record. Idempotent. */
function ensure(alerts: SocAlert[]) {
  let changed = false;
  for (const a of alerts) {
    if (records.some((r) => r.alertRef === a.ref)) continue;
    changed = true;
    records = [
      ...records,
      {
        alertRef: a.ref,
        investigationId: `INV-2026-${a.ref.replace(/\D/g, "")}`,
        status: seedStatus(a),
        assignedTo: a.status === "open" ? null : "A. Sharma",
        openedMinutesAgo: a.minutesAgo,
        updatedMinutesAgo: a.minutesAgo,
        activity: [],
      },
    ];
  }
  if (changed) emit();
}

export const investigationStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): InvestigationRecord[] {
    return snapshot;
  },

  get(alertRef: string): InvestigationRecord | undefined {
    return records.find((r) => r.alertRef === alertRef);
  },

  /** Materialises a record for every known alert. Safe to call repeatedly. */
  sync() {
    ensure(alertStore.getSnapshot());
  },

  setStatus(alertRef: string, status: InvestigationStatus, actor: string) {
    records = records.map((r) => (r.alertRef === alertRef ? { ...r, status } : r));
    push(alertRef, actor, `changed investigation status to ${INVESTIGATION_STATUS_LABEL[status]}`);
    emit();
  },

  assign(alertRef: string, analyst: string, actor: string) {
    records = records.map((r) => (r.alertRef === alertRef ? { ...r, assignedTo: analyst } : r));
    push(alertRef, actor, `assigned the investigation to ${analyst}`);
    emit();
  },

  log(alertRef: string, actor: string, action: string) {
    push(alertRef, actor, action);
    emit();
  },

  /** Ages every record by a minute; no random data. */
  refresh() {
    records = records.map((r) => ({
      ...r,
      openedMinutesAgo: r.openedMinutesAgo + 1,
      updatedMinutesAgo: r.updatedMinutesAgo + 1,
    }));
    emit();
  },
};

export const INVESTIGATION_ANALYSTS = ["A. Sharma", "J. Mehta", "R. Fernandes", "K. Iyer"];
