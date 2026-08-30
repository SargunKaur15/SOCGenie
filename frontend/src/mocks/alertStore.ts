/* ---------------------------------------------------------------------------
   SOCGenie alert store — SIMULATED DATA, Phase 3.

   Single source of truth for alerts. Previously alerts were defined twice
   (lib/data/fixtures.ts and mocks/dashboard.ts) with no write path, so triage
   actions had nowhere to persist. This module owns the records and the
   mutations; every consumer reads through it.

   Deliberately framework-agnostic: a plain observable store subscribed to via
   useSyncExternalStore. Phase 4 replaces the mutators with API calls without
   changing a single component.
--------------------------------------------------------------------------- */
import type { Severity } from "../lib/types";

export type TriageStatus = "open" | "investigating" | "contained" | "monitoring" | "resolved" | "false_positive";
export type DetectionSource = "rule" | "ml" | "combined";

export interface AlertNote {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface SocAlert {
  ref: string;
  title: string;
  severity: Severity;
  riskScore: number;
  status: TriageStatus;
  detectionSource: DetectionSource;
  /** Minutes since detection. Advanced by refresh(). */
  minutesAgo: number;
  sourceIp: string;
  destinationIp: string | null;
  host: string;
  user: string | null;
  techniqueId: string | null;
  /** Simulated endpoint telemetry backing the detection. */
  evidence: { label: string; value: string }[];
  notes: AlertNote[];
  escalatedTo: string | null;
}

const ev = (pairs: [string, string][]) => pairs.map(([label, value]) => ({ label, value }));

/** Seed records. All hosts, users, IPs and commands are synthetic. */
const SEED: SocAlert[] = [
  {
    ref: "ALT-10492", title: "Suspicious PowerShell execution", severity: "critical", riskScore: 84,
    status: "investigating", detectionSource: "combined", minutesAgo: 2,
    sourceIp: "10.10.20.14", destinationIp: "45.83.91.12", host: "WS-042", user: "analyst01",
    techniqueId: "T1059.001",
    evidence: ev([
      ["Process", "powershell.exe"],
      ["Parent process", "OUTLOOK.EXE"],
      ["Command line", "powershell -enc [SIMULATED]"],
      ["Integrity level", "Medium"],
      ["Outbound connection", "45.83.91.12:443"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10491", title: "Anomalous outbound transfer", severity: "high", riskScore: 72,
    status: "open", detectionSource: "rule", minutesAgo: 5,
    sourceIp: "10.10.20.27", destinationIp: "45.83.91.12", host: "WS-018", user: null,
    techniqueId: "T1041",
    evidence: ev([
      ["Bytes sent", "94,210,330"],
      ["Host baseline", "1,840,000 (30-day mean)"],
      ["Deviation", "51x baseline"],
      ["Destination", "45.83.91.12:443"],
      ["Duration", "612s"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10488", title: "Port scan across internal subnet", severity: "medium", riskScore: 58,
    status: "monitoring", detectionSource: "ml", minutesAgo: 8,
    sourceIp: "10.10.20.31", destinationIp: null, host: "SRV-021", user: null,
    techniqueId: "T1046",
    evidence: ev([
      ["Distinct ports", "45"],
      ["Hosts touched", "12"],
      ["SYN / ACK ratio", "18.4"],
      ["Window", "180s"],
      ["Classification", "PORT_SCAN"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10485", title: "Privilege escalation indicator", severity: "critical", riskScore: 91,
    status: "open", detectionSource: "rule", minutesAgo: 12,
    sourceIp: "10.10.20.18", destinationIp: null, host: "WS-007", user: "svc_deploy",
    techniqueId: "T1068",
    evidence: ev([
      ["Privilege granted", "SeDebugPrivilege"],
      ["Process", "svchost.exe"],
      ["Session start", "217s before elevation"],
      ["Account type", "Service account"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10483", title: "Possible credential dumping", severity: "critical", riskScore: 88,
    status: "investigating", detectionSource: "combined", minutesAgo: 16,
    sourceIp: "10.10.20.14", destinationIp: null, host: "WS-042", user: "analyst01",
    techniqueId: "T1003",
    evidence: ev([
      ["Process", "rundll32.exe"],
      ["Target", "lsass.exe"],
      ["Access mask", "0x1010 [SIMULATED]"],
      ["Handle duration", "3.2s"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10479", title: "Repeated authentication failures", severity: "high", riskScore: 71,
    status: "open", detectionSource: "rule", minutesAgo: 21,
    sourceIp: "185.220.101.4", destinationIp: "10.10.10.5", host: "AUTH-GW-02", user: "svc_backup",
    techniqueId: "T1110",
    evidence: ev([
      ["Failed attempts", "34"],
      ["Window", "120s"],
      ["Distinct accounts", "1"],
      ["Source reputation", "Tor exit node (confidence 91)"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10476", title: "Scheduled task created by non-admin", severity: "high", riskScore: 66,
    status: "open", detectionSource: "rule", minutesAgo: 28,
    sourceIp: "10.10.20.55", destinationIp: null, host: "SRV-008", user: "j.mehta",
    techniqueId: "T1053.005",
    evidence: ev([
      ["Task name", "UpdateCheck_[SIMULATED]"],
      ["Trigger", "At logon"],
      ["Action", "wscript.exe"],
      ["Creator privilege", "Standard user"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10472", title: "Beaconing to low-reputation host", severity: "medium", riskScore: 54,
    status: "monitoring", detectionSource: "ml", minutesAgo: 37,
    sourceIp: "10.10.20.19", destinationIp: "91.213.8.44", host: "WS-031", user: null,
    techniqueId: "T1071.001",
    evidence: ev([
      ["Connections", "18"],
      ["Interval std / mean", "0.06"],
      ["Bytes per request", "412 (consistent)"],
      ["Window", "30 min"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10468", title: "Spearphishing attachment quarantined", severity: "high", riskScore: 63,
    status: "resolved", detectionSource: "rule", minutesAgo: 52,
    sourceIp: "mail-gw-02", destinationIp: null, host: "WS-007", user: "r.fernandes",
    techniqueId: "T1566.001",
    evidence: ev([
      ["Attachment", "invoice_[SIMULATED].docm"],
      ["Macro present", "Yes"],
      ["Sender reputation", "Unknown"],
      ["Disposition", "Quarantined"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10461", title: "Certificate expiring within 14 days", severity: "low", riskScore: 18,
    status: "open", detectionSource: "rule", minutesAgo: 68,
    sourceIp: "10.10.10.4", destinationIp: null, host: "GW-001", user: null,
    techniqueId: null,
    evidence: ev([
      ["Subject", "gw-001.internal [SIMULATED]"],
      ["Expires in", "13 days"],
      ["Issuer", "Internal CA"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10455", title: "New device joined the domain", severity: "low", riskScore: 22,
    status: "resolved", detectionSource: "rule", minutesAgo: 94,
    sourceIp: "10.10.20.72", destinationIp: null, host: "WS-066", user: "k.iyer",
    techniqueId: null,
    evidence: ev([["Device", "WS-066"], ["Join method", "Domain join"], ["Approved by", "helpdesk"]]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10449", title: "Backup job flagged as high volume", severity: "low", riskScore: 24,
    status: "false_positive", detectionSource: "rule", minutesAgo: 122,
    sourceIp: "10.10.20.30", destinationIp: "10.10.40.2", host: "BACKUP-01", user: "svc_backup",
    techniqueId: "T1041",
    evidence: ev([
      ["Bytes sent", "83,442,110"],
      ["Destination", "Internal backup target"],
      ["Schedule", "Nightly 03:00"],
    ]),
    notes: [
      { id: "N-seed-1", author: "A. Sharma", body: "Confirmed scheduled backup job. Rule R-005 threshold needs an internal-destination exclusion.", createdAt: "03:12" },
    ],
    escalatedTo: null,
  },
];

// ── Observable store ────────────────────────────────────────────────────────
let alerts: SocAlert[] = SEED.map((a) => ({ ...a, evidence: [...a.evidence], notes: [...a.notes] }));
let incidentSeq = 2291;
let noteSeq = 0;
const listeners = new Set<() => void>();

/** Identity changes only when data changes, so useSyncExternalStore is stable. */
let snapshot = alerts;

function emit() {
  snapshot = alerts;
  listeners.forEach((l) => l());
}

export const alertStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): SocAlert[] {
    return snapshot;
  },

  get(ref: string): SocAlert | undefined {
    return alerts.find((a) => a.ref === ref);
  },

  setStatus(refs: string[], status: TriageStatus) {
    alerts = alerts.map((a) => (refs.includes(a.ref) ? { ...a, status } : a));
    emit();
  },

  addNote(ref: string, body: string, author = "Unknown analyst") {
    noteSeq += 1;
    const note: AlertNote = {
      id: `N-${noteSeq}`,
      author,
      body,
      createdAt: new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" }),
    };
    alerts = alerts.map((a) => (a.ref === ref ? { ...a, notes: [...a.notes, note] } : a));
    emit();
  },

  editNote(ref: string, noteId: string, body: string) {
    alerts = alerts.map((a) =>
      a.ref === ref
        ? { ...a, notes: a.notes.map((n) => (n.id === noteId ? { ...n, body } : n)) }
        : a
    );
    emit();
  },

  /**
   * Adds detected alerts produced by the detection engine.
   *
   * Additive: seeded alerts remain, detections are prepended so the newest
   * appear first. Refs already present are skipped, so re-running the same log
   * file does not duplicate findings.
   */
  ingest(incoming: SocAlert[]): number {
    const existing = new Set(alerts.map((a) => a.ref));
    const fresh = incoming.filter((a) => !existing.has(a.ref));
    if (fresh.length === 0) return 0;
    alerts = [...fresh, ...alerts];
    emit();
    return fresh.length;
  },

  /** Escalation creates an incident reference and moves the alert to investigating. */
  escalate(ref: string): string {
    incidentSeq += 1;
    const incidentRef = `INC-${incidentSeq}`;
    alerts = alerts.map((a) =>
      a.ref === ref ? { ...a, escalatedTo: incidentRef, status: "investigating" as TriageStatus } : a
    );
    emit();
    return incidentRef;
  },

  /**
   * Simulated refresh: ages every alert and occasionally surfaces one queued
   * detection. Deliberately conservative — no random severities or scores, so
   * the view never jumps to implausible data.
   */
  refresh() {
    alerts = alerts.map((a) => ({ ...a, minutesAgo: a.minutesAgo + 1 }));
    if (QUEUED.length > 0 && alerts.length < SEED.length + QUEUED_LIMIT) {
      alerts = [{ ...QUEUED.shift()!, minutesAgo: 0 }, ...alerts];
    }
    emit();
  },
};

const QUEUED_LIMIT = 3;

/** Pre-authored detections revealed one at a time by refresh(). */
const QUEUED: SocAlert[] = [
  {
    ref: "ALT-10496", title: "Encoded command executed from browser child", severity: "critical", riskScore: 86,
    status: "open", detectionSource: "combined", minutesAgo: 0,
    sourceIp: "10.10.20.44", destinationIp: "45.83.91.12", host: "WS-052", user: "p.rao",
    techniqueId: "T1059.001",
    evidence: ev([
      ["Process", "powershell.exe"],
      ["Parent process", "chrome.exe"],
      ["Command line", "powershell -nop -enc [SIMULATED]"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10495", title: "Credential stuffing pattern against VPN", severity: "high", riskScore: 74,
    status: "open", detectionSource: "rule", minutesAgo: 0,
    sourceIp: "103.21.244.9", destinationIp: "10.10.10.9", host: "VPN-EDGE-01", user: null,
    techniqueId: "T1110",
    evidence: ev([
      ["Failed attempts", "212"],
      ["Distinct accounts", "47"],
      ["Window", "300s"],
    ]),
    notes: [], escalatedTo: null,
  },
  {
    ref: "ALT-10494", title: "Registry run key modified", severity: "medium", riskScore: 47,
    status: "open", detectionSource: "rule", minutesAgo: 0,
    sourceIp: "10.10.20.61", destinationIp: null, host: "WS-058", user: "s.nair",
    techniqueId: "T1053.005",
    evidence: ev([
      ["Key", "HKCU\\...\\Run [SIMULATED]"],
      ["Value", "updater.exe"],
      ["Modified by", "Standard user"],
    ]),
    notes: [], escalatedTo: null,
  },
];

export const STATUS_LABEL: Record<TriageStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  contained: "Contained",
  monitoring: "Monitoring",
  resolved: "Resolved",
  false_positive: "False positive",
};

export const SOURCE_LABEL: Record<DetectionSource, string> = {
  rule: "Rule",
  ml: "ML",
  combined: "Rule + ML",
};
