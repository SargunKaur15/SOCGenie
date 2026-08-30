import { BarChart3, Info, Database, Cpu } from "lucide-react";
import { Panel } from "../ui/Panel";
import { useAlerts, useAutomation } from "../../hooks/useAlerts";
import { useIncidentStore } from "../../hooks/useIncidents";
import { useMlStatus } from "../../hooks/queries";
import { computeMetrics, formatRate, type Bucket, type Metric } from "../../lib/analytics/metrics";

/**
 * Live analytics — Phase 16.
 *
 * Every figure is computed from the real stores at render time. Nothing is
 * read from a fixture.
 *
 * Metrics that cannot be computed render their REASON, never a zero. A zero
 * would read as "measured, and it was nothing" — which is a different and
 * false claim.
 */

function Unavailable({ reason }: { reason: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-status-medium/25 bg-status-medium/[0.05] px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
      <Info size={12} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
      <span>
        <span className="font-semibold text-text-primary">Not measurable.</span> {reason}
      </span>
    </p>
  );
}

/** Horizontal bars. Denominator is always shown beside the values. */
function BarList({ metric, label }: { metric: Metric<Bucket[]>; label: string }) {
  if (!metric.measurable) return <Unavailable reason={metric.reason} />;
  const max = Math.max(...metric.value.map((b) => b.value), 1);
  return (
    <div>
      <p className="mb-1.5 text-2xs text-text-muted">
        {label} · {metric.denominator} record{metric.denominator === 1 ? "" : "s"} · {metric.source}
      </p>
      <ul className="space-y-1">
        {metric.value.map((b) => (
          <li key={b.name} className="flex items-center gap-2">
            <span className="mono w-36 shrink-0 truncate text-2xs text-text-secondary">{b.name}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              <span
                className="block h-full rounded-full bg-accent/70"
                style={{ width: `${Math.round((b.value / max) * 100)}%` }}
              />
            </span>
            <span className="mono w-10 shrink-0 text-right text-2xs tabular text-text-primary">{b.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LiveMetrics() {
  const { alerts } = useAlerts();
  const { incidents } = useIncidentStore();
  const { records } = useAutomation();
  const { data: ml } = useMlStatus();

  const m = computeMetrics(alerts, incidents, records);

  return (
    <div className="space-y-4">
      <Panel eyebrow="Current session" title="Detection volume" actions={<BarChart3 size={14} className="text-text-muted" aria-hidden="true" />}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className="text-2xs text-text-muted">Total alerts</dt>
            <dd className="mono text-lg font-semibold tabular text-text-primary">{m.totalAlerts}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">Open incidents</dt>
            <dd className="mono text-lg font-semibold tabular text-text-primary">
              {m.openIncidents.measurable ? m.openIncidents.value : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">False positives</dt>
            <dd className="mono text-xs tabular text-text-primary">
              {m.falsePositives.measurable
                ? formatRate(m.falsePositives.value.count, m.falsePositives.denominator)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">Playbook actions</dt>
            <dd className="mono text-lg font-semibold tabular text-text-primary">
              {m.automation.measurable ? m.automation.denominator : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-2xs leading-relaxed text-text-muted">
          All figures describe the <span className="font-medium text-text-primary">current session</span>.
          No store persists across reloads.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Alerts" title="Severity distribution">
          <BarList metric={m.severity} label="By severity" />
        </Panel>
        <Panel eyebrow="Alerts" title="Detection source">
          <BarList metric={m.detectionSource} label="Rule vs ML vs combined" />
        </Panel>
        <Panel eyebrow="Alerts" title="Risk band">
          <BarList metric={m.riskBands} label="By computed risk score" />
        </Panel>
        <Panel eyebrow="Alerts" title="Triage status">
          <BarList metric={m.status} label="By status" />
        </Panel>
        <Panel eyebrow="Adversary behaviour" title="MITRE technique ranking">
          <BarList metric={m.topTechniques} label="Top techniques" />
        </Panel>
        <Panel eyebrow="Machine learning" title="ML classification distribution">
          <BarList metric={m.mlClasses} label="By predicted class" />
        </Panel>
      </div>

      <Panel eyebrow="Automation" title="Playbook action outcomes">
        <BarList metric={m.automation} label="By state" />
        {m.highImpactApprovals.measurable && (
          <p className="mt-2 text-2xs leading-relaxed text-text-secondary">
            High-impact actions: {m.highImpactApprovals.value.approved} approved,{" "}
            {m.highImpactApprovals.value.rejected} rejected, {m.highImpactApprovals.value.pending} pending,
            of {m.highImpactApprovals.denominator}.{" "}
            <span className="font-medium text-text-primary">
              Approved means the decision was recorded — nothing was executed.
            </span>
          </p>
        )}
      </Panel>

      <Panel eyebrow="Machine learning" title="Model performance" actions={<Cpu size={14} className="text-text-muted" aria-hidden="true" />}>
        {ml?.available === true && ml.metrics ? (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              {[
                ["Model", ml.version ?? "—"],
                ["Dataset", ml.metrics.dataset ?? "—"],
                ["Features", ml.metrics.featureCount !== null ? String(ml.metrics.featureCount) : "—"],
                ["Macro-F1", ml.metrics.macroF1 !== null ? ml.metrics.macroF1.toFixed(4) : "not recorded"],
                ["Accuracy", ml.metrics.accuracy !== null ? ml.metrics.accuracy.toFixed(4) : "not recorded"],
                ["IF benign FPR", ml.metrics.benignHoldoutFpr !== null ? `${(ml.metrics.benignHoldoutFpr * 100).toFixed(2)}%` : "not recorded"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-2">
                  <dt className="w-24 shrink-0 text-2xs text-text-muted">{k}</dt>
                  <dd className="mono min-w-0 flex-1 text-2xs text-text-primary">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-2xs leading-relaxed text-text-secondary">
              Measured on a held-out test split during training, not on the alerts above. Classes:{" "}
              <span className="mono">{ml.metrics.classes.join(", ")}</span>.{" "}
              <span className="font-medium text-text-primary">PORT_SCAN is not an ML class</span> — it
              remains rule-only.
            </p>
          </>
        ) : (
          <Unavailable reason="No model is loaded, so no trained metrics are available. Start the ML service to populate this panel." />
        )}
      </Panel>

      <Panel eyebrow="Response performance" title="Mean time to detect and resolve" actions={<Database size={14} className="text-text-muted" aria-hidden="true" />}>
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-text-muted">MTTD</p>
            <Unavailable reason={m.mttd.reason} />
          </div>
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-text-muted">MTTR</p>
            <Unavailable reason={m.mttr.reason} />
          </div>
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-text-muted">Trends over time</p>
            <Unavailable reason={m.trend.reason} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
