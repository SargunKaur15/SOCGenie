import { AlertTriangle, Check, HelpCircle, X } from "lucide-react";
import { VERDICT_LABEL, type ReasoningTriad, type VerdictAssessment } from "../../lib/ai/types";

const TONE: Record<string, { box: string; text: string }> = {
  LIKELY_TRUE_POSITIVE: { box: "border-status-critical/40 bg-status-critical/10", text: "text-status-critical" },
  POSSIBLE_TRUE_POSITIVE: { box: "border-status-high/40 bg-status-high/10", text: "text-status-high" },
  UNCERTAIN: { box: "border-status-medium/40 bg-status-medium/10", text: "text-status-medium" },
  POSSIBLE_FALSE_POSITIVE: { box: "border-border bg-bg-elevated", text: "text-text-secondary" },
  LIKELY_FALSE_POSITIVE: { box: "border-status-success/40 bg-status-success/10", text: "text-status-success" },
};

export function AIAssessment({
  assessment,
  triad,
}: {
  assessment: VerdictAssessment;
  triad: ReasoningTriad;
}) {
  const tone = TONE[assessment.verdict];

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border p-3.5 ${tone.box}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={`text-sm font-semibold ${tone.text}`}>{VERDICT_LABEL[assessment.verdict]}</p>
          <span className="mono text-2xs tabular text-text-secondary">
            confidence {assessment.confidence}%
          </span>
        </div>

        {assessment.guardrail && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-status-medium/30 bg-status-medium/[0.06] px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
            {assessment.guardrail}
          </p>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              <Check size={11} className="text-status-critical" aria-hidden="true" /> Supporting
            </p>
            <ul className="space-y-1">
              {assessment.supporting.length === 0 ? (
                <li className="text-2xs text-text-muted">None identified.</li>
              ) : (
                assessment.supporting.map((s) => (
                  <li key={s} className="text-2xs leading-relaxed text-text-secondary">• {s}</li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              <X size={11} className="text-status-success" aria-hidden="true" /> Contradicting
            </p>
            <ul className="space-y-1">
              {assessment.contradicting.map((c) => (
                <li key={c} className="text-2xs leading-relaxed text-text-secondary">• {c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* OBSERVED / INFERRED / RECOMMENDED kept structurally separate so
          inference can never be read as fact. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { key: "Observed", items: triad.observed, tone: "border-accent/30", label: "Evidence actually available" },
          { key: "Inferred", items: triad.inferred, tone: "border-status-medium/30", label: "Interpretation, not fact" },
          { key: "Recommended", items: triad.recommended, tone: "border-status-success/30", label: "Suggested next action" },
        ].map((block) => (
          <div key={block.key} className={`rounded-lg border ${block.tone} bg-bg-elevated p-3`}>
            <p className="text-2xs font-semibold uppercase tracking-wider text-text-primary">{block.key}</p>
            <p className="mt-0.5 text-2xs text-text-muted">{block.label}</p>
            <ul className="mt-2 space-y-1.5">
              {block.items.map((i) => (
                <li key={i} className="text-2xs leading-relaxed text-text-secondary">• {i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AIWhyList({ reasons }: { reasons: string[] }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
        <HelpCircle size={11} aria-hidden="true" /> Why this conclusion
      </p>
      <ol className="space-y-1.5">
        {reasons.map((r, i) => (
          <li key={r} className="flex gap-2 text-2xs leading-relaxed text-text-secondary">
            <span className="mono shrink-0 text-text-muted">{i + 1}.</span>
            {r}
          </li>
        ))}
      </ol>
    </div>
  );
}
