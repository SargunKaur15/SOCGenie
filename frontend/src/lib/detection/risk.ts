/* ---------------------------------------------------------------------------
   Six-factor risk scoring.

       25 x ml_confidence          + 20 x anomaly
     + 20 x rule_severity_norm     + 10 x correlation
     + 10 x (asset_criticality/5)  +  8 x privileged_account
     +  7 x threat_intel_confidence

   Weights sum to 100. Corrected in the Phase 12 audit: an earlier version used
   six factors (rule 25, correlation 12, intel 8) and omitted the privileged
   account factor entirely._confidence

   DESIGN PROPERTY (from the risk model): no single factor can reach CRITICAL
   alone. ML at 100% confidence contributes 25 points, not 100.

   PHASE 12 CONSEQUENCE, stated openly rather than engineered away:
   no model exists, so ml_confidence is always 0 and the attainable maximum is
   75 out of 100. 75 is exactly the CRITICAL boundary, so a rule-only detection
   reaches CRITICAL only by maxing every remaining factor simultaneously.

   R-003 and R-004 are defined as `critical` SEVERITY yet will usually score in
   the HIGH band. That is not a bug — severity is the rule author's judgement,
   risk is the composite. `maxAttainable` and `notes` surface the difference so
   an analyst sees why, and so the missing ML is visible instead of hidden by a
   rescale.
--------------------------------------------------------------------------- */
import type { Severity } from "../types";
import type { MlEnrichment, NormalisedEvent, RiskBreakdown, RuleMatch } from "./types";
import { INDICATORS } from "./rules";

const SEVERITY_NORM: Record<Severity, number> = { critical: 1, high: 0.75, medium: 0.5, low: 0.25 };

/** Service, administrative and root-style account names. Heuristic only. */
const PRIVILEGED_ACCOUNT = /^(svc[_-]|adm[_-]?|admin|administrator|root|sa|backup|deploy|sys)/i;

/** Hosts whose name implies infrastructure. Heuristic, and labelled as one. */
function assetCriticality(host: string): number {
  if (/^(dc|auth|gw|fw|srv|vpn)/i.test(host)) return 5;
  if (/^(app|db|mail)/i.test(host)) return 4;
  if (/^ws/i.test(host)) return 2;
  return 3;
}

/** Statistical deviation, only where a rule actually measured one. */
function anomalyScore(match: RuleMatch): number {
  const deviation = match.evidence.find((e) => e.label === "Deviation")?.value;
  if (deviation) {
    const factor = Number.parseFloat(deviation);
    if (Number.isFinite(factor)) return Math.min(1, factor / 20);
  }
  const ratio = match.evidence.find((e) => e.label === "Interval std / mean")?.value;
  if (ratio) {
    const r = Number.parseFloat(ratio);
    // Lower variance = more machine-like = more anomalous for a human network.
    if (Number.isFinite(r)) return Math.min(1, (0.15 - r) / 0.15);
  }
  const attempts = match.evidence.find((e) => e.label === "Failed attempts" || e.label === "Preceding failures")?.value;
  if (attempts) {
    const n = Number.parseInt(attempts, 10);
    if (Number.isFinite(n)) return Math.min(1, n / 40);
  }
  return 0;
}

export function scoreMatch(
  match: RuleMatch,
  allMatches: RuleMatch[],
  events: NormalisedEvent[],
  /** Null when no model contributed — the normal state until a model is
   *  trained. Optional so every existing caller is unaffected and Phase 12
   *  scores stay bit-identical. */
  ml: MlEnrichment | null = null
): RiskBreakdown {
  const notes: string[] = [];

  // ML factor. Absent model OR a BENIGN prediction both yield 0.
  //
  // The BENIGN case matters: predict_proba().max() on a confidently benign flow
  // returns ~0.99, which would add ~25 risk points to traffic the model just
  // judged harmless. Enforced in the service, in mlProvider, and again here.
  const mlApplied = ml !== null;
  const benignPrediction = ml !== null && ml.predictedClass === "BENIGN";
  const mlConfidence = ml === null || benignPrediction ? 0 : 25 * Math.max(0, Math.min(1, ml.mlConfidence));

  if (!mlApplied) {
    notes.push("Machine-learning factor contributes 0: no model is loaded, so scoring is rule-based and the attainable maximum is 75/100.");
  } else if (benignPrediction) {
    notes.push(`Model ${ml.modelVersion} classified this flow as BENIGN, so the ML factor contributes 0.`);
  } else {
    notes.push(`Model ${ml.modelVersion} classified this flow as ${ml.predictedClass} at ${Math.round(ml.mlConfidence * 100)}% confidence.`);
  }

  const ruleSeverity = 20 * SEVERITY_NORM[match.severity];

  // Anomaly: the model's score when available, else the rule-derived heuristic.
  // Host detections keep the heuristic permanently, since no model scores them.
  const anomaly =
    ml !== null
      ? 20 * Math.max(0, Math.min(1, ml.anomalyScore))
      : 20 * anomalyScore(match);
  if (anomaly === 0) notes.push("No statistical deviation was measured for this rule.");
  if (ml !== null) notes.push("Anomaly score supplied by the isolation forest, normalised against training percentiles.");

  // Correlation: other matches sharing host, account or source address.
  const related = allMatches.filter(
    (m) =>
      m !== match &&
      (m.host === match.host || (m.user !== null && m.user === match.user) || m.sourceIp === match.sourceIp)
  );
  const correlation = 10 * Math.min(1, related.length / 3);
  if (related.length > 0) {
    notes.push(`${related.length} correlated detection(s) share an entity with this one.`);
  }

  const criticality = assetCriticality(match.host);
  const assetCriticalityScore = 10 * (criticality / 5);
  notes.push(`Asset criticality ${criticality}/5 inferred from the host naming convention.`);

  // Threat intel — curated local list only.
  const addresses = [match.sourceIp, match.destinationIp].filter(Boolean) as string[];
  const hit = INDICATORS.filter((i) => addresses.includes(i.value)).sort((a, b) => b.confidence - a.confidence)[0];
  const threatIntel = hit ? 7 * (hit.confidence / 100) : 0;
  if (hit) notes.push(`Indicator match on ${hit.value} at confidence ${hit.confidence} (curated local list, not a live feed).`);

  // Privileged account: inferred from the account name, because no directory
  // or group membership source is available. A heuristic, and labelled as one
  // so it is never mistaken for an authoritative privilege lookup.
  const account = match.user ?? "";
  const privilegedAccount = PRIVILEGED_ACCOUNT.test(account) ? 8 : 0;
  if (privilegedAccount > 0) {
    notes.push(`Account "${account}" matches a privileged naming pattern (heuristic — no directory lookup is available).`);
  }

  void events;

  const raw =
    mlConfidence + anomaly + ruleSeverity + correlation + assetCriticalityScore + privilegedAccount + threatIntel;
  const total = Math.round(Math.min(100, Math.max(0, raw)));

  return {
    // Rounded for display consistency with the other six factors. `total` is
    // computed from the raw values above, so this does not change any score.
    mlConfidence: Math.round(mlConfidence),
    privilegedAccount,
    ruleSeverity: Math.round(ruleSeverity),
    anomaly: Math.round(anomaly),
    correlation: Math.round(correlation),
    assetCriticality: Math.round(assetCriticalityScore),
    threatIntel: Math.round(threatIntel),
    total,
    maxAttainable: mlApplied ? 100 : 75,
    mlApplied,
    notes,
  };
}

/** Band used by the UI. Must match assessment.ts or the app contradicts itself. */
export function riskBand(score: number): Severity {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}
