/* ---------------------------------------------------------------------------
   Deterministic validation of model output.

   The system prompt tells the model not to fabricate. This layer ENFORCES it.
   Instructions are advisory to a model; code is not. Any ATT&CK ID the model
   returns that is not present in the grounded context is stripped and recorded
   as a warning, so a hallucinated identifier can never reach an analyst.
--------------------------------------------------------------------------- */

export interface RawModelOutput {
  answer?: unknown;
  confidence?: unknown;
  observed?: unknown;
  inferred?: unknown;
  recommended?: unknown;
  mitreTechniques?: unknown;
  citedSources?: unknown;
  warnings?: unknown;
  insufficientEvidence?: unknown;
}

/**
 * Two DIFFERENT things, deliberately kept apart.
 *
 * `evidenced`  techniques the ALERT itself is mapped to. Only these may be
 *              presented as an assessment.
 * `contextual` techniques that merely appear in retrieved knowledge documents.
 *              Reference material — never an assessment about this alert.
 *
 * Merging the two was the grounding defect: a document retrieved on a keyword
 * match made its technique assessable.
 */
export interface TechniqueGrounding {
  evidenced: string[];
  contextual: string[];
}

export interface GuardedOutput {
  answer: string;
  confidence: number;
  observed: string[];
  inferred: string[];
  recommended: string[];
  /** ASSESSED techniques. Directly evidenced by the alert, nothing else. */
  mitreTechniques: string[];
  /** Reference only. Appeared in retrieved knowledge, not in this alert's
   *  evidence. Must never be rendered as an assessment. */
  contextualTechniques: string[];
  citedSources: number[];
  warnings: string[];
  insufficientEvidence: boolean;
  /** Set when the guard had to intervene. Surfaced to the analyst. */
  guardWarnings: string[];
}

const strArray = (v: unknown, cap = 12): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, cap) : [];

export function guardModelOutput(
  raw: RawModelOutput,
  grounding: TechniqueGrounding,
  sourceCount: number
): GuardedOutput {
  const guardWarnings: string[] = [];

  const answer = typeof raw.answer === "string" ? raw.answer : "";
  if (!answer) guardWarnings.push("Model returned no answer text.");

  // Confidence clamped; never allowed to read as certainty.
  let confidence = typeof raw.confidence === "number" ? Math.round(raw.confidence) : 0;
  if (confidence > 95) {
    guardWarnings.push("Model confidence capped at 95% — certainty is not representable.");
    confidence = 95;
  }
  if (confidence < 0 || Number.isNaN(confidence)) confidence = 0;

  // THE critical check, now three-way rather than two-way.
  //   evidenced  -> assessable
  //   contextual -> demoted to reference, never assessed
  //   neither    -> fabricated, removed entirely
  const evidenced = new Set(grounding.evidenced);
  const contextual = new Set(grounding.contextual.filter((id) => !evidenced.has(id)));
  const claimed = strArray(raw.mitreTechniques);

  const mitreTechniques = claimed.filter((id) => evidenced.has(id));
  const demoted = claimed.filter((id) => contextual.has(id));
  const fabricated = claimed.filter((id) => !evidenced.has(id) && !contextual.has(id));

  if (demoted.length > 0) {
    guardWarnings.push(
      `Demoted ${demoted.length} technique ID(s) to reference only — present in retrieved knowledge but not evidenced by this alert: ${demoted.join(", ")}.`
    );
  }
  if (fabricated.length > 0) {
    guardWarnings.push(
      `Removed ${fabricated.length} technique ID(s) not present in the retrieved context: ${fabricated.join(", ")}.`
    );
  }
  const contextualTechniques = demoted;

  // Citations must point at a source that was actually supplied.
  const citedSources = Array.isArray(raw.citedSources)
    ? raw.citedSources
        .filter((n): n is number => typeof n === "number" && Number.isInteger(n))
        .filter((n) => n >= 1 && n <= sourceCount)
    : [];

  return {
    answer,
    confidence,
    observed: strArray(raw.observed),
    inferred: strArray(raw.inferred),
    recommended: strArray(raw.recommended),
    mitreTechniques,
    contextualTechniques,
    citedSources,
    warnings: strArray(raw.warnings, 6),
    insufficientEvidence: raw.insufficientEvidence === true,
    guardWarnings,
  };
}

/** Models sometimes wrap JSON in prose or a fenced block. */
export function parseModelJson(text: string): RawModelOutput | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null ? (parsed as RawModelOutput) : null;
  } catch {
    return null;
  }
}
