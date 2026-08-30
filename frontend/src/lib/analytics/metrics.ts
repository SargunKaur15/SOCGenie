/* ---------------------------------------------------------------------------
   Live analytics — Phase 16.

   Pure functions over the real stores. No React, no I/O, no randomness.

   TWO HONESTY RULES enforced structurally:

   1. Anything not computable returns `Unmeasurable` carrying the REASON, never
      a zero. A zero would read as "we measured it and it was nothing".

   2. Every count carries its denominator. A 1-in-12 false positive must not be
      presented as "8.3%" without the reader seeing the 12.

   MTTD and MTTR are NOT computed. SocAlert carries `minutesAgo` — a display
   value, not a clock — and setStatus() records no transition time, so no
   detect-to-acknowledge or detect-to-resolve duration exists in the data.
--------------------------------------------------------------------------- */
import type { SocAlert } from "../../mocks/alertStore";
import type { SocIncident } from "../../mocks/incidentStore";
import type { ActionRecord } from "../../mocks/automationStore";
import type { Severity } from "../types";

/** A metric that cannot be computed, with the reason stated. */
export interface Unmeasurable {
  measurable: false;
  reason: string;
}

export interface Measured<T> {
  measurable: true;
  value: T;
  /** Population the value was computed over. Always shown beside it. */
  denominator: number;
  source: string;
}

export type Metric<T> = Measured<T> | Unmeasurable;

const measured = <T>(value: T, denominator: number, source: string): Measured<T> => ({
  measurable: true, value, denominator, source,
});
const unmeasurable = (reason: string): Unmeasurable => ({ measurable: false, reason });

export interface Bucket {
  name: string;
  value: number;
}

/** Counts by a key, returned in descending order. */
function countBy<T>(items: T[], key: (t: T) => string | null): Bucket[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export interface LiveMetrics {
  totalAlerts: number;
  severity: Metric<Bucket[]>;
  detectionSource: Metric<Bucket[]>;
  status: Metric<Bucket[]>;
  riskBands: Metric<Bucket[]>;
  topTechniques: Metric<Bucket[]>;
  mlClasses: Metric<Bucket[]>;
  openIncidents: Metric<number>;
  incidentStatus: Metric<Bucket[]>;
  falsePositives: Metric<{ count: number; rate: number }>;
  automation: Metric<Bucket[]>;
  highImpactApprovals: Metric<{ approved: number; rejected: number; pending: number }>;
  /** Always Unmeasurable. See the module header. */
  mttd: Unmeasurable;
  mttr: Unmeasurable;
  /** Always Unmeasurable while nothing persists. */
  trend: Unmeasurable;
}

export function computeMetrics(
  alerts: SocAlert[],
  incidents: SocIncident[],
  automation: ActionRecord[]
): LiveMetrics {
  const n = alerts.length;
  const noAlerts = "No alerts in the current session.";

  const severity: Metric<Bucket[]> = n === 0 ? unmeasurable(noAlerts) : measured(
    SEVERITY_ORDER.map((s) => ({ name: s, value: alerts.filter((a) => a.severity === s).length })),
    n, "alertStore"
  );

  const detectionSource: Metric<Bucket[]> = n === 0 ? unmeasurable(noAlerts) : measured(
    countBy(alerts, (a) => a.detectionSource), n, "alertStore.detectionSource"
  );

  const status: Metric<Bucket[]> = n === 0 ? unmeasurable(noAlerts) : measured(
    countBy(alerts, (a) => a.status), n, "alertStore.status"
  );

  const riskBands: Metric<Bucket[]> = n === 0 ? unmeasurable(noAlerts) : measured(
    [
      { name: "critical (75-100)", value: alerts.filter((a) => a.riskScore >= 75).length },
      { name: "high (50-74)", value: alerts.filter((a) => a.riskScore >= 50 && a.riskScore < 75).length },
      { name: "medium (25-49)", value: alerts.filter((a) => a.riskScore >= 25 && a.riskScore < 50).length },
      { name: "low (0-24)", value: alerts.filter((a) => a.riskScore < 25).length },
    ],
    n, "alertStore.riskScore"
  );

  const mapped = alerts.filter((a) => a.techniqueId !== null);
  const topTechniques: Metric<Bucket[]> = mapped.length === 0
    ? unmeasurable("No alert carries a MITRE technique mapping.")
    : measured(countBy(mapped, (a) => a.techniqueId).slice(0, 8), mapped.length, "alertStore.techniqueId");

  // ML class is written into evidence by Phase 14. Absent on rule alerts.
  const mlLabelled = alerts.filter((a) =>
    a.evidence.some((e) => e.label === "ML classification")
  );
  const mlClasses: Metric<Bucket[]> = mlLabelled.length === 0
    ? unmeasurable("No ML-classified alerts. Upload a CICFlowMeter CSV to generate them.")
    : measured(
        countBy(mlLabelled, (a) => a.evidence.find((e) => e.label === "ML classification")?.value ?? null),
        mlLabelled.length, "Phase 14 ML alert evidence"
      );

  const openIncidents: Metric<number> = incidents.length === 0
    ? unmeasurable("No incidents in the current session.")
    : measured(incidents.filter((i) => i.status !== "resolved").length, incidents.length, "incidentStore");

  const incidentStatus: Metric<Bucket[]> = incidents.length === 0
    ? unmeasurable("No incidents in the current session.")
    : measured(countBy(incidents, (i) => i.status), incidents.length, "incidentStore.status");

  // Raw count travels with the rate so a small denominator is visible.
  const fpCount = alerts.filter((a) => a.status === "false_positive").length;
  const falsePositives: Metric<{ count: number; rate: number }> = n === 0
    ? unmeasurable(noAlerts)
    : measured({ count: fpCount, rate: fpCount / n }, n, "alertStore.status === false_positive");

  const automationMetric: Metric<Bucket[]> = automation.length === 0
    ? unmeasurable("No playbook actions registered yet. Open an alert to trigger triage.")
    : measured(countBy(automation, (r) => r.state), automation.length, "automationStore");

  const high = automation.filter((r) => r.impact === "high");
  const highImpactApprovals: Metric<{ approved: number; rejected: number; pending: number }> =
    high.length === 0
      ? unmeasurable("No high-impact actions have been recommended yet.")
      : measured(
          {
            approved: high.filter((r) => r.state === "approved_not_executed").length,
            rejected: high.filter((r) => r.state === "rejected").length,
            pending: high.filter((r) => r.state === "pending_approval").length,
          },
          high.length, "automationStore, impact = high"
        );

  return {
    totalAlerts: n,
    severity, detectionSource, status, riskBands, topTechniques, mlClasses,
    openIncidents, incidentStatus, falsePositives,
    automation: automationMetric, highImpactApprovals,

    mttd: unmeasurable(
      "Not measurable. Alerts carry no detection timestamp and setStatus() records no acknowledgement time, so no detect-to-acknowledge duration exists in the data."
    ),
    mttr: unmeasurable(
      "Not measurable. No resolution timestamp is recorded on alerts. Incident activity is timestamped, but only within the current session."
    ),
    trend: unmeasurable(
      "Not measurable. No store persists across reloads, so every figure describes the current session only. Trends require a persistence layer."
    ),
  };
}

/** Formats a rate alongside its raw counts, never the percentage alone. */
export function formatRate(count: number, denominator: number): string {
  if (denominator === 0) return "no data";
  return `${count} of ${denominator} (${((count / denominator) * 100).toFixed(1)}%)`;
}
