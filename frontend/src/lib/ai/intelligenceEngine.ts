/* ---------------------------------------------------------------------------
   Rule-based analysis provider — SOCGenie Assist Mode 1.

   Deterministic. The same context always produces the same analysis; there is
   no randomness and no external call. Output varies because it is composed
   from the actual context: technique, severity, risk band, detection source,
   evidence keys, related-alert overlap and risk factors.

   This is NOT a language model and is never presented as one. It is a template
   engine over a curated knowledge base, which is exactly why it cannot
   fabricate evidence: every sentence it emits is either a fixed string or a
   value read from the context.
--------------------------------------------------------------------------- */
import type {
  AIDashboardAnalysis, AIInvestigationAnalysis, AIProvider, CorrelatedEvidence,
  DashboardContext, DashboardIntent, InvestigationContext, MitreReasoning,
  Priority, RecommendedAction, RecommendedStep,
} from "./types";
import { mitreTechniques } from "../data/fixtures";
import { buildTimeline } from "../../mocks/investigation";
import type { Severity } from "../types";
import {
  affectedAssets, anomalyAnalysis, assessVerdict, attackStory, buildGraph, buildScorecard,
  confidenceBreakdown, dedup, evidenceChain, iocAnalysis, replaySteps, rootCause,
  threatHunting, triad,
} from "./assessment";

/** Per-technique analyst knowledge. Keyed by ATT&CK ID so the analysis is
 *  specific to what was actually detected. */
interface TechniqueProfile {
  threat: string;
  whyRelevant: string;
  steps: [string, string][];
  actions: [string, string][];
  questions: string[];
}

const PROFILES: Record<string, TechniqueProfile> = {
  "T1059.001": {
    threat: "PowerShell was invoked with arguments that obscure its payload. Encoding is used routinely by administrators, but encoding combined with an unexpected parent process is a common execution foothold.",
    whyRelevant: "An encoded command line was observed on a shell process spawned by a non-shell parent.",
    steps: [
      ["Decode the command line in a sandbox", "The decoded payload determines whether this is administrative tooling or a loader."],
      ["Review process ancestry on the host", "Establishing which parent launched the shell separates scripted administration from user-triggered execution."],
      ["Check outbound connections in the following 60 seconds", "Execution followed by egress suggests the payload retrieved or exfiltrated something."],
      ["Confirm whether script block logging captured the full command", "Without it, the decoded argument is the only record of what ran."],
    ],
    actions: [
      ["Collect additional endpoint process evidence", "Process ancestry and module loads are the fastest route to a verdict."],
      ["Isolate the endpoint pending review", "Contains lateral movement if the payload proves malicious."],
      ["Review the account's recent authentication history", "Establishes whether the execution followed a credential compromise."],
    ],
    questions: [
      "Was the shell launched by a trusted parent process?",
      "Does the decoded command reference an external host?",
      "Has this account run encoded commands before?",
    ],
  },
  "T1003": {
    threat: "A process opened a handle against a credential store. If successful, this yields reusable credentials and typically precedes lateral movement.",
    whyRelevant: "A handle was opened against the credential store by a process that does not normally require that access.",
    steps: [
      ["Identify the requesting process and its signer", "Legitimate access comes from a small, known set of security tooling."],
      ["Check whether the access succeeded", "A denied handle materially lowers the urgency of this finding."],
      ["Review authentication events for accounts resident on this host", "Dumped credentials are used quickly, usually within minutes."],
      ["Look for the same process name on other hosts", "Repetition indicates tooling deployed across the estate rather than a one-off."],
    ],
    actions: [
      ["Isolate the endpoint pending review", "Prevents the use of any credentials obtained from this host."],
      ["Force credential rotation for accounts on this host", "Assumes compromise for any credential resident in memory."],
      ["Escalate to an incident", "Credential access rarely stands alone and warrants correlated tracking."],
    ],
    questions: [
      "Did the handle request succeed or was it denied?",
      "Which privileged accounts were logged on to this host?",
      "Has the same process been seen on other endpoints?",
    ],
  },
  "T1110": {
    threat: "A high volume of failed authentications was directed at a single account. This is guessing behaviour; the outcome depends on whether any attempt succeeded.",
    whyRelevant: "Failure volume against one account exceeded the configured threshold within a short window.",
    steps: [
      ["Confirm whether any attempt succeeded", "A success turns a nuisance into an active compromise."],
      ["Check the source address reputation and geography", "External or anonymised sources raise the priority substantially."],
      ["Determine whether the account is privileged or a service account", "Service accounts rarely change password and are attractive targets."],
      ["Look for the same source against other accounts", "Breadth distinguishes password spraying from targeted guessing."],
    ],
    actions: [
      ["Block the source address at the perimeter", "Stops continued attempts while the investigation proceeds."],
      ["Reset the targeted credential", "Removes value from anything already guessed."],
      ["Verify lockout policy is enforced for this account", "Absence of lockout is the condition that made this viable."],
    ],
    questions: [
      "Did any authentication attempt succeed?",
      "Is the targeted account privileged or a service account?",
      "Does this source appear against other accounts?",
    ],
  },
  "T1078": {
    threat: "A successful authentication followed a burst of failures for the same account. The credential is likely known to someone other than its owner.",
    whyRelevant: "A success was observed shortly after repeated failures on the same account.",
    steps: [
      ["Establish what the session did after authenticating", "Post-authentication activity determines the blast radius."],
      ["Compare the source with the account's usual pattern", "Deviation in geography, device or hour supports compromise."],
      ["Check for privilege changes in the same session", "Escalation immediately after access indicates intent."],
    ],
    actions: [
      ["Reset the credential and revoke active sessions", "The credential must be treated as known to an adversary."],
      ["Review all activity for this account in the last 24 hours", "Establishes what was reached before detection."],
      ["Escalate to an incident", "Valid-account use is difficult to detect and warrants tracking."],
    ],
    questions: [
      "What did the session access after authenticating?",
      "Is the source consistent with the account's normal behaviour?",
      "Were any privileges assigned during the session?",
    ],
  },
  "T1068": {
    threat: "A process obtained elevated privileges shortly after a non-administrative session began. Escalation is a stepping stone rather than an end goal.",
    whyRelevant: "An elevated token was acquired close in time to a standard-user session start.",
    steps: [
      ["Identify the mechanism used to elevate", "A known vulnerability, a misconfiguration and legitimate elevation demand different responses."],
      ["Check patch level for the implicated service", "An unpatched known issue converts this into a confirmed exploitation path."],
      ["Review what ran with the elevated token", "Escalation matters because of what it enabled."],
    ],
    actions: [
      ["Collect additional endpoint evidence before remediation", "Rebuilding destroys the artefacts needed to close the investigation."],
      ["Isolate the endpoint pending review", "Elevated access on a live host is difficult to bound."],
      ["Escalate to an incident", "Escalation usually sits mid-chain and implies earlier access."],
    ],
    questions: [
      "Which mechanism granted the elevated token?",
      "Is the implicated service missing patches?",
      "What executed under the elevated context?",
    ],
  },
  "T1041": {
    threat: "Outbound volume materially exceeded this host's established baseline. Volume alone is not proof of exfiltration, but it is the signal that most often precedes confirming it.",
    whyRelevant: "Bytes transferred outbound exceeded the host's rolling baseline by a wide margin.",
    steps: [
      ["Identify the destination and its reputation", "A known service and an unknown host lead to very different conclusions."],
      ["Determine which process owned the connection", "Backup and sync agents explain most benign volume spikes."],
      ["Check whether the volume matches a scheduled job", "Scheduled activity at a fixed hour is the most common false positive here."],
      ["Establish what data the host holds", "Sensitivity determines the severity of the outcome, not the byte count."],
    ],
    actions: [
      ["Review the destination against threat intelligence", "Reputation is the cheapest discriminator available."],
      ["Collect network evidence before the retention window closes", "Flow records age out faster than the investigation completes."],
      ["Escalate if the destination is unrecognised", "Unknown egress destinations warrant incident-level tracking."],
    ],
    questions: [
      "Is the destination a known business service?",
      "Which process owned the outbound connection?",
      "Does the transfer align with a scheduled job?",
    ],
  },
  "T1071.001": {
    threat: "Connections to a single destination occurred at a regular interval with consistent payload size. Regularity is the signature of automation, which may be command-and-control or a legitimate update checker.",
    whyRelevant: "Connection timing showed low variance across repeated requests to one destination.",
    steps: [
      ["Compare the interval against known update services", "Most regular beacons in an estate are legitimate software checking in."],
      ["Inspect payload size consistency", "Fixed-size requests carrying variable responses suggest tasking."],
      ["Identify the owning process", "A browser and an unknown binary imply very different verdicts."],
    ],
    actions: [
      ["Check the destination against threat intelligence", "Reputation resolves most beaconing findings quickly."],
      ["Monitor the host for a further interval", "Beaconing that stops when observed is itself informative."],
      ["Collect process and network evidence", "Needed to distinguish tasking from update polling."],
    ],
    questions: [
      "Does the interval match a known update service?",
      "Which process owns the connection?",
      "Has the destination appeared in other alerts?",
    ],
  },
  "T1046": {
    threat: "One source contacted many ports across multiple hosts in a short window. This is reconnaissance; the question is whether the source is a sanctioned scanner.",
    whyRelevant: "Distinct port and host counts from a single source exceeded the configured threshold.",
    steps: [
      ["Determine whether the source is a sanctioned scanner", "Vulnerability scanners produce this pattern by design."],
      ["Check which ports responded", "Responding services define what the source learned."],
      ["Review what the source did after scanning", "Reconnaissance followed by connection attempts indicates intent."],
    ],
    actions: [
      ["Confirm the source against the asset inventory", "Unmanaged devices scanning internally are the finding worth pursuing."],
      ["Review firewall segmentation between the source and targets", "Scanning that succeeded across segments indicates a control gap."],
    ],
    questions: [
      "Is the scanning source a managed asset?",
      "Which services responded?",
      "Did connection attempts follow the scan?",
    ],
  },
  "T1566.001": {
    threat: "A message carrying a macro-bearing attachment reached a targeted recipient. Delivery and execution are different outcomes and must be distinguished.",
    whyRelevant: "An attachment with an active content component was directed at a specific recipient.",
    steps: [
      ["Confirm whether the attachment was opened", "Delivery without execution is a near miss, not an incident."],
      ["Identify other recipients of the same message", "Campaigns rarely target a single mailbox."],
      ["Check endpoint telemetry for the recipient host", "Execution would appear as a document process spawning a child."],
    ],
    actions: [
      ["Purge the message from other mailboxes", "Limits exposure for recipients who have not yet opened it."],
      ["Confirm macro execution policy on the recipient host", "Policy is the control that decides whether delivery matters."],
    ],
    questions: [
      "Was the attachment opened?",
      "Which other mailboxes received it?",
      "Did the recipient host spawn a child process from a document?",
    ],
  },
  "T1053.005": {
    threat: "A scheduled task was registered by a standard user account. Tasks are a durable persistence mechanism and survive reboot.",
    whyRelevant: "Task registration was performed by an account without administrative need for it.",
    steps: [
      ["Review the task action and trigger", "The binary it runs determines whether this is persistence."],
      ["Establish whether the task is part of a software install", "Legitimate installers register tasks routinely."],
      ["Check for the same task name on other hosts", "Repetition indicates deployment rather than local change."],
    ],
    actions: [
      ["Collect the task definition before removal", "Deleting first destroys the evidence needed to close this out."],
      ["Review the account's recent activity", "Task creation is rarely the first action in a chain."],
    ],
    questions: [
      "What binary does the task execute?",
      "Was it created by a software installation?",
      "Does the same task exist elsewhere?",
    ],
  },
};

const GENERIC: TechniqueProfile = {
  threat: "The detection fired on behaviour that deviates from the established baseline for this host. Without a confident technique mapping, the evidence itself carries the assessment.",
  whyRelevant: "Behaviour deviated from the host baseline.",
  steps: [
    ["Review the raw evidence for this detection", "The captured fields are the only ground truth available."],
    ["Compare against the host's normal behaviour", "Baseline deviation is the reason this fired."],
    ["Check for related alerts on the same entity", "A single deviation is weak evidence; a cluster is not."],
  ],
  actions: [
    ["Collect additional evidence before deciding", "The current evidence does not support a confident verdict."],
    ["Monitor the entity for recurrence", "Repetition converts an anomaly into a pattern."],
  ],
  questions: [
    "Does this behaviour recur on the host?",
    "Are there related alerts on the same entity?",
    "Does the activity align with a scheduled process?",
  ],
};

const profileFor = (id: string | null): TechniqueProfile => (id && PROFILES[id]) || GENERIC;

function riskBand(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/** Priority is degraded for low-risk findings so recommendations stay
 *  proportionate rather than shouting at every detection. */
function scale(base: Priority, score: number): Priority {
  if (score >= 60) return base;
  if (score >= 30) return base === "high" ? "medium" : base === "medium" ? "low" : "low";
  return "low";
}

/** Deterministic confidence from evidence strength — never a model output. */
function investigationConfidence(ctx: InvestigationContext): number {
  let c = 0.35;
  if (ctx.detectionSource === "combined") c += 0.2;
  else if (ctx.detectionSource === "rule") c += 0.14;
  else c += 0.1;
  if (ctx.techniqueId && PROFILES[ctx.techniqueId]) c += 0.15;
  if (ctx.evidence.length >= 4) c += 0.08;
  if (ctx.relatedAlerts.length >= 2) c += 0.1;
  if (ctx.riskScore >= 75) c += 0.08;
  return Math.min(0.95, Math.round(c * 100) / 100);
}

function correlate(ctx: InvestigationContext): CorrelatedEvidence[] {
  const out: CorrelatedEvidence[] = ctx.evidence.slice(0, 4).map((e) => ({
    evidence: `${e.label}: ${e.value}`,
    significance: significanceOf(e.label),
  }));

  const sameHost = ctx.relatedAlerts.filter((a) => a.host === ctx.host);
  if (sameHost.length > 0) {
    out.push({
      evidence: `${sameHost.length} other alert${sameHost.length === 1 ? "" : "s"} on ${ctx.host}`,
      significance: "Multiple detections on one host point to a sequence rather than an isolated event.",
    });
  }
  const activeFactors = ctx.riskFactors.filter((f) => f.present);
  if (activeFactors.length > 0) {
    out.push({
      evidence: `${activeFactors.length} of ${ctx.riskFactors.length} risk factors present`,
      significance: `Contributing: ${activeFactors.map((f) => f.label.toLowerCase()).join("; ")}.`,
    });
  }
  return out;
}

function significanceOf(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("parent")) return "The launching process is the strongest single discriminator between administration and intrusion.";
  if (l.includes("command")) return "The command line records what actually ran, independent of the binary name.";
  if (l.includes("process")) return "Process identity anchors the rest of the host timeline.";
  if (l.includes("bytes") || l.includes("volume")) return "Transfer volume is the primary signal for data movement.";
  if (l.includes("baseline") || l.includes("deviation")) return "Deviation from baseline is the reason this detection fired.";
  if (l.includes("attempt") || l.includes("failed")) return "Attempt volume distinguishes user error from automated guessing.";
  if (l.includes("reputation") || l.includes("indicator")) return "External corroboration raises confidence beyond internal telemetry alone.";
  if (l.includes("destination") || l.includes("connection")) return "The remote endpoint determines whether egress is expected.";
  if (l.includes("port")) return "Port breadth indicates reconnaissance scope.";
  if (l.includes("privilege") || l.includes("token")) return "Privilege change marks a transition in adversary capability.";
  return "Recorded as supporting context for the detection.";
}

function investigationSummary(ctx: InvestigationContext): string {
  const band = riskBand(ctx.riskScore);
  const tech = ctx.techniqueName ? `${ctx.techniqueName} (${ctx.techniqueId})` : "uncategorised activity";
  const sameHost = ctx.relatedAlerts.filter((a) => a.host === ctx.host).length;
  const corr = sameHost > 0
    ? ` ${sameHost} further alert${sameHost === 1 ? "" : "s"} on ${ctx.host} suggest${sameHost === 1 ? "s" : ""} a sequence rather than an isolated event.`
    : " No other alerts currently reference this host.";
  const who = ctx.user ? ` involving ${ctx.user}` : "";
  return `${tech} was detected on ${ctx.host}${who}, scored ${ctx.riskScore}/100 (${band}).${corr} Detection source: ${ctx.detectionSource}. Investigation status is ${ctx.status.toLowerCase()}.`;
}

function riskReasoning(ctx: InvestigationContext): string[] {
  const out = ctx.riskFactors
    .filter((f) => f.present)
    .map((f) => `${f.label} — contributes up to ${f.weight} points.`);
  const absent = ctx.riskFactors.filter((f) => !f.present);
  if (absent.length > 0) {
    out.push(`Not contributing: ${absent.map((f) => f.label.toLowerCase()).join("; ")}.`);
  }
  out.push(
    `Composite score ${ctx.riskScore}/100 places this in the ${riskBand(ctx.riskScore)} band. No single factor can reach the critical band alone.`
  );
  return out;
}

function mitreReasoning(ctx: InvestigationContext): MitreReasoning[] {
  return ctx.relatedTechniqueIds
    .map((id): MitreReasoning | null => {
      const t = mitreTechniques.find((m) => m.technique_id === id);
      if (!t) return null;
      const primary = id === ctx.techniqueId;
      const profile = profileFor(id);
      return {
        techniqueId: t.technique_id,
        techniqueName: t.name,
        tactic: t.tactic,
        whyRelevant: primary
          ? profile.whyRelevant
          : `Commonly observed adjacent to ${ctx.techniqueId ?? "this activity"} in the same chain; not independently evidenced here.`,
        confidence: primary ? Math.min(0.95, investigationConfidence(ctx) + 0.05) : 0.35,
      };
    })
    .filter((m): m is MitreReasoning => m !== null);
}


/** Timeline events for this alert, reused from the existing investigation mocks
 *  rather than generating a second chronology. */
function timelineFor(ctx: InvestigationContext) {
  const alertLike = {
    ref: ctx.alertRef, title: ctx.title, severity: ctx.severity, riskScore: ctx.riskScore,
    status: "open" as const, detectionSource: "rule" as const, minutesAgo: 0,
    sourceIp: ctx.sourceIp, destinationIp: ctx.destinationIp, host: ctx.host, user: ctx.user,
    techniqueId: ctx.techniqueId, evidence: ctx.evidence, notes: [], escalatedTo: null,
  };
  return buildTimeline(alertLike).map((e) => ({
    time: e.time, type: e.type, description: e.description, severity: String(e.severity),
  }));
}

function executiveSummary(
  ctx: InvestigationContext,
  scorecard: { threatLikelihood: number; riskLevel: Severity; blastRadius: string; priority: string },
  verdict: string
): string {
  const plain = verdict.toLowerCase().replace(/_/g, " ");
  return `A ${scorecard.riskLevel} risk finding was raised on ${ctx.host}${ctx.user ? ` involving ${ctx.user}` : ""}. Automated first-pass analysis assesses this as ${plain} at ${scorecard.threatLikelihood}% threat likelihood, with an estimated ${scorecard.blastRadius.toLowerCase()} blast radius. Queue priority ${scorecard.priority}. A SOC analyst must validate this assessment before any response action is taken; nothing has been executed.`;
}

function technicalSummary(ctx: InvestigationContext, breakdown: { overall: number }): string[] {
  const out = [
    `Alert ${ctx.alertRef} — ${ctx.title}. Severity ${ctx.severity}, risk ${ctx.riskScore}/100, detection source ${ctx.detectionSource}.`,
    `Entities: host ${ctx.host}, source ${ctx.sourceIp}${ctx.destinationIp ? `, destination ${ctx.destinationIp}` : ""}${ctx.user ? `, account ${ctx.user}` : ""}.`,
  ];
  if (ctx.techniqueId) out.push(`Mapped technique ${ctx.techniqueId}${ctx.techniqueName ? ` (${ctx.techniqueName})` : ""}, tactic ${ctx.tactic ?? "unmapped"}.`);
  out.push(`Evidence fields captured: ${ctx.evidence.length}. Related alerts sharing an entity: ${ctx.relatedAlerts.length}.`);
  out.push(`Composite analysis confidence ${breakdown.overall}% from four weighted components.`);
  return out;
}

export class LocalIntelligenceEngine implements AIProvider {
  readonly id = "rule_based" as const;
  readonly label = "Rule-based analysis";

  async analyzeInvestigation(ctx: InvestigationContext): Promise<AIInvestigationAnalysis> {
    const profile = profileFor(ctx.techniqueId);
    const confidence = investigationConfidence(ctx);

    const steps: RecommendedStep[] = profile.steps.map(([title, reason], i) => ({
      title,
      reason,
      priority: scale(i === 0 ? "high" : i < 3 ? "medium" : "low", ctx.riskScore),
    }));

    const actions: RecommendedAction[] = profile.actions.map(([action, reason], i) => ({
      action,
      reason,
      priority: scale(i === 0 ? "high" : "medium", ctx.riskScore),
      requiresApproval: true,
    }));

    if (ctx.relatedAlerts.length >= 2) {
      steps.push({
        title: `Review the ${ctx.relatedAlerts.length} related alerts together`,
        reason: "Correlated detections usually describe one activity chain rather than separate events.",
        priority: scale("high", ctx.riskScore),
      });
    }
    if (ctx.noteCount === 0) {
      steps.push({
        title: "Record your findings as an investigation note",
        reason: "Notes are the audit trail and, later, the labelled data for supervised improvement.",
        priority: "low",
      });
    }

    const questions = [...profile.questions];
    if (ctx.destinationIp) questions.push(`Does ${ctx.destinationIp} appear in other alerts?`);
    if (ctx.user) questions.push(`Is ${ctx.user} associated with other recent detections?`);

    // ── Assessment layer ────────────────────────────────────────────────
    const hasProfile = Boolean(ctx.techniqueId && PROFILES[ctx.techniqueId]);
    const breakdown = confidenceBreakdown(ctx, hasProfile);
    const verdictAssessment = assessVerdict(ctx, breakdown.overall);
    const scorecard = buildScorecard(ctx, breakdown, verdictAssessment.verdict);
    const chain = evidenceChain(ctx);
    const iocs = iocAnalysis(ctx);
    const anomalies = anomalyAnalysis(ctx);
    const mitre = mitreReasoning(ctx);
    const story = attackStory(ctx, timelineFor(ctx));
    const hunting = threatHunting(ctx);

    const chainTactics = mitre.map((m) => m.tactic).filter((t): t is string => Boolean(t));
    const attackChain = [...new Set(chainTactics)];

    return {
      kind: "investigation",
      source: "rule_based",
      generatedAt: new Date().toISOString(),
      scorecard,
      confidenceBreakdown: breakdown,
      assessment: verdictAssessment,
      triad: triad(ctx, anomalies),
      evidenceChain: chain,
      iocFindings: iocs,
      anomalies,
      attackStory: story,
      attackChain,
      graph: buildGraph(ctx),
      affectedAssets: affectedAssets(ctx),
      rootCause: rootCause(ctx),
      threatHunting: hunting,
      executiveSummary: executiveSummary(ctx, scorecard, verdictAssessment.verdict),
      technicalSummary: technicalSummary(ctx, breakdown),
      replay: replaySteps(ctx, chain.length, iocs.length, anomalies.length, mitre.length, story.length),
      dedup: dedup(ctx),
      whatChanged: [
        "Historical comparison unavailable — this prototype holds no previous snapshot of the environment to compare against.",
      ],
      summary: investigationSummary(ctx),
      threatExplanation: profile.threat,
      threatLevel: ctx.severity,
      riskReasoning: riskReasoning(ctx),
      mitreReasoning: mitreReasoning(ctx),
      correlatedEvidence: correlate(ctx),
      recommendedInvestigationSteps: steps.slice(0, 6),
      recommendedResponseActions: actions,
      confidence,
      followUpQuestions: questions.slice(0, 5),
      limitations: [
        "Produced by a deterministic rule-based engine, not a language model. No external service was consulted.",
        "Analysis is limited to the evidence captured on this alert; absence of evidence is not evidence of absence.",
        ctx.detectionSource === "rule"
          ? "No machine-learning classification contributed, because the model is not yet trained."
          : "Machine-learning contribution is limited to the classification recorded on the alert.",
        "All response actions are recommendations. Nothing is executed and no system is modified.",
      ],
    };
  }

  async analyzeDashboard(
    ctx: DashboardContext,
    intent: DashboardIntent,
    question?: string
  ): Promise<AIDashboardAnalysis> {
    const base = {
      kind: "dashboard" as const,
      source: "rule_based" as const,
      generatedAt: new Date().toISOString(),
      confidence: 0.6,
      limitations: [
        "Produced by a deterministic rule-based engine over simulated dashboard telemetry.",
        ctx.mlEngineTrained
          ? "Machine-learning classifications are included where present."
          : "No machine-learning model is trained, so no classification data contributed.",
        "All recommendations require analyst approval. Nothing is executed.",
      ],
      followUpQuestions: [
        "What should I investigate first?",
        "Which alerts appear related?",
        "Explain the top MITRE technique.",
      ],
    };

    const topTech = ctx.topTechniques[0];
    const topAlert = ctx.topAlerts[0];
    const multiStage = ctx.repeatedHosts.slice(0, 3);

    const priorityStep = (title: string, reason: string, priority: Priority): RecommendedStep => ({ title, reason, priority });

    switch (intent) {
      case "explain_top_threat": {
        const t = topTech ? mitreTechniques.find((m) => m.technique_id === topTech.id) : undefined;
        const profile = profileFor(topTech?.id ?? null);
        return {
          ...base,
          title: "Top threat explanation",
          summary: topTech
            ? `${t?.name ?? topTech.id} (${topTech.id}) is the most frequent technique in the current alert set, appearing in ${topTech.count} alert${topTech.count === 1 ? "" : "s"}.`
            : "No technique currently dominates the alert set.",
          sections: [
            { heading: "Assessment", lines: [profile.threat] },
            { heading: "Tactic", lines: [t ? `${t.tactic} — ${t.description}` : "No mapped tactic."] },
            { heading: "Mitigation", lines: [t?.mitigation ?? "No mitigation recorded."] },
          ],
          recommendedSteps: profile.steps.slice(0, 3).map(([title, reason], i) =>
            priorityStep(title, reason, i === 0 ? "high" : "medium")
          ),
        };
      }

      case "suspicious_patterns": {
        const lines = multiStage.length
          ? multiStage.map((h) => `${h.host} appears in ${h.count} alerts — the strongest multi-stage indicator in the current set.`)
          : ["No host currently appears in more than one alert."];
        const techLines = ctx.topTechniques.slice(0, 3).map((t) => `${t.id} ${t.name} — ${t.count} alert${t.count === 1 ? "" : "s"}.`);
        return {
          ...base,
          title: "Suspicious pattern analysis",
          summary: multiStage.length
            ? `${multiStage.length} host${multiStage.length === 1 ? "" : "s"} appear in more than one alert. Repetition on a single entity is the clearest available signal of a multi-stage sequence.`
            : "No entity repetition is present, so the current alerts read as independent events.",
          sections: [
            { heading: "Entity repetition", lines },
            { heading: "Technique concentration", lines: techLines.length ? techLines : ["No techniques mapped."] },
          ],
          recommendedSteps: multiStage.length
            ? [priorityStep(`Review all alerts on ${multiStage[0].host} together`, "Correlated alerts on one host usually describe a single chain.", "high")]
            : [priorityStep("Continue monitoring", "No correlation signal is present in the current set.", "low")],
        };
      }

      case "security_posture": {
        const openish = ctx.criticalAlerts + ctx.highAlerts;
        return {
          ...base,
          title: "Security posture",
          summary: `${ctx.totalAlerts} alerts are present across ${ctx.endpointsMonitored} monitored endpoints, of which ${openish} are high or critical. ${ctx.openIncidents} incident${ctx.openIncidents === 1 ? " is" : "s are"} open.`,
          sections: [
            {
              heading: "Distribution",
              lines: [
                `Critical ${ctx.criticalAlerts} · High ${ctx.highAlerts} · Medium ${ctx.mediumAlerts} · Low ${ctx.lowAlerts}`,
                openish > ctx.totalAlerts / 2
                  ? "High-severity alerts dominate the queue, which usually indicates either a real campaign or a rule tuned too aggressively."
                  : "Severity distribution is weighted toward lower-severity findings, which is the expected steady state.",
              ],
            },
            {
              heading: "Detection coverage",
              lines: [
                ctx.mlEngineTrained
                  ? "Rule engine and machine-learning classification are both contributing."
                  : "Detection is currently rule-based only. The machine-learning model is not trained, so no classifications contribute.",
              ],
            },
          ],
          recommendedSteps: [
            priorityStep("Work the critical queue first", `${ctx.criticalAlerts} critical alert${ctx.criticalAlerts === 1 ? "" : "s"} outrank everything else in the set.`, ctx.criticalAlerts > 0 ? "high" : "low"),
            priorityStep("Review rule thresholds against benign traffic", "A queue dominated by one severity often reflects tuning rather than adversary activity.", "medium"),
          ],
        };
      }

      case "triage_priority": {
        return {
          ...base,
          title: "Triage priority",
          summary: topAlert
            ? `Start with ${topAlert.ref} — ${topAlert.title} on ${topAlert.host}, risk ${topAlert.riskScore}/100. It carries the highest combination of severity and risk in the current set.`
            : "No alerts are currently queued.",
          sections: [
            {
              heading: "Ranked queue",
              lines: ctx.topAlerts.map((a, i) => `${i + 1}. ${a.ref} — ${a.title} · ${a.host} · risk ${a.riskScore} · ${a.severity}`),
            },
            multiStage.length
              ? { heading: "Correlation note", lines: [`${multiStage[0].host} appears in ${multiStage[0].count} alerts — consider working them as one investigation.`] }
              : { heading: "Correlation note", lines: ["No entity repetition detected across the current alerts."] },
          ],
          recommendedSteps: ctx.topAlerts.slice(0, 3).map((a, i) =>
            priorityStep(`Open ${a.ref}`, `${a.severity} severity, risk ${a.riskScore}, on ${a.host}.`, i === 0 ? "high" : "medium")
          ),
        };
      }

      case "summarize_alerts":
      default: {
        const unknown = intent === "unknown";
        return {
          ...base,
          title: unknown ? "Alert summary" : "Alert summary",
          summary: unknown && question
            ? `That question could not be matched to a supported analysis. Returning the current alert summary instead. ${ctx.criticalAlerts} critical and ${ctx.highAlerts} high-severity alerts are present.`
            : `${ctx.totalAlerts} alerts are present: ${ctx.criticalAlerts} critical, ${ctx.highAlerts} high, ${ctx.mediumAlerts} medium, ${ctx.lowAlerts} low.`,
          sections: [
            {
              heading: "Highest priority",
              lines: ctx.topAlerts.slice(0, 3).map((a) => `${a.ref} — ${a.title} · ${a.host} · risk ${a.riskScore}`),
            },
            {
              heading: "Technique concentration",
              lines: ctx.topTechniques.length
                ? ctx.topTechniques.map((t) => `${t.id} ${t.name} — ${t.count} alert${t.count === 1 ? "" : "s"}`)
                : ["No techniques mapped in the current set."],
            },
            ...(unknown
              ? [{
                  heading: "Supported questions",
                  lines: [
                    "What should I investigate first?",
                    "Explain the top MITRE technique.",
                    "Which alerts appear related?",
                    "Summarise today's security posture.",
                  ],
                }]
              : []),
          ],
          recommendedSteps: [
            priorityStep("Triage the critical queue", `${ctx.criticalAlerts} critical alert${ctx.criticalAlerts === 1 ? "" : "s"} present.`, ctx.criticalAlerts > 0 ? "high" : "low"),
          ],
        };
      }
    }
  }
}

export const severityRank: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
