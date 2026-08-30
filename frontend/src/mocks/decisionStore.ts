/* ---------------------------------------------------------------------------
   Analyst decision store — human-in-the-loop record, Phase 7.

   Holds the analyst's verdict alongside the AI assessment that preceded it.
   The AI conclusion is NEVER overwritten: disagreement is preserved on both
   sides, which is the entire point of the record.

   These entries are the shape a future supervised training set would take.
   Nothing here trains anything today, and no claim is made that it does.
--------------------------------------------------------------------------- */
import type { Verdict } from "../lib/ai/types";
import type { Severity } from "../lib/types";

export type AnalystDecision = "TRUE_POSITIVE" | "FALSE_POSITIVE" | "INVESTIGATE_FURTHER";

export const DECISION_LABEL: Record<AnalystDecision, string> = {
  TRUE_POSITIVE: "Confirmed true positive",
  FALSE_POSITIVE: "Marked false positive",
  INVESTIGATE_FURTHER: "Investigate further",
};

export const FALSE_POSITIVE_REASONS = [
  "Legitimate administrative activity",
  "Known software behaviour",
  "Expected authentication",
  "Benign scanner",
  "Test activity",
  "Other",
] as const;

/** One row of the future feedback dataset. */
export interface DecisionRecord {
  id: string;
  alertRef: string;
  recordedAt: string;
  analyst: string;
  decision: AnalystDecision;
  reason: string;
  /** Preserved verbatim from the analysis the analyst was shown. */
  aiVerdict: Verdict;
  aiConfidence: number;
  aiRiskScore: number;
  aiThreatLikelihood: number;
  /** True when the analyst reached a different conclusion than the engine. */
  overridesAi: boolean;
  /** Feature snapshot for future model development. */
  features: {
    severity: Severity;
    detectionSource: string;
    techniqueId: string | null;
    evidenceCount: number;
    relatedAlertCount: number;
  };
}

let records: DecisionRecord[] = [];
let snapshot = records;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  snapshot = records;
  listeners.forEach((l) => l());
}

function verdictImpliesTruePositive(v: Verdict): boolean {
  return v === "LIKELY_TRUE_POSITIVE" || v === "POSSIBLE_TRUE_POSITIVE";
}

export const decisionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): DecisionRecord[] {
    return snapshot;
  },

  forAlert(alertRef: string): DecisionRecord[] {
    return records.filter((r) => r.alertRef === alertRef);
  },

  record(input: Omit<DecisionRecord, "id" | "recordedAt" | "overridesAi">): DecisionRecord {
    seq += 1;
    const overridesAi =
      (input.decision === "FALSE_POSITIVE" && verdictImpliesTruePositive(input.aiVerdict)) ||
      (input.decision === "TRUE_POSITIVE" && !verdictImpliesTruePositive(input.aiVerdict));

    const entry: DecisionRecord = {
      ...input,
      id: `DEC-${seq}`,
      recordedAt: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      overridesAi,
    };
    records = [entry, ...records];
    emit();
    return entry;
  },

  /** Aggregates for a future Learning Center. Returns null below a usable
   *  sample size rather than reporting a meaningless rate. */
  agreementStats(): { total: number; agreements: number; rate: number } | null {
    if (records.length < 5) return null;
    const agreements = records.filter((r) => !r.overridesAi).length;
    return { total: records.length, agreements, rate: agreements / records.length };
  },
};
