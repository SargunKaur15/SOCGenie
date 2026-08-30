/* ---------------------------------------------------------------------------
   SIMULATED SOC TELEMETRY — Phase 1 frontend only.
   Nothing here is measured. These values exist so the dashboard can be built
   and reviewed before the backend (Phase 2) and detection pipeline exist.
   Kept out of components so a Phase-2 API response can replace this module
   without touching a single UI file.
--------------------------------------------------------------------------- */
import type { Severity } from "../lib/types";

export type TimeRange = "1h" | "6h" | "24h" | "7d";

export const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
];

export interface Kpi {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  trendPct: number;
  /** Whether a rise is bad (threat metrics) or good (coverage metrics). */
  riseIsBad: boolean;
  tone: "critical" | "high" | "medium" | "info" | "success";
}

export const KPIS: Kpi[] = [
  { id: "critical", label: "Critical Alerts", value: 12, trendPct: 8.3, riseIsBad: true, tone: "critical" },
  { id: "high", label: "High Severity", value: 28, trendPct: -4.1, riseIsBad: true, tone: "high" },
  { id: "incidents", label: "Active Incidents", value: 7, trendPct: 16.7, riseIsBad: true, tone: "medium" },
  { id: "threats", label: "Threats Detected", value: 43, trendPct: 2.4, riseIsBad: true, tone: "info" },
  { id: "endpoints", label: "Endpoints Monitored", value: 248, trendPct: 1.2, riseIsBad: false, tone: "info" },
  { id: "health", label: "Detection Coverage", value: 99.8, suffix: "%", trendPct: 0.1, riseIsBad: false, tone: "success" },
];

export interface TimelinePoint {
  bucket: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/** Deterministic pseudo-random so a refresh varies but never flickers wildly. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const RANGE_BUCKETS: Record<TimeRange, string[]> = {
  "1h": ["10m", "20m", "30m", "40m", "50m", "60m"],
  "6h": ["6h", "5h", "4h", "3h", "2h", "1h"],
  "24h": ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "Now"],
  "7d": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

/** Scales volume with the window so ranges look materially different. */
const RANGE_WEIGHT: Record<TimeRange, number> = { "1h": 0.35, "6h": 0.8, "24h": 1.6, "7d": 4.2 };

export function buildTimeline(range: TimeRange, nonce = 0): TimelinePoint[] {
  const rnd = seeded(range.length * 977 + nonce * 31 + 7);
  const w = RANGE_WEIGHT[range];
  return RANGE_BUCKETS[range].map((bucket) => ({
    bucket,
    critical: Math.round((1 + rnd() * 4) * w),
    high: Math.round((3 + rnd() * 8) * w),
    medium: Math.round((6 + rnd() * 12) * w),
    low: Math.round((9 + rnd() * 16) * w),
  }));
}

export interface SeveritySlice {
  severity: Severity;
  label: string;
  count: number;
}

export const SEVERITY_BREAKDOWN: SeveritySlice[] = [
  { severity: "critical", label: "Critical", count: 12 },
  { severity: "high", label: "High", count: 28 },
  { severity: "medium", label: "Medium", count: 54 },
  { severity: "low", label: "Low", count: 91 },
];

export interface MitreRow {
  id: string;
  name: string;
  tactic: string;
  count: number;
  severity: Severity;
}

/** Real ATT&CK technique IDs — verified against the Enterprise matrix.
 *  Event counts are simulated; the identifiers are not invented. */
export const MITRE_TOP: MitreRow[] = [
  { id: "T1059.001", name: "PowerShell", tactic: "Execution", count: 34, severity: "critical" },
  { id: "T1071.001", name: "Web Protocols", tactic: "Command and Control", count: 27, severity: "high" },
  { id: "T1566.001", name: "Spearphishing Attachment", tactic: "Initial Access", count: 19, severity: "high" },
  { id: "T1053.005", name: "Scheduled Task", tactic: "Persistence", count: 14, severity: "medium" },
  { id: "T1003", name: "OS Credential Dumping", tactic: "Credential Access", count: 9, severity: "critical" },
];

/* Recent alerts are DERIVED from the single alert store so the dashboard and
   the Alerts workspace never disagree. Previously this file held a second,
   independent alert array. */
export type { SocAlert } from "./alertStore";

export interface FeedEvent {
  id: string;
  time: string;
  message: string;
  tone: "critical" | "high" | "medium" | "info" | "success";
}

const FEED_POOL: Omit<FeedEvent, "id" | "time">[] = [
  { message: "Suspicious PowerShell detected on WS-018", tone: "critical" },
  { message: "Failed authentication threshold exceeded — SRV-021", tone: "high" },
  { message: "New IOC matched against indicator feed", tone: "medium" },
  { message: "Endpoint isolation completed — WS-042", tone: "success" },
  { message: "Detection rule R-004 evaluated across 12 hosts", tone: "info" },
  { message: "Scheduled task created by non-admin — SRV-008", tone: "high" },
  { message: "Outbound volume returned to baseline — WS-031", tone: "success" },
  { message: "Correlation window opened for ALT-10492", tone: "info" },
];

export function nextFeedEvent(counter: number): FeedEvent {
  const t = FEED_POOL[counter % FEED_POOL.length];
  return {
    id: `FEED-${counter}`,
    time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
    ...t,
  };
}

export const INITIAL_FEED: FeedEvent[] = Array.from({ length: 6 }, (_, i) => {
  const t = FEED_POOL[i % FEED_POOL.length];
  return {
    id: `FEED-seed-${i}`,
    time: new Date(Date.now() - (i + 1) * 24_000).toLocaleTimeString("en-GB", { hour12: false }),
    ...t,
  };
});

export interface Notification {
  id: string;
  title: string;
  detail: string;
  minutesAgo: number;
  tone: "critical" | "high" | "medium" | "info";
}

export const NOTIFICATIONS: Notification[] = [
  { id: "N-1", title: "Critical alert raised", detail: "Possible credential dumping on WS-042", minutesAgo: 2, tone: "critical" },
  { id: "N-2", title: "Incident escalated", detail: "INC-2291 moved to investigating", minutesAgo: 6, tone: "high" },
  { id: "N-3", title: "Detection rule fired", detail: "R-003 matched on WS-018", minutesAgo: 11, tone: "high" },
  { id: "N-4", title: "Correlation window closed", detail: "4 alerts grouped into one incident", minutesAgo: 23, tone: "info" },
  { id: "N-5", title: "Rule threshold review due", detail: "R-005 fired 14 times on benign traffic", minutesAgo: 47, tone: "medium" },
];
