/* ---------------------------------------------------------------------------
   SOCGenie incident store — SIMULATED DATA, Phase 5.

   Owns incident workflow state (status, assignment, notes, audit activity) and
   the mutations that change it. Mirrors the alertStore pattern: a plain
   observable subscribed to via useSyncExternalStore, so Phase 6 can swap the
   mutators for API calls without touching a component.

   NAMING — `SocIncident` deliberately sits alongside the existing
   `Incident` in lib/types. That one is the API contract consumed by
   lib/api/incidents.ts; this one is the richer mutable workspace model
   (notes, activity, assets, workflow status). Same convention Phase 3 used
   for SocAlert vs Alert. Neither is a duplicate of the other.
--------------------------------------------------------------------------- */
import type { Severity } from "../lib/types";
import { alertStore, type SocAlert } from "./alertStore";

/** NEW -> INVESTIGATING -> CONTAINED -> RESOLVED */
export type IncidentWorkflowStatus = "new" | "investigating" | "contained" | "resolved";

export const INCIDENT_STATUS_LABEL: Record<IncidentWorkflowStatus, string> = {
  new: "New",
  investigating: "Investigating",
  contained: "Contained",
  resolved: "Resolved",
};

export const INCIDENT_STATUS_ORDER: IncidentWorkflowStatus[] = ["new", "investigating", "contained", "resolved"];

export interface IncidentNote {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface IncidentActivityEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
}

export interface AffectedAsset {
  host: string;
  ip: string;
  user: string | null;
  os: string;
  risk: Severity;
  status: "At Risk" | "Monitored" | "Contained";
}

export interface IncidentTimelineEvent {
  id: string;
  time: string;
  type: string;
  description: string;
  severity: Severity | "info";
  source: string;
}

export interface SocIncident {
  ref: string;
  title: string;
  severity: Severity;
  status: IncidentWorkflowStatus;
  riskScore: number;
  /** Minutes since creation; advanced by refresh(). */
  minutesAgo: number;
  updatedMinutesAgo: number;
  assignedTo: string | null;
  host: string;
  sourceIp: string;
  user: string | null;
  /** Alert refs correlated into this incident. */
  alertRefs: string[];
  techniqueIds: string[];
  assets: AffectedAsset[];
  timeline: IncidentTimelineEvent[];
  notes: IncidentNote[];
  activity: IncidentActivityEntry[];
  eventsCorrelated: number;
  isolationSimulated: boolean;
}

const clock = (minutesAgo: number, offsetSec = 0) =>
  new Date(Date.now() - minutesAgo * 60_000 + offsetSec * 1000)
    .toLocaleTimeString("en-GB", { hour12: false });

const SEED: SocIncident[] = [
  {
    ref: "INC-2026-0042", title: "Potential credential compromise", severity: "critical",
    status: "investigating", riskScore: 84, minutesAgo: 2, updatedMinutesAgo: 1,
    assignedTo: "A. Sharma", host: "WS-042", sourceIp: "10.10.20.14", user: "svc_backup",
    alertRefs: ["ALT-10492", "ALT-10483", "ALT-10479"],
    techniqueIds: ["T1059.001", "T1003", "T1071.001", "T1041"],
    assets: [
      { host: "WS-042", ip: "10.10.20.14", user: "svc_backup", os: "Windows 11", risk: "high", status: "At Risk" },
      { host: "AUTH-GW-02", ip: "10.10.10.5", user: null, os: "Linux", risk: "medium", status: "Monitored" },
    ],
    timeline: [
      { id: "e1", time: clock(2), type: "INCIDENT_CREATED", description: "Incident created from 3 correlated alerts", severity: "critical", source: "Correlation engine" },
      { id: "e2", time: clock(2, -18), type: "PROCESS_CREATE", description: "Encoded PowerShell command executed on WS-042", severity: "critical", source: "WS-042" },
      { id: "e3", time: clock(3), type: "NET_CONNECT", description: "Outbound connection established shortly after execution", severity: "high", source: "WS-042" },
      { id: "e4", time: clock(4), type: "CREDENTIAL_ACCESS", description: "Process handle opened against a credential store", severity: "critical", source: "WS-042" },
      { id: "e5", time: clock(6), type: "AUTH_FAILURE_BURST", description: "Authentication failure threshold exceeded for svc_backup", severity: "high", source: "AUTH-GW-02" },
    ],
    notes: [], activity: [], eventsCorrelated: 18, isolationSimulated: false,
  },
  {
    ref: "INC-2026-0041", title: "Suspicious PowerShell activity", severity: "high",
    status: "new", riskScore: 72, minutesAgo: 15, updatedMinutesAgo: 15,
    assignedTo: "A. Sharma", host: "WS-018", sourceIp: "10.10.20.27", user: null,
    alertRefs: ["ALT-10491"], techniqueIds: ["T1059.001", "T1041"],
    assets: [{ host: "WS-018", ip: "10.10.20.27", user: "analyst01", os: "Windows 11", risk: "medium", status: "Monitored" }],
    timeline: [
      { id: "e1", time: clock(15), type: "INCIDENT_CREATED", description: "Incident created from a correlated alert", severity: "high", source: "Correlation engine" },
      { id: "e2", time: clock(16), type: "EGRESS_SPIKE", description: "Outbound volume exceeded the host rolling baseline", severity: "high", source: "WS-018" },
    ],
    notes: [], activity: [], eventsCorrelated: 6, isolationSimulated: false,
  },
  {
    ref: "INC-2026-0039", title: "Internal port scan", severity: "medium",
    status: "investigating", riskScore: 58, minutesAgo: 32, updatedMinutesAgo: 12,
    assignedTo: null, host: "SRV-021", sourceIp: "10.10.20.31", user: null,
    alertRefs: ["ALT-10488"], techniqueIds: ["T1046", "T1071.001"],
    assets: [{ host: "SRV-021", ip: "10.10.20.31", user: null, os: "Windows Server 2022", risk: "medium", status: "Monitored" }],
    timeline: [
      { id: "e1", time: clock(32), type: "INCIDENT_CREATED", description: "Incident created from scan detection", severity: "medium", source: "Correlation engine" },
      { id: "e2", time: clock(34), type: "PORT_SWEEP", description: "45 distinct ports touched across 12 hosts", severity: "medium", source: "SRV-021" },
    ],
    notes: [], activity: [], eventsCorrelated: 12, isolationSimulated: false,
  },
  {
    ref: "INC-2026-0036", title: "Privilege escalation on APP host", severity: "critical",
    status: "contained", riskScore: 91, minutesAgo: 74, updatedMinutesAgo: 21,
    assignedTo: "J. Mehta", host: "WS-007", sourceIp: "10.10.20.18", user: "svc_deploy",
    alertRefs: ["ALT-10485"], techniqueIds: ["T1068", "T1059.001"],
    assets: [{ host: "WS-007", ip: "10.10.20.18", user: "svc_deploy", os: "Windows 11", risk: "high", status: "Contained" }],
    timeline: [
      { id: "e1", time: clock(74), type: "INCIDENT_CREATED", description: "Incident created from escalation indicator", severity: "critical", source: "Correlation engine" },
      { id: "e2", time: clock(76), type: "PRIV_ASSIGN", description: "Elevated token granted to a service account", severity: "critical", source: "WS-007" },
    ],
    notes: [{ id: "n-seed-1", author: "J. Mehta", body: "Elevation traced to a scheduled task created by a standard user. Host contained pending endpoint review.", createdAt: "09:14" }],
    activity: [], eventsCorrelated: 9, isolationSimulated: true,
  },
  {
    ref: "INC-2026-0031", title: "Spearphishing attachment blocked", severity: "high",
    status: "resolved", riskScore: 63, minutesAgo: 168, updatedMinutesAgo: 96,
    assignedTo: "R. Fernandes", host: "WS-007", sourceIp: "mail-gw-02", user: "r.fernandes",
    alertRefs: ["ALT-10468"], techniqueIds: ["T1566.001", "T1059.001"],
    assets: [{ host: "WS-007", ip: "10.10.20.18", user: "r.fernandes", os: "Windows 11", risk: "low", status: "Contained" }],
    timeline: [
      { id: "e1", time: clock(168), type: "INCIDENT_CREATED", description: "Incident created from mail gateway detection", severity: "high", source: "Correlation engine" },
      { id: "e2", time: clock(170), type: "ATTACHMENT_QUARANTINED", description: "Macro-bearing attachment quarantined before delivery", severity: "medium", source: "mail-gw-02" },
    ],
    notes: [], activity: [], eventsCorrelated: 4, isolationSimulated: false,
  },
  {
    ref: "INC-2026-0028", title: "Beaconing to low-reputation host", severity: "medium",
    status: "resolved", riskScore: 54, minutesAgo: 240, updatedMinutesAgo: 180,
    assignedTo: "K. Iyer", host: "WS-031", sourceIp: "10.10.20.19", user: null,
    alertRefs: ["ALT-10472"], techniqueIds: ["T1071.001"],
    assets: [{ host: "WS-031", ip: "10.10.20.19", user: null, os: "Windows 11", risk: "low", status: "Contained" }],
    timeline: [{ id: "e1", time: clock(240), type: "INCIDENT_CREATED", description: "Incident created from beaconing pattern", severity: "medium", source: "Correlation engine" }],
    notes: [], activity: [], eventsCorrelated: 7, isolationSimulated: false,
  },
];

let incidents: SocIncident[] = SEED.map((i) => ({ ...i, notes: [...i.notes], activity: [...i.activity] }));
let snapshot = incidents;
let noteSeq = 0;
let actSeq = 0;
const listeners = new Set<() => void>();

function emit() {
  snapshot = incidents;
  listeners.forEach((l) => l());
}

function stamp(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function pushActivity(ref: string, actor: string, action: string) {
  actSeq += 1;
  const entry: IncidentActivityEntry = { id: `ia-${actSeq}`, time: stamp(), actor, action };
  incidents = incidents.map((i) =>
    i.ref === ref ? { ...i, activity: [entry, ...i.activity], updatedMinutesAgo: 0 } : i
  );
}

/** Materialises an incident for any alert escalated from the Alerts or
 *  Investigation workspace, so escalation produces a real record rather than
 *  just a reference. Idempotent. */
function materialiseEscalated(alerts: SocAlert[]) {
  let changed = false;
  for (const a of alerts) {
    if (!a.escalatedTo) continue;
    if (incidents.some((i) => i.ref === a.escalatedTo)) continue;
    changed = true;
    incidents = [
      {
        ref: a.escalatedTo,
        title: a.title,
        severity: a.severity,
        status: "investigating",
        riskScore: a.riskScore,
        minutesAgo: a.minutesAgo,
        updatedMinutesAgo: 0,
        assignedTo: "A. Sharma",
        host: a.host,
        sourceIp: a.sourceIp,
        user: a.user,
        alertRefs: [a.ref],
        techniqueIds: a.techniqueId ? [a.techniqueId] : [],
        assets: [{ host: a.host, ip: a.sourceIp, user: a.user, os: "Windows 11", risk: a.severity, status: "At Risk" }],
        timeline: [
          { id: "e1", time: stamp(), type: "INCIDENT_CREATED", description: `Escalated from alert ${a.ref}`, severity: a.severity, source: "Analyst" },
        ],
        notes: [],
        activity: [{ id: `ia-esc-${a.ref}`, time: stamp(), actor: "A. Sharma", action: `escalated ${a.ref} to this incident` }],
        eventsCorrelated: 1,
        isolationSimulated: false,
      },
      ...incidents,
    ];
  }
  if (changed) emit();
}

export const incidentStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): SocIncident[] {
    return snapshot;
  },

  get(ref: string): SocIncident | undefined {
    return incidents.find((i) => i.ref === ref);
  },

  /** Pulls in any alert escalated elsewhere. Safe to call on every render. */
  sync() {
    materialiseEscalated(alertStore.getSnapshot());
  },

  setStatus(ref: string, status: IncidentWorkflowStatus, actor: string) {
    incidents = incidents.map((i) => (i.ref === ref ? { ...i, status } : i));
    pushActivity(ref, actor, `changed status to ${INCIDENT_STATUS_LABEL[status]}`);
    emit();
  },

  assign(ref: string, analyst: string, actor: string) {
    incidents = incidents.map((i) => (i.ref === ref ? { ...i, assignedTo: analyst } : i));
    pushActivity(ref, actor, `assigned the incident to ${analyst}`);
    emit();
  },

  addNote(ref: string, body: string, author: string) {
    noteSeq += 1;
    const note: IncidentNote = {
      id: `in-${noteSeq}`, author, body,
      createdAt: new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" }),
    };
    incidents = incidents.map((i) => (i.ref === ref ? { ...i, notes: [...i.notes, note] } : i));
    pushActivity(ref, author, "added an incident note");
    emit();
  },

  editNote(ref: string, noteId: string, body: string, actor: string) {
    incidents = incidents.map((i) =>
      i.ref === ref ? { ...i, notes: i.notes.map((n) => (n.id === noteId ? { ...n, body } : n)) } : i
    );
    pushActivity(ref, actor, "edited an incident note");
    emit();
  },

  /** Records an analyst decision. No endpoint is touched — see ResponseActions. */
  simulateIsolation(ref: string, actor: string) {
    incidents = incidents.map((i) =>
      i.ref === ref
        ? {
            ...i,
            isolationSimulated: true,
            assets: i.assets.map((a) => ({ ...a, status: "Contained" as const })),
          }
        : i
    );
    pushActivity(ref, actor, "recorded a simulated endpoint isolation (no real action performed)");
    emit();
  },

  logReview(ref: string, actor: string, what: string) {
    pushActivity(ref, actor, what);
    emit();
  },

  /** Ages every incident by a minute; no random data. */
  refresh() {
    incidents = incidents.map((i) => ({
      ...i,
      minutesAgo: i.minutesAgo + 1,
      updatedMinutesAgo: i.updatedMinutesAgo + 1,
    }));
    emit();
  },
};

export const INCIDENT_ANALYSTS = ["A. Sharma", "J. Mehta", "R. Fernandes", "K. Iyer"];
