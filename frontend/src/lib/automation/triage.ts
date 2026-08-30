/* ---------------------------------------------------------------------------
   Deterministic auto-triage — Phase 15.

   REUSES the existing priority() from lib/ai/assessment.ts. It is not
   reimplemented here: a second priority ladder would drift from the first and
   the two would eventually disagree in the UI.

   Pure and explainable. Every output carries the reasoning that produced it.
--------------------------------------------------------------------------- */
import type { SocAlert } from "../../mocks/alertStore";
import type { Priority4 } from "../ai/types";
import { priority } from "../ai/assessment";
import { buildContextFromAlert } from "../ai/context";
import { mlClassOf, selectPlaybook, type Playbook, type PlaybookAction } from "./playbooks";

export type Recommendation = "INVESTIGATE" | "MONITOR" | "ESCALATE" | "REVIEW_FOR_CLOSURE";

export interface TriageResult {
  alertRef: string;
  priority: Priority4;
  priorityReason: string;
  recommendation: Recommendation;
  recommendationReason: string;
  playbook: Playbook;
  playbookReason: string;
  actions: PlaybookAction[];
  /** Ordered lines an analyst can check against the alert itself. */
  explanation: string[];
  /** True when a high-impact action is present and therefore gated. */
  requiresApproval: boolean;
}

/** Deterministic recommendation from values already on the alert. */
function recommend(alert: SocAlert, p: Priority4, correlated: number): { value: Recommendation; reason: string } {
  if (alert.status === "false_positive") {
    return { value: "REVIEW_FOR_CLOSURE", reason: "Already marked a false positive; confirm the reasoning and close." };
  }
  if (alert.status === "resolved") {
    return { value: "REVIEW_FOR_CLOSURE", reason: "Already resolved; verify the outcome was recorded." };
  }
  if (p === "P1" || (alert.severity === "critical" && correlated > 0)) {
    return {
      value: "ESCALATE",
      reason: `Priority ${p}${correlated > 0 ? ` with ${correlated} correlated alert(s)` : ""} — exceeds routine triage.`,
    };
  }
  if (p === "P2") {
    return { value: "INVESTIGATE", reason: `Priority ${p} — work ahead of the routine queue.` };
  }
  if (p === "P4" && alert.severity === "low") {
    return { value: "MONITOR", reason: `Priority ${p} and low severity — batch with routine review.` };
  }
  return { value: "INVESTIGATE", reason: `Priority ${p} — standard investigation.` };
}

/**
 * Triages one alert.
 *
 * Consumes existing values only: severity, riskScore, detectionSource,
 * techniqueId, evidence and correlation. Nothing is invented, and no threat
 * intelligence is introduced.
 */
export function triageAlert(alert: SocAlert, allAlerts: SocAlert[] = []): TriageResult {
  const related = allAlerts.filter(
    (a) =>
      a.ref !== alert.ref &&
      (a.host === alert.host || a.sourceIp === alert.sourceIp || (a.user !== null && a.user === alert.user))
  );

  // priority() expects an InvestigationContext; buildContextFromAlert is the
  // existing adapter, already used by the AI chat path.
  const ctx = buildContextFromAlert(alert, related);
  const { priority: p, reason: priorityReason } = priority(ctx);

  const { playbook, reason: playbookReason } = selectPlaybook(alert);
  const rec = recommend(alert, p, related.length);
  const mlClass = mlClassOf(alert);
  const confidence = alert.evidence.find((e) => e.label === "Model confidence")?.value ?? null;

  const explanation: string[] = [
    `Severity ${alert.severity.toUpperCase()}, risk ${alert.riskScore}/100.`,
    `Detection source: ${alert.detectionSource}.`,
  ];
  if (alert.techniqueId) explanation.push(`Mapped to MITRE ${alert.techniqueId}.`);
  if (mlClass) {
    explanation.push(
      `ML classified this as ${mlClass}${confidence ? ` at ${confidence} confidence` : ""}.`
    );
  }
  explanation.push(
    related.length > 0
      ? `${related.length} alert(s) share an entity with this one.`
      : "No other alert shares an entity with this one."
  );
  explanation.push(priorityReason);
  explanation.push(playbookReason);
  explanation.push(rec.reason);

  const actions = playbook.actions;
  return {
    alertRef: alert.ref,
    priority: p,
    priorityReason,
    recommendation: rec.value,
    recommendationReason: rec.reason,
    playbook,
    playbookReason,
    actions,
    explanation,
    requiresApproval: actions.some((a) => a.impact === "high"),
  };
}
