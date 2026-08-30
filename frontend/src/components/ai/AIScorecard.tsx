import type { Scorecard, ConfidenceBreakdown } from "../../lib/ai/types";

const RISK_TONE: Record<string, string> = {
  critical: "text-status-critical", high: "text-status-high",
  medium: "text-status-medium", low: "text-status-low",
};
const RADIUS_TONE: Record<string, string> = {
  CRITICAL: "text-status-critical", HIGH: "text-status-high",
  MEDIUM: "text-status-medium", LOW: "text-status-low",
};
const PRIORITY_TONE: Record<string, string> = {
  P1: "border-status-critical/40 bg-status-critical/10 text-status-critical",
  P2: "border-status-high/40 bg-status-high/10 text-status-high",
  P3: "border-status-medium/40 bg-status-medium/10 text-status-medium",
  P4: "border-status-low/40 bg-status-low/10 text-status-low",
};

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function AIScorecard({
  scorecard,
  breakdown,
}: {
  scorecard: Scorecard;
  breakdown: ConfidenceBreakdown;
}) {
  const cells = [
    { label: "Threat likelihood", value: `${scorecard.threatLikelihood}%`, tone: "text-text-primary" },
    { label: "False positive risk", value: `${scorecard.falsePositiveLikelihood}%`, tone: "text-text-primary" },
    { label: "Evidence strength", value: scorecard.evidenceStrength, tone: "text-text-primary" },
    { label: "Confidence", value: `${scorecard.confidence}%`, tone: "text-text-primary" },
    { label: "Risk", value: `${scorecard.riskScore}/100`, tone: RISK_TONE[scorecard.riskLevel] ?? "text-text-primary" },
    { label: "Blast radius", value: scorecard.blastRadius, tone: RADIUS_TONE[scorecard.blastRadius] ?? "text-text-primary" },
  ];

  const components = [
    { label: "Evidence strength", value: breakdown.evidenceStrength },
    { label: "Correlation strength", value: breakdown.correlationStrength },
    { label: "Behaviour confidence", value: breakdown.behaviourConfidence },
    { label: "MITRE confidence", value: breakdown.mitreConfidence },
  ];

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">Scorecard</p>
        <span className={`rounded border px-2 py-0.5 text-2xs font-semibold ${PRIORITY_TONE[scorecard.priority]}`}>
          {scorecard.priority}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {cells.map((c) => (
          <div key={c.label}>
            <dt className="text-2xs text-text-muted">{c.label}</dt>
            <dd className={`mono mt-0.5 text-sm font-semibold tabular ${c.tone}`}>{c.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 border-t border-border pt-2.5 text-2xs text-text-secondary">
        <span className="font-medium text-text-muted">Priority. </span>{scorecard.priorityReason}
      </p>

      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Confidence breakdown
        </p>
        <ul className="space-y-2">
          {components.map((c) => (
            <li key={c.label}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xs text-text-secondary">{c.label}</span>
                <span className="mono text-2xs tabular text-text-primary">{c.value}%</span>
              </div>
              <Bar value={c.value} tone="bg-accent/70" />
            </li>
          ))}
          <li className="border-t border-border pt-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xs font-semibold text-text-primary">Overall</span>
              <span className="mono text-2xs font-semibold tabular text-accent">{breakdown.overall}%</span>
            </div>
            <Bar value={breakdown.overall} tone="bg-accent" />
          </li>
        </ul>
        <ul className="mt-2.5 space-y-1">
          {breakdown.explanation.map((e) => (
            <li key={e} className="text-2xs leading-relaxed text-text-muted">{e}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
