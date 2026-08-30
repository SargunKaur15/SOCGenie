import { useState } from "react";
import { CheckCircle2, XCircle, Search, History } from "lucide-react";
import { Button } from "../ui/Button";
import { Select } from "../ui/Input";
import {
  DECISION_LABEL, FALSE_POSITIVE_REASONS,
  type AnalystDecision, type DecisionRecord,
} from "../../mocks/decisionStore";

/**
 * Human-in-the-loop record.
 *
 * The analyst's verdict never overwrites the engine's. Both are stored, and a
 * disagreement is flagged rather than hidden — that disagreement is the most
 * valuable row in a future training set.
 */
export function AIAnalystDecision({
  history,
  onRecord,
}: {
  history: DecisionRecord[];
  onRecord: (decision: AnalystDecision, reason: string) => void;
}) {
  const [reason, setReason] = useState<string>(FALSE_POSITIVE_REASONS[0]);

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Analyst decision
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={CheckCircle2} onClick={() => onRecord("TRUE_POSITIVE", "Confirmed by analyst")}>
            Confirm true positive
          </Button>
          <Button icon={XCircle} onClick={() => onRecord("FALSE_POSITIVE", reason)}>
            Mark false positive
          </Button>
          <Button icon={Search} onClick={() => onRecord("INVESTIGATE_FURTHER", "Further evidence required")}>
            Investigate further
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor="fp-reason" className="text-2xs text-text-muted">
            False positive reason
          </label>
          <Select id="fp-reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="False positive reason">
            {FALSE_POSITIVE_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>
        <p className="mt-2 text-2xs leading-relaxed text-text-muted">
          Your decision is recorded alongside the automated assessment. The assessment is not
          overwritten, so any disagreement between the two is preserved.
        </p>
      </div>

      {history.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
            <History size={11} aria-hidden="true" /> Decision history
          </p>
          <ul className="space-y-1.5">
            {history.map((d) => (
              <li key={d.id} className="rounded-md border border-border bg-bg-elevated px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-2xs font-medium text-text-primary">{DECISION_LABEL[d.decision]}</span>
                  <span className="mono text-2xs text-text-muted">{d.analyst} · {d.recordedAt}</span>
                </div>
                <p className="mt-0.5 text-2xs text-text-secondary">{d.reason}</p>
                <p className="mt-1 text-2xs text-text-muted">
                  Engine assessed {d.aiVerdict.replace(/_/g, " ").toLowerCase()} at {d.aiConfidence}% confidence
                  {d.overridesAi && (
                    <span className="ml-1.5 rounded border border-status-medium/40 bg-status-medium/10 px-1.5 text-status-medium">
                      analyst override
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
