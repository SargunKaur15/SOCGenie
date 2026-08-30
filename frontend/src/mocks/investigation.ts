/* ---------------------------------------------------------------------------
   Investigation workspace telemetry — SIMULATED, Phase 4.

   Timeline, network flows and audit entries are derived per-alert from the
   alert store so the workspace always agrees with the alert it opened from.
   Nothing here is measured; no real host, user or endpoint is referenced.
--------------------------------------------------------------------------- */
import type { SocAlert } from "./alertStore";
import type { Severity } from "../lib/types";

export type EvidenceTab = "process" | "network" | "authentication" | "files" | "commands";

export const EVIDENCE_TABS: { key: EvidenceTab; label: string }[] = [
  { key: "process", label: "Process" },
  { key: "network", label: "Network" },
  { key: "authentication", label: "Authentication" },
  { key: "files", label: "Files" },
  { key: "commands", label: "Commands" },
];

export interface TimelineEvent {
  id: string;
  time: string;
  type: string;
  description: string;
  severity: Severity | "info";
  host: string;
}

export interface NetworkFlow {
  id: string;
  time: string;
  source: string;
  destination: string;
  port: number;
  protocol: string;
  bytes: string;
  status: "Suspicious" | "Observed" | "Blocked";
}

export interface RiskFactor {
  label: string;
  weight: number;
  present: boolean;
}

export interface ActivityEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
}

/** Clock helper: renders a wall-clock time N minutes before now. */
function at(minutesAgo: number, offsetSec = 0): string {
  return new Date(Date.now() - minutesAgo * 60_000 + offsetSec * 1000)
    .toLocaleTimeString("en-GB", { hour12: false });
}

/** Timeline is built backwards from the alert's detection moment. */
export function buildTimeline(alert: SocAlert): TimelineEvent[] {
  const h = alert.host;
  const base: TimelineEvent[] = [
    { id: "t1", time: at(alert.minutesAgo, 0), type: "DETECTION_RAISED", description: `${alert.title} — alert ${alert.ref} created`, severity: alert.severity, host: h },
    { id: "t2", time: at(alert.minutesAgo, -4), type: "RULE_MATCHED", description: "Detection rule condition satisfied on host telemetry", severity: "high", host: h },
    { id: "t3", time: at(alert.minutesAgo, -22), type: "CORRELATION_OPENED", description: "Correlation window opened for related activity", severity: "info", host: h },
  ];

  const technique = alert.techniqueId ?? "";
  if (technique.startsWith("T1059")) {
    base.push(
      { id: "t4", time: at(alert.minutesAgo, -34), type: "PROCESS_CREATE", description: "powershell.exe created with an encoded command argument", severity: "critical", host: h },
      { id: "t5", time: at(alert.minutesAgo, -40), type: "PARENT_ANOMALY", description: "Unusual parent process observed spawning a shell", severity: "high", host: h },
      { id: "t6", time: at(alert.minutesAgo, -58), type: "NET_CONNECT", description: "Outbound connection established shortly after execution", severity: "medium", host: h }
    );
  } else if (technique.startsWith("T1110") || technique.startsWith("T1078")) {
    base.push(
      { id: "t4", time: at(alert.minutesAgo, -30), type: "AUTH_SUCCESS", description: "Successful authentication following a failure burst", severity: "critical", host: h },
      { id: "t5", time: at(alert.minutesAgo, -48), type: "AUTH_FAILURE_BURST", description: "Repeated authentication failures against a single account", severity: "high", host: h },
      { id: "t6", time: at(alert.minutesAgo, -75), type: "SOURCE_FLAGGED", description: "Source address matched a threat indicator", severity: "medium", host: h }
    );
  } else if (technique.startsWith("T1041") || technique.startsWith("T1071")) {
    base.push(
      { id: "t4", time: at(alert.minutesAgo, -28), type: "EGRESS_SPIKE", description: "Outbound volume exceeded the host rolling baseline", severity: "high", host: h },
      { id: "t5", time: at(alert.minutesAgo, -52), type: "SESSION_OPENED", description: "Long-lived session opened to an external destination", severity: "medium", host: h },
      { id: "t6", time: at(alert.minutesAgo, -70), type: "DNS_RESOLVED", description: "Destination resolved via an unusual DNS path", severity: "info", host: h }
    );
  } else {
    base.push(
      { id: "t4", time: at(alert.minutesAgo, -30), type: "HOST_ACTIVITY", description: "Host activity deviated from its established baseline", severity: "medium", host: h },
      { id: "t5", time: at(alert.minutesAgo, -55), type: "SESSION_OPENED", description: "New session established on the affected host", severity: "info", host: h }
    );
  }
  return base;
}

/** Risk factors mirror the six-factor risk model; presence is derived from the
 *  alert itself so the panel never contradicts the score it displays. */
export function buildRiskFactors(alert: SocAlert): RiskFactor[] {
  const t = alert.techniqueId ?? "";
  return [
    { label: "Deterministic rule matched", weight: 25, present: alert.detectionSource !== "ml" },
    { label: "ML classification available", weight: 25, present: alert.detectionSource !== "rule" },
    { label: "Behaviour deviates from host baseline", weight: 20, present: alert.riskScore >= 50 },
    { label: "Correlated with related activity", weight: 12, present: Boolean(alert.escalatedTo) || alert.riskScore >= 70 },
    { label: "Affected asset carries elevated criticality", weight: 10, present: alert.host.startsWith("SRV") || alert.host.startsWith("AUTH") },
    { label: "Source matched a threat indicator", weight: 8, present: t === "T1110" || alert.sourceIp.startsWith("185.") || alert.sourceIp.startsWith("103.") },
  ];
}

export function buildNetworkFlows(alert: SocAlert): NetworkFlow[] {
  const flows: NetworkFlow[] = [
    { id: "n1", time: at(alert.minutesAgo, -10), source: alert.sourceIp, destination: alert.destinationIp ?? "10.10.10.5", port: alert.destinationIp ? 443 : 445, protocol: alert.destinationIp ? "HTTPS" : "TCP", bytes: "18,422", status: "Suspicious" },
    { id: "n2", time: at(alert.minutesAgo, -46), source: alert.sourceIp, destination: "10.10.10.20", port: 53, protocol: "DNS", bytes: "412", status: "Observed" },
    { id: "n3", time: at(alert.minutesAgo, -92), source: alert.sourceIp, destination: "10.10.40.2", port: 445, protocol: "SMB", bytes: "6,104", status: "Observed" },
  ];
  if (alert.destinationIp) {
    flows.splice(1, 0, {
      id: "n4", time: at(alert.minutesAgo, -24), source: alert.sourceIp,
      destination: alert.destinationIp, port: 443, protocol: "HTTPS",
      bytes: "94,210,330", status: "Suspicious",
    });
  }
  return flows;
}

/** Techniques shown in the mapping panel: the alert's own, plus adjacent stages
 *  of the same chain. IDs are looked up against the curated MITRE dataset. */
export function buildTechniqueIds(alert: SocAlert): string[] {
  const t = alert.techniqueId;
  if (!t) return [];
  const chains: Record<string, string[]> = {
    "T1059.001": ["T1059.001", "T1071.001", "T1041"],
    "T1110": ["T1110", "T1078", "T1068"],
    "T1003": ["T1003", "T1078", "T1041"],
    "T1041": ["T1041", "T1071.001"],
    "T1071.001": ["T1071.001", "T1041"],
    "T1046": ["T1046", "T1071.001"],
    "T1068": ["T1068", "T1059.001"],
    "T1566.001": ["T1566.001", "T1059.001"],
    "T1053.005": ["T1053.005", "T1059.001"],
  };
  return chains[t] ?? [t];
}

export function initialActivity(alert: SocAlert, analyst: string): ActivityEntry[] {
  return [
    { id: "a1", time: at(0), actor: analyst, action: `Opened investigation for ${alert.ref}` },
  ];
}

export const ANALYSTS = ["A. Sharma", "J. Mehta", "R. Fernandes", "K. Iyer"];
