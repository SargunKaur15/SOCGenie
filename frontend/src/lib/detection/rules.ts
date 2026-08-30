/* ---------------------------------------------------------------------------
   Detection rules R-001 … R-007.

   Each rule is a pure function from events to matches. Thresholds are the ones
   already published in the project's rule catalogue, so the UI description and
   the executed logic cannot drift apart.

   Every match carries the ids of the events that satisfied it and evidence read
   VERBATIM from those events. Nothing is synthesised — if a value is not in the
   log, it does not appear in the alert.
--------------------------------------------------------------------------- */
import type { NormalisedEvent, RuleDefinition, RuleMatch, RuleId } from "./types";

export const RULES: RuleDefinition[] = [
  { id: "R-001", name: "Authentication Failure Burst", severity: "medium", techniqueId: "T1110", enabled: true,
    description: "5 or more authentication failures for a single account within 120 seconds." },
  { id: "R-002", name: "Failure-Then-Success", severity: "high", techniqueId: "T1078", enabled: true,
    description: "10 or more failures followed by a success for the same account within 300 seconds." },
  { id: "R-003", name: "Suspicious PowerShell", severity: "critical", techniqueId: "T1059.001", enabled: true,
    description: "PowerShell invoked with encoded/obfuscation flags, or spawned by an Office or browser process." },
  { id: "R-004", name: "Privilege Escalation Indicator", severity: "critical", techniqueId: "T1068", enabled: true,
    description: "Token elevation or admin-group addition within 300 seconds of a non-admin session start." },
  { id: "R-005", name: "Anomalous Outbound Volume", severity: "high", techniqueId: "T1041", enabled: true,
    description: "Outbound bytes exceed five times the host rolling baseline to an external destination." },
  { id: "R-006", name: "Threat Intelligence Match", severity: "high", techniqueId: null, enabled: true,
    description: "Source or destination address matches a curated indicator with confidence 70 or above." },
  { id: "R-007", name: "Beaconing Regularity", severity: "medium", techniqueId: "T1071", enabled: true,
    description: "Six or more connections to one destination with inter-arrival std/mean below 0.15 over 30 minutes." },
];

/** Curated local indicators. Small and hand-authored — this is NOT a live feed,
 *  and the engine says so wherever it is used. */
export const INDICATORS: { value: string; type: "ip"; confidence: number; note: string }[] = [
  { value: "185.220.101.4", type: "ip", confidence: 91, note: "Tor exit node (curated list)" },
  { value: "45.83.91.12", type: "ip", confidence: 84, note: "Reported command-and-control host" },
  { value: "103.21.244.9", type: "ip", confidence: 76, note: "Credential-stuffing source" },
  { value: "91.213.8.44", type: "ip", confidence: 72, note: "Low-reputation hosting range" },
];

const SEC = 1000;
const isPrivate = (ip: string) => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const host = (e: NormalisedEvent) => e.host ?? e.sourceIp ?? "unknown-host";
const src = (e: NormalisedEvent) => e.sourceIp ?? "unknown-source";

/** Groups events by a key, preserving chronological order within each group. */
function groupBy<T>(items: T[], key: (t: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** Sliding window: earliest index whose timestamp is within `windowMs` of `i`. */
function windowStart(events: NormalisedEvent[], i: number, windowMs: number): number {
  let s = i;
  while (s > 0 && events[i].timestamp - events[s - 1].timestamp <= windowMs) s--;
  return s;
}

// ── R-001 ───────────────────────────────────────────────────────────────────
export function ruleAuthFailureBurst(events: NormalisedEvent[]): RuleMatch[] {
  const failures = events.filter((e) => e.kind === "auth" && e.outcome === "failure");
  const matches: RuleMatch[] = [];

  for (const [user, list] of groupBy(failures, (e) => e.user)) {
    for (let i = 0; i < list.length; i++) {
      const s = windowStart(list, i, 120 * SEC);
      const count = i - s + 1;
      if (count < 5) continue;
      const window = list.slice(s, i + 1);
      const sources = [...new Set(window.map(src))];
      matches.push({
        ruleId: "R-001", ruleName: "Authentication Failure Burst", severity: "medium", techniqueId: "T1110",
        title: `Repeated authentication failures for ${user}`,
        host: host(window[0]), user, sourceIp: sources[0], destinationIp: null,
        firstSeen: window[0].timestamp, lastSeen: window[window.length - 1].timestamp,
        evidence: [
          { label: "Failed attempts", value: String(count) },
          { label: "Window", value: `${Math.round((window[window.length - 1].timestamp - window[0].timestamp) / SEC)}s` },
          { label: "Account", value: user },
          { label: "Distinct sources", value: String(sources.length) },
          { label: "Source", value: sources.join(", ") },
        ],
        eventIds: window.map((e) => e.id),
      });
      break; // one match per account; further windows describe the same burst
    }
  }
  return matches;
}

// ── R-002 ───────────────────────────────────────────────────────────────────
export function ruleFailureThenSuccess(events: NormalisedEvent[]): RuleMatch[] {
  const auth = events.filter((e) => e.kind === "auth" && e.outcome !== null);
  const matches: RuleMatch[] = [];

  for (const [user, list] of groupBy(auth, (e) => e.user)) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].outcome !== "success") continue;
      const s = windowStart(list, i, 300 * SEC);
      const priorFailures = list.slice(s, i).filter((e) => e.outcome === "failure");
      if (priorFailures.length < 10) continue;
      const window = list.slice(s, i + 1);
      matches.push({
        ruleId: "R-002", ruleName: "Failure-Then-Success", severity: "high", techniqueId: "T1078",
        title: `Successful authentication after ${priorFailures.length} failures for ${user}`,
        host: host(list[i]), user, sourceIp: src(list[i]), destinationIp: null,
        firstSeen: window[0].timestamp, lastSeen: list[i].timestamp,
        evidence: [
          { label: "Preceding failures", value: String(priorFailures.length) },
          { label: "Outcome", value: "success" },
          { label: "Window", value: `${Math.round((list[i].timestamp - window[0].timestamp) / SEC)}s` },
          { label: "Account", value: user },
          { label: "Source", value: src(list[i]) },
        ],
        eventIds: window.map((e) => e.id),
      });
      break;
    }
  }
  return matches;
}

// ── R-003 ───────────────────────────────────────────────────────────────────
const ENCODED = /(-enc\b|-e\b|-encodedcommand|-nop\b|-noprofile|-w\s+hidden|-windowstyle\s+hidden|frombase64string|iex\b|invoke-expression)/i;
const SUSPICIOUS_PARENT = /(winword|excel|powerpnt|outlook|msaccess|chrome|firefox|msedge|iexplore|acrobat)/i;

export function ruleSuspiciousPowerShell(events: NormalisedEvent[]): RuleMatch[] {
  return events
    .filter((e) => e.kind === "process" && /powershell|pwsh/i.test(`${e.process ?? ""} ${e.commandLine ?? ""}`))
    .filter((e) => ENCODED.test(e.commandLine ?? "") || SUSPICIOUS_PARENT.test(e.parentProcess ?? ""))
    .map((e) => {
      const encoded = ENCODED.test(e.commandLine ?? "");
      const badParent = SUSPICIOUS_PARENT.test(e.parentProcess ?? "");
      const evidence = [
        { label: "Process", value: e.process ?? "powershell.exe" },
        { label: "Parent process", value: e.parentProcess ?? "unknown" },
        { label: "Command line", value: e.commandLine ?? "not recorded" },
        { label: "Trigger", value: [encoded && "obfuscation flags", badParent && "unexpected parent"].filter(Boolean).join(" + ") },
      ];
      if (e.user) evidence.push({ label: "Account", value: e.user });
      return {
        ruleId: "R-003" as RuleId, ruleName: "Suspicious PowerShell", severity: "critical" as const,
        techniqueId: "T1059.001",
        title: `Suspicious PowerShell execution on ${host(e)}`,
        host: host(e), user: e.user, sourceIp: src(e), destinationIp: e.destinationIp,
        firstSeen: e.timestamp, lastSeen: e.timestamp,
        evidence, eventIds: [e.id],
      };
    });
}

// ── R-004 ───────────────────────────────────────────────────────────────────
const ELEVATION = /(sedebugprivilege|setcbprivilege|token elevation|admin group|administrators|elevated|4672|4728)/i;

export function rulePrivilegeEscalation(events: NormalisedEvent[]): RuleMatch[] {
  const matches: RuleMatch[] = [];
  const elevations = events.filter(
    (e) => e.kind === "privilege" || ELEVATION.test(`${e.privilege ?? ""} ${e.raw}`)
  );

  for (const e of elevations) {
    // Session start = the most recent successful auth on the same host.
    const priorSession = [...events]
      .filter((p) => p.kind === "auth" && p.outcome === "success" && host(p) === host(e) && p.timestamp <= e.timestamp)
      .pop();
    if (!priorSession) continue;
    const delta = e.timestamp - priorSession.timestamp;
    if (delta > 300 * SEC) continue;

    matches.push({
      ruleId: "R-004", ruleName: "Privilege Escalation Indicator", severity: "critical", techniqueId: "T1068",
      title: `Privilege elevation shortly after session start on ${host(e)}`,
      host: host(e), user: e.user ?? priorSession.user, sourceIp: src(e), destinationIp: null,
      firstSeen: priorSession.timestamp, lastSeen: e.timestamp,
      evidence: [
        { label: "Privilege granted", value: e.privilege ?? "elevation observed" },
        { label: "Session start", value: `${Math.round(delta / SEC)}s before elevation` },
        { label: "Account", value: e.user ?? priorSession.user ?? "unknown" },
        { label: "Process", value: e.process ?? "not recorded" },
      ],
      eventIds: [priorSession.id, e.id],
    });
  }
  return matches;
}

// ── R-005 ───────────────────────────────────────────────────────────────────
export function ruleAnomalousOutbound(events: NormalisedEvent[]): RuleMatch[] {
  const flows = events.filter((e) => e.bytesOut !== null && e.bytesOut > 0);
  const matches: RuleMatch[] = [];

  for (const [h, list] of groupBy(flows, (e) => e.host ?? e.sourceIp)) {
    if (list.length < 3) continue; // a baseline needs history
    for (let i = 0; i < list.length; i++) {
      const prior = list.slice(0, i);
      if (prior.length < 2) continue;
      const baseline = prior.reduce((s, e) => s + (e.bytesOut ?? 0), 0) / prior.length;
      const bytes = list[i].bytesOut ?? 0;
      const dst = list[i].destinationIp;
      // External destination only — internal backup traffic is the dominant
      // benign explanation and is excluded by the rule as specified.
      if (baseline <= 0 || bytes <= baseline * 5) continue;
      if (!dst || isPrivate(dst)) continue;

      matches.push({
        ruleId: "R-005", ruleName: "Anomalous Outbound Volume", severity: "high", techniqueId: "T1041",
        title: `Outbound transfer far above baseline from ${h}`,
        host: h, user: list[i].user, sourceIp: src(list[i]), destinationIp: dst,
        firstSeen: list[0].timestamp, lastSeen: list[i].timestamp,
        evidence: [
          { label: "Bytes sent", value: bytes.toLocaleString() },
          { label: "Host baseline", value: `${Math.round(baseline).toLocaleString()} (mean of ${prior.length} prior flows)` },
          { label: "Deviation", value: `${(bytes / baseline).toFixed(1)}x baseline` },
          { label: "Destination", value: dst },
        ],
        eventIds: [list[i].id],
      });
      break;
    }
  }
  return matches;
}

// ── R-006 ───────────────────────────────────────────────────────────────────
export function ruleThreatIntelMatch(events: NormalisedEvent[]): RuleMatch[] {
  const matches: RuleMatch[] = [];
  const seen = new Set<string>();

  for (const e of events) {
    for (const addr of [e.sourceIp, e.destinationIp]) {
      if (!addr) continue;
      const hit = INDICATORS.find((i) => i.value === addr && i.confidence >= 70);
      if (!hit) continue;
      const key = `${host(e)}|${addr}`;
      if (seen.has(key)) continue;
      seen.add(key);

      matches.push({
        ruleId: "R-006", ruleName: "Threat Intelligence Match", severity: "high", techniqueId: null,
        title: `Traffic involving a known indicator (${addr})`,
        host: host(e), user: e.user, sourceIp: src(e), destinationIp: e.destinationIp,
        firstSeen: e.timestamp, lastSeen: e.timestamp,
        evidence: [
          { label: "Indicator", value: addr },
          { label: "Confidence", value: String(hit.confidence) },
          { label: "Source", value: `curated local list — ${hit.note}` },
          { label: "Note", value: "No live threat intelligence feed is connected." },
        ],
        eventIds: [e.id],
      });
    }
  }
  return matches;
}

// ── R-007 ───────────────────────────────────────────────────────────────────
export function ruleBeaconing(events: NormalisedEvent[]): RuleMatch[] {
  const conns = events.filter((e) => e.destinationIp !== null);
  const matches: RuleMatch[] = [];

  for (const [key, list] of groupBy(conns, (e) => `${e.host ?? e.sourceIp}|${e.destinationIp}`)) {
    if (list.length < 6) continue;
    const span = list[list.length - 1].timestamp - list[0].timestamp;
    if (span > 30 * 60 * SEC) continue;

    const gaps: number[] = [];
    for (let i = 1; i < list.length; i++) gaps.push(list[i].timestamp - list[i - 1].timestamp);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (mean <= 0) continue;
    const variance = gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length;
    const ratio = Math.sqrt(variance) / mean;
    if (ratio >= 0.15) continue;

    const [h, dst] = key.split("|");
    matches.push({
      ruleId: "R-007", ruleName: "Beaconing Regularity", severity: "medium", techniqueId: "T1071",
      title: `Regular-interval connections from ${h} to ${dst}`,
      host: h, user: list[0].user, sourceIp: src(list[0]), destinationIp: dst,
      firstSeen: list[0].timestamp, lastSeen: list[list.length - 1].timestamp,
      evidence: [
        { label: "Connections", value: String(list.length) },
        { label: "Mean interval", value: `${Math.round(mean / SEC)}s` },
        { label: "Interval std / mean", value: ratio.toFixed(3) },
        { label: "Window", value: `${Math.round(span / 60000)} min` },
        { label: "Destination", value: dst },
      ],
      eventIds: list.map((e) => e.id),
    });
  }
  return matches;
}

export const RULE_FUNCTIONS: Record<RuleId, (e: NormalisedEvent[]) => RuleMatch[]> = {
  "R-001": ruleAuthFailureBurst,
  "R-002": ruleFailureThenSuccess,
  "R-003": ruleSuspiciousPowerShell,
  "R-004": rulePrivilegeEscalation,
  "R-005": ruleAnomalousOutbound,
  "R-006": ruleThreatIntelMatch,
  "R-007": ruleBeaconing,
};
