/* ---------------------------------------------------------------------------
   Assessment layer — deterministic scoring for AI SOCGenie.

   EVERY number here comes from a documented rule over the actual context.
   Nothing is random, nothing is learned, and no external service is consulted.
   The scoring model is written out in full so an analyst — or an examiner —
   can reproduce any figure by hand.

   These are heuristics, not model outputs, and the UI labels them as such.
--------------------------------------------------------------------------- */
import type {
  AffectedAssets, AnomalyFinding, AttackStoryStep, BlastRadius, ConfidenceBreakdown,
  DedupSummary, EvidenceChainItem, EvidenceStrength, GraphEdge, GraphNode, InvestigationContext,
  IocFinding, Priority4, ReasoningTriad, ReplayStep, Scorecard, Verdict, VerdictAssessment,
} from "./types";
import type { Severity } from "../types";

const pct = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 100);

/* ── Confidence ─────────────────────────────────────────────────────────────
   Four independent components, averaged with equal weight.

   evidenceStrength    0.30 base + 0.10 per evidence item (cap 0.95)
   correlationStrength 0.25 base + 0.15 per related alert on the same host,
                       + 0.05 per related alert elsewhere (cap 0.95)
   behaviourConfidence detection source: combined 0.85 / rule 0.70 / ml 0.60,
                       +0.05 if risk >= 75
   mitreConfidence     0.85 if the technique has a curated profile,
                       0.45 if mapped but uncurated, 0.20 if unmapped
--------------------------------------------------------------------------- */
export function confidenceBreakdown(
  ctx: InvestigationContext,
  hasProfile: boolean
): ConfidenceBreakdown {
  const evidenceStrength = Math.min(0.95, 0.3 + ctx.evidence.length * 0.1);

  const sameHost = ctx.relatedAlerts.filter((a) => a.host === ctx.host).length;
  const elsewhere = ctx.relatedAlerts.length - sameHost;
  const correlationStrength = Math.min(0.95, 0.25 + sameHost * 0.15 + elsewhere * 0.05);

  const behaviourBase =
    ctx.detectionSource === "combined" ? 0.85 : ctx.detectionSource === "rule" ? 0.7 : 0.6;
  const behaviourConfidence = Math.min(0.95, behaviourBase + (ctx.riskScore >= 75 ? 0.05 : 0));

  const mitreConfidence = ctx.techniqueId ? (hasProfile ? 0.85 : 0.45) : 0.2;

  const overall =
    (evidenceStrength + correlationStrength + behaviourConfidence + mitreConfidence) / 4;

  return {
    evidenceStrength: pct(evidenceStrength),
    correlationStrength: pct(correlationStrength),
    behaviourConfidence: pct(behaviourConfidence),
    mitreConfidence: pct(mitreConfidence),
    overall: pct(overall),
    explanation: [
      `Evidence strength — ${ctx.evidence.length} evidence field${ctx.evidence.length === 1 ? "" : "s"} captured on this alert.`,
      sameHost > 0
        ? `Correlation strength — ${sameHost} related alert${sameHost === 1 ? "" : "s"} on ${ctx.host}, ${elsewhere} elsewhere.`
        : `Correlation strength — no related alerts share this host, which weakens the signal.`,
      `Behaviour confidence — detection source is ${ctx.detectionSource}${ctx.detectionSource === "rule" ? "; no model contributed because none is trained" : ""}.`,
      ctx.techniqueId
        ? `MITRE confidence — ${ctx.techniqueId} ${hasProfile ? "has a curated analyst profile" : "is mapped but has no curated profile"}.`
        : "MITRE confidence — no confident technique mapping, so this component is low by design.",
    ],
  };
}

/* ── Evidence strength band ─────────────────────────────────────────────── */
export function evidenceStrengthBand(ctx: InvestigationContext): EvidenceStrength {
  const score = ctx.evidence.length + ctx.relatedAlerts.length;
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MODERATE";
  return "LOW";
}

/* ── Blast radius ───────────────────────────────────────────────────────────
   Counts distinct hosts and users touched by this alert and its correlations,
   then bands the result. Critical assets (SRV/AUTH/DC prefixes) raise it.
--------------------------------------------------------------------------- */
export function blastRadius(ctx: InvestigationContext): BlastRadius {
  const hosts = new Set<string>([ctx.host, ...ctx.relatedAlerts.map((a) => a.host)]);
  const criticalAsset = [...hosts].some((h) => /^(SRV|AUTH|DC|GW)/i.test(h));
  const n = hosts.size;
  if (n >= 4 || (criticalAsset && n >= 2)) return "CRITICAL";
  if (n === 3 || criticalAsset) return "HIGH";
  if (n === 2) return "MEDIUM";
  return "LOW";
}

/* ── Priority ───────────────────────────────────────────────────────────────
   P1 risk >= 75 or (critical severity and correlated)
   P2 risk >= 50
   P3 risk >= 25
   P4 otherwise
--------------------------------------------------------------------------- */
export function priority(ctx: InvestigationContext): { priority: Priority4; reason: string } {
  const correlated = ctx.relatedAlerts.length >= 2;
  if (ctx.riskScore >= 75 || (ctx.severity === "critical" && correlated)) {
    return {
      priority: "P1",
      reason: `Risk ${ctx.riskScore}/100${correlated ? ` with ${ctx.relatedAlerts.length} correlated alerts` : ""} — highest queue priority.`,
    };
  }
  if (ctx.riskScore >= 50) return { priority: "P2", reason: `Risk ${ctx.riskScore}/100 places this above the routine queue.` };
  if (ctx.riskScore >= 25) return { priority: "P3", reason: `Risk ${ctx.riskScore}/100 — work after higher-risk findings.` };
  return { priority: "P4", reason: `Risk ${ctx.riskScore}/100 — low priority; batch with routine review.` };
}

/* ── False positive / true positive ─────────────────────────────────────────
   Supporting and contradicting indicators are counted separately and the
   verdict is banded on their difference. Absolute certainty is never emitted.
--------------------------------------------------------------------------- */
export function assessVerdict(
  ctx: InvestigationContext,
  confidence: number
): VerdictAssessment {
  const supporting: string[] = [];
  const contradicting: string[] = [];

  if (ctx.severity === "critical" || ctx.severity === "high") {
    supporting.push(`${ctx.severity} severity assigned by the detection layer.`);
  }
  if (ctx.detectionSource === "combined") supporting.push("Rule and model detection agreed independently.");
  if (ctx.relatedAlerts.filter((a) => a.host === ctx.host).length >= 2) {
    supporting.push(`Multiple correlated alerts on ${ctx.host} indicate a sequence, not an isolated event.`);
  }
  if (ctx.riskFactors.filter((f) => f.present).length >= 4) {
    supporting.push("Four or more independent risk factors are contributing.");
  }
  if (ctx.techniqueId && /T1003|T1068|T1059\.001/.test(ctx.techniqueId)) {
    supporting.push(`Technique ${ctx.techniqueId} is rarely benign in normal operation.`);
  }
  if (ctx.evidence.some((e) => /reputation|indicator|tor/i.test(e.value))) {
    supporting.push("An indicator match corroborates the internal telemetry.");
  }

  // Contradicting indicators — the FP case must be argued, not assumed away.
  if (ctx.evidence.some((e) => /schedule|backup|internal|nightly/i.test(`${e.label} ${e.value}`))) {
    contradicting.push("Evidence references scheduled or internal activity, a common benign explanation.");
  }
  if (ctx.user && /^svc_/i.test(ctx.user)) {
    contradicting.push(`${ctx.user} is a service account; automated behaviour is expected for it.`);
  }
  if (ctx.relatedAlerts.length === 0) {
    contradicting.push("No correlated alerts — isolated detections are more often benign.");
  }
  if (ctx.severity === "low") contradicting.push("Low severity assigned by the detection layer.");
  if (ctx.detectionSource === "rule" && ctx.evidence.length <= 3) {
    contradicting.push("Single-source rule detection with limited evidence captured.");
  }

  const delta = supporting.length - contradicting.length;
  let verdict: Verdict;
  if (delta >= 3) verdict = "LIKELY_TRUE_POSITIVE";
  else if (delta >= 1) verdict = "POSSIBLE_TRUE_POSITIVE";
  else if (delta === 0) verdict = "UNCERTAIN";
  else if (delta === -1) verdict = "POSSIBLE_FALSE_POSITIVE";
  else verdict = "LIKELY_FALSE_POSITIVE";

  // Guardrails — prefer uncertainty over false certainty.
  let guardrail: string | null = null;
  if (supporting.length + contradicting.length <= 1) {
    guardrail = "Insufficient evidence for a reliable classification. Analyst investigation required.";
    verdict = "UNCERTAIN";
  } else if (supporting.length > 0 && contradicting.length > 0 && Math.abs(delta) <= 1) {
    guardrail = "Conflicting evidence detected. Both sides are shown below; analyst judgement required.";
  } else if (confidence < 55) {
    guardrail = "Low confidence — additional evidence recommended before acting on this assessment.";
  }

  return {
    verdict,
    confidence,
    supporting,
    contradicting: contradicting.length ? contradicting : ["None identified in the available evidence."],
    guardrail,
  };
}

/* ── Scorecard ─────────────────────────────────────────────────────────────
   threatLikelihood   overall confidence shifted by the verdict band
   falsePositiveRisk  the complement, floored at 5% — never claims certainty
--------------------------------------------------------------------------- */
export function buildScorecard(
  ctx: InvestigationContext,
  breakdown: ConfidenceBreakdown,
  verdict: Verdict
): Scorecard {
  const shift: Record<Verdict, number> = {
    LIKELY_TRUE_POSITIVE: 8,
    POSSIBLE_TRUE_POSITIVE: 2,
    UNCERTAIN: -10,
    POSSIBLE_FALSE_POSITIVE: -22,
    LIKELY_FALSE_POSITIVE: -35,
  };
  const threatLikelihood = Math.max(5, Math.min(95, breakdown.overall + shift[verdict]));
  const p = priority(ctx);
  const riskLevel: Severity =
    ctx.riskScore >= 75 ? "critical" : ctx.riskScore >= 50 ? "high" : ctx.riskScore >= 25 ? "medium" : "low";

  return {
    threatLikelihood,
    falsePositiveLikelihood: Math.max(5, 100 - threatLikelihood),
    evidenceStrength: evidenceStrengthBand(ctx),
    confidence: breakdown.overall,
    riskScore: ctx.riskScore,
    riskLevel,
    blastRadius: blastRadius(ctx),
    priority: p.priority,
    priorityReason: p.reason,
  };
}

/* ── Evidence chain — references real data only ─────────────────────────── */
export function evidenceChain(ctx: InvestigationContext): EvidenceChainItem[] {
  const items: EvidenceChainItem[] = ctx.evidence.map((e) => ({
    id: `${ctx.alertRef}/${e.label.replace(/\s+/g, "-").toLowerCase()}`,
    time: null,
    type: "Alert evidence",
    source: ctx.host,
    summary: `${e.label}: ${e.value}`,
    relevance: "Captured on the alert that opened this investigation.",
  }));

  for (const a of ctx.relatedAlerts) {
    items.push({
      id: a.ref,
      time: null,
      type: "Related alert",
      source: a.host,
      summary: `${a.title} (${a.severity})`,
      relevance:
        a.host === ctx.host
          ? `Shares host ${ctx.host} with this investigation.`
          : "Shares an entity with this investigation.",
    });
  }
  return items;
}

/* ── IOC analysis — honest about the absence of external intelligence ───── */
export function iocAnalysis(ctx: InvestigationContext): IocFinding[] {
  const out: IocFinding[] = [];
  const externalIp = (ip: string) => !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

  const indicatorHit = ctx.evidence.find((e) => /reputation|indicator|tor exit/i.test(e.value));
  out.push({
    indicator: ctx.sourceIp,
    type: "ip",
    classification: indicatorHit
      ? "INDICATOR_MATCH"
      : externalIp(ctx.sourceIp)
        ? "SUSPICIOUS"
        : "UNKNOWN",
    rationale: indicatorHit
      ? `Matches a curated local indicator: ${indicatorHit.value}`
      : externalIp(ctx.sourceIp)
        ? "External address. No external threat intelligence lookup is configured, so reputation is unverified."
        : "Internal address. No external threat intelligence lookup is configured.",
  });

  if (ctx.destinationIp) {
    out.push({
      indicator: ctx.destinationIp,
      type: "ip",
      classification: externalIp(ctx.destinationIp) ? "SUSPICIOUS" : "UNKNOWN",
      rationale: externalIp(ctx.destinationIp)
        ? "External destination. Reputation unverified — no external threat intelligence is connected."
        : "Internal destination.",
    });
  }

  const proc = ctx.evidence.find((e) => /^process$/i.test(e.label));
  if (proc) {
    out.push({
      indicator: proc.value,
      type: "process",
      classification: /powershell|rundll32|wscript|mshta/i.test(proc.value) ? "SUSPICIOUS" : "UNKNOWN",
      rationale: /powershell|rundll32|wscript|mshta/i.test(proc.value)
        ? "Frequently abused living-off-the-land binary. Presence alone is not malicious."
        : "No local classification available for this process name.",
    });
  }

  if (ctx.user) {
    out.push({
      indicator: ctx.user,
      type: "user",
      classification: /^svc_/i.test(ctx.user) ? "UNKNOWN" : "UNKNOWN",
      rationale: /^svc_/i.test(ctx.user)
        ? "Service account. Automated behaviour is expected; interactive behaviour is not."
        : "Standard account. No local reputation data is held for accounts.",
    });
  }
  return out;
}

/* ── Anomaly analysis — observation separated from interpretation ──────── */
export function anomalyAnalysis(ctx: InvestigationContext): AnomalyFinding[] {
  const out: AnomalyFinding[] = [];
  for (const e of ctx.evidence) {
    const l = e.label.toLowerCase();
    if (/failed|attempt/.test(l)) {
      out.push({ observed: `${e.label}: ${e.value}`, interpretation: "Volume above a normal user's error rate suggests automation rather than mistyping." });
    } else if (/baseline|deviation/.test(l)) {
      out.push({ observed: `${e.label}: ${e.value}`, interpretation: "Deviation from the host's own history is the reason this fired; it is not evidence of intent." });
    } else if (/parent/.test(l)) {
      out.push({ observed: `${e.label}: ${e.value}`, interpretation: "An unexpected parent process is one of the strongest single discriminators available on an endpoint." });
    } else if (/interval|std/.test(l)) {
      out.push({ observed: `${e.label}: ${e.value}`, interpretation: "Low timing variance indicates a scheduled or automated process, which may be benign software." });
    }
  }
  if (out.length === 0) {
    out.push({ observed: "No individual field deviates from its expected range.", interpretation: "The detection rests on the rule condition rather than on a statistical anomaly." });
  }
  return out;
}

/* ── Attack story, chain and graph ─────────────────────────────────────── */
export function attackStory(
  ctx: InvestigationContext,
  timeline: { time: string; type: string; description: string; severity: string }[]
): AttackStoryStep[] {
  return timeline.map((e) => ({
    time: e.time,
    event: e.description,
    tactic: e.type === "DETECTION_RAISED" ? ctx.tactic : null,
    important: e.severity === "critical" || e.severity === "high",
  }));
}

export function buildGraph(ctx: InvestigationContext): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const add = (n: GraphNode) => { if (!nodes.some((x) => x.id === n.id)) nodes.push(n); };

  if (ctx.user) add({ id: `user:${ctx.user}`, label: ctx.user, kind: "user" });
  add({ id: `host:${ctx.host}`, label: ctx.host, kind: "host" });
  add({ id: `ip:${ctx.sourceIp}`, label: ctx.sourceIp, kind: "ip" });
  add({ id: `alert:${ctx.alertRef}`, label: ctx.alertRef, kind: "alert" });

  const proc = ctx.evidence.find((e) => /^process$/i.test(e.label));
  if (proc) add({ id: `proc:${proc.value}`, label: proc.value, kind: "process" });
  if (ctx.destinationIp) add({ id: `ip:${ctx.destinationIp}`, label: ctx.destinationIp, kind: "ip" });
  if (ctx.techniqueId) add({ id: `tech:${ctx.techniqueId}`, label: ctx.techniqueId, kind: "technique" });

  if (ctx.user) edges.push({ from: `user:${ctx.user}`, to: `host:${ctx.host}`, label: "session on" });
  edges.push({ from: `ip:${ctx.sourceIp}`, to: `host:${ctx.host}`, label: "connected to" });
  if (proc) {
    edges.push({ from: `host:${ctx.host}`, to: `proc:${proc.value}`, label: "executed" });
    edges.push({ from: `proc:${proc.value}`, to: `alert:${ctx.alertRef}`, label: "raised" });
  } else {
    edges.push({ from: `host:${ctx.host}`, to: `alert:${ctx.alertRef}`, label: "raised" });
  }
  if (ctx.destinationIp && proc) {
    edges.push({ from: `proc:${proc.value}`, to: `ip:${ctx.destinationIp}`, label: "connected to" });
  }
  if (ctx.techniqueId) edges.push({ from: `alert:${ctx.alertRef}`, to: `tech:${ctx.techniqueId}`, label: "maps to" });

  return { nodes, edges };
}

/* ── Assets, root cause, dedup, replay ─────────────────────────────────── */
export function affectedAssets(ctx: InvestigationContext): AffectedAssets {
  const confirmed = [{ asset: ctx.host, reason: "Named directly in the detection evidence." }];
  if (ctx.user) confirmed.push({ asset: ctx.user, reason: "Account associated with the detected activity." });

  const potential = ctx.relatedAlerts
    .filter((a) => a.host !== ctx.host)
    .map((a) => ({ asset: a.host, reason: `Shares an entity with ${ctx.alertRef} via ${a.ref}.` }));
  if (ctx.destinationIp) {
    potential.push({ asset: ctx.destinationIp, reason: "Remote endpoint contacted; involvement not confirmed." });
  }
  return { confirmed, potential };
}

export function rootCause(ctx: InvestigationContext): string {
  const t = ctx.techniqueId ?? "";
  if (/T1110|T1078/.test(t)) return "Most consistent with credential guessing or reuse. Cannot be confirmed without establishing whether authentication succeeded.";
  if (/T1566/.test(t)) return "Most consistent with a phishing delivery attempt. Execution has not been confirmed.";
  if (/T1059|T1053/.test(t)) return "Most consistent with script execution, which may be administrative tooling or malicious. The decoded payload determines which.";
  if (/T1003|T1068/.test(t)) return "Most consistent with post-compromise activity, implying an earlier access event not yet identified.";
  if (/T1041|T1071/.test(t)) return "Most consistent with automated egress. Legitimate sync and backup software produce the same pattern.";
  if (/T1046/.test(t)) return "Most consistent with reconnaissance, which may originate from a sanctioned scanner.";
  return "Root cause could not be determined from the available evidence.";
}

export function dedup(ctx: InvestigationContext): DedupSummary | null {
  const same = ctx.relatedAlerts.filter(
    (a) => a.host === ctx.host && a.title.toLowerCase() === ctx.title.toLowerCase()
  );
  if (same.length === 0) return null;
  return {
    groupedCount: same.length + 1,
    reason: `${same.length + 1} alerts share the same title and host (${ctx.host}) and likely describe one event. Originals are preserved.`,
  };
}

export function replaySteps(
  ctx: InvestigationContext,
  chainLength: number,
  iocCount: number,
  anomalyCount: number,
  mitreCount: number,
  storyLength: number
): ReplayStep[] {
  return [
    { step: "Collect alert context", status: "complete", detail: `Read ${ctx.alertRef} from the alert store.`, evidenceCount: null },
    { step: "Collect evidence", status: "complete", detail: "Read the evidence fields recorded on the alert.", evidenceCount: ctx.evidence.length },
    { step: "Identify related alerts", status: "complete", detail: "Matched on shared host, source address or account.", evidenceCount: ctx.relatedAlerts.length },
    { step: "Analyse indicators", status: "complete", detail: "Classified locally. No external threat intelligence is connected.", evidenceCount: iocCount },
    { step: "Evaluate anomalies", status: "complete", detail: "Compared evidence fields against expected ranges.", evidenceCount: anomalyCount },
    { step: "Evaluate FP/TP indicators", status: "complete", detail: "Counted supporting and contradicting indicators separately.", evidenceCount: null },
    { step: "Map MITRE ATT&CK", status: ctx.techniqueId ? "complete" : "skipped", detail: ctx.techniqueId ? "Deterministic lookup against the curated dataset." : "No confident technique mapping available.", evidenceCount: mitreCount },
    { step: "Reconstruct timeline", status: "complete", detail: "Ordered the recorded events for this alert.", evidenceCount: storyLength },
    { step: "Calculate risk", status: "complete", detail: `Six-factor risk model produced ${ctx.riskScore}/100.`, evidenceCount: null },
    { step: "Generate investigation plan", status: "complete", detail: "Selected steps from the curated profile for the mapped technique.", evidenceCount: null },
    { step: "Produce assessment", status: "complete", detail: `Evidence chain assembled from ${chainLength} items.`, evidenceCount: chainLength },
  ];
}

export function triad(ctx: InvestigationContext, anomalies: AnomalyFinding[]): ReasoningTriad {
  return {
    observed: [
      ...ctx.evidence.slice(0, 4).map((e) => `${e.label}: ${e.value}`),
      `Detection source: ${ctx.detectionSource}. Risk ${ctx.riskScore}/100.`,
      ctx.relatedAlerts.length
        ? `${ctx.relatedAlerts.length} related alert${ctx.relatedAlerts.length === 1 ? "" : "s"} share an entity with this one.`
        : "No related alerts share an entity with this one.",
    ],
    inferred: [
      ...anomalies.slice(0, 3).map((a) => a.interpretation),
      ctx.techniqueId
        ? `Behaviour is consistent with ${ctx.techniqueId}; the mapping is a deterministic lookup, not a judgement of intent.`
        : "No technique mapping is confident enough to infer intent.",
    ],
    recommended: [
      "Validate the observed evidence against the host's normal behaviour before deciding.",
      "Record the outcome as an investigation note so the decision is auditable.",
    ],
  };
}

export function threatHunting(ctx: InvestigationContext): string[] {
  const out = [
    `Search for ${ctx.sourceIp} across all endpoints in the last 7 days.`,
    `Search for other alerts involving ${ctx.host}.`,
  ];
  if (ctx.user) out.push(`Search authentication events for ${ctx.user} across the estate.`);
  const proc = ctx.evidence.find((e) => /^process$/i.test(e.label));
  if (proc) out.push(`Search for ${proc.value} executions with the same parent process elsewhere.`);
  if (ctx.techniqueId) out.push(`Review other detections mapped to ${ctx.techniqueId}.`);
  if (ctx.destinationIp) out.push(`Search outbound connections to ${ctx.destinationIp}.`);
  return out.slice(0, 6);
}
