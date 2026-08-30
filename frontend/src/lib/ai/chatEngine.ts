/* ---------------------------------------------------------------------------
   Local chat engine — SOC analyst assistant, Mode 1.

   Deterministic. No external service, no model, no randomness.

   It deliberately DELEGATES to the existing analyzeInvestigation and
   analyzeDashboard rather than carrying its own security knowledge. That keeps
   one curated knowledge base: improve the engine and the chat improves with it.

   Context is pulled from the live alert and incident stores, so asking about
   "the latest critical alert" resolves to a real record — the analyst never
   pastes data in.
--------------------------------------------------------------------------- */
import type {
  ActionCategory, ChatContext, ChatIntent, ChatProvider, Finding,
  RecommendedAction, ResponseMeta, SocResponse, ThreatAssessment,
} from "./chat";
import { ACTION_ORDER } from "./chat";
import type { AIInvestigationAnalysis } from "./types";
import { getProvider } from "./provider";
import { buildContextFromAlert, buildDashboardContext } from "./context";
import { mitreTechniques } from "../data/fixtures";
import { retrieve, excerpt } from "../rag/retriever";
import { INSUFFICIENT_EVIDENCE } from "../rag/types";
import type { KnowledgeCitation } from "./chat";
import type { SocAlert } from "../../mocks/alertStore";
import type { SocIncident } from "../../mocks/incidentStore";

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/** Keyword routing. Simple and honest about being rule-based. */
export function classifyIntent(question: string): ChatIntent {
  const q = question.toLowerCase();
  if (/incident summar|summar.*incident|handoff|report/.test(q)) return "incident_summary";
  // A bare technique ID (T1059.001, T1110) is unambiguously a MITRE question,
  // so it is matched here rather than falling through to "explain".
  if (/mitre|att&ck|attack technique|technique|tactic|\bt\d{4}(\.\d{3})?\b/.test(q)) return "mitre";
  if (/respond|response|contain|remediat|what do i do|action/.test(q)) return "response";
  if (/investigat|next step|what next|where.*start|first/.test(q)) return "investigate";
  if (/explain|what is|why|how did|walk me/.test(q)) return "explain";
  if (/analy[sz]e|assess|triage|look at|review/.test(q)) return "analyze";
  return "general";
}

/** Resolves which alert the question is about, in priority order:
 *  an explicit ALT-xxxxx reference, then a focused alert, then keyword hints,
 *  then the highest-severity unresolved alert. */
export function resolveAlert(question: string, ctx: ChatContext): SocAlert | null {
  if (ctx.alerts.length === 0) return null;
  const q = question.toLowerCase();

  const explicit = q.match(/alt-\d+/);
  if (explicit) {
    const found = ctx.alerts.find((a) => a.ref.toLowerCase() === explicit[0]);
    if (found) return found;
  }

  if (ctx.focusAlertRef) {
    const focused = ctx.alerts.find((a) => a.ref === ctx.focusAlertRef);
    if (focused) return focused;
  }

  // Keyword hints against title, host or technique.
  const keyworded = ctx.alerts.find(
    (a) =>
      q.includes(a.host.toLowerCase()) ||
      (a.techniqueId !== null && q.includes(a.techniqueId.toLowerCase())) ||
      a.title.toLowerCase().split(/\s+/).some((w) => w.length > 5 && q.includes(w))
  );
  if (keyworded) return keyworded;

  const openAlerts = ctx.alerts.filter((a) => a.status !== "resolved" && a.status !== "false_positive");
  const pool = openAlerts.length > 0 ? openAlerts : ctx.alerts;
  return [...pool].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.riskScore - a.riskScore
  )[0];
}

function relatedTo(alert: SocAlert, alerts: SocAlert[]): SocAlert[] {
  return alerts.filter(
    (a) =>
      a.ref !== alert.ref &&
      (a.host === alert.host || a.sourceIp === alert.sourceIp || (a.user !== null && a.user === alert.user))
  );
}

function assessmentOf(alert: SocAlert, analysis: AIInvestigationAnalysis): ThreatAssessment {
  const technique = alert.techniqueId
    ? mitreTechniques.find((t) => t.technique_id === alert.techniqueId)
    : undefined;
  return {
    severity: alert.severity,
    riskScore: alert.riskScore,
    priority: analysis.scorecard.priority,
    confidence: analysis.confidenceBreakdown.overall,
    verdict: analysis.assessment.verdict.replace(/_/g, " ").toLowerCase(),
    techniqueId: technique?.technique_id ?? null,
    techniqueName: technique?.name ?? null,
    tactic: technique?.tactic ?? null,
    host: alert.host,
    account: alert.user ?? "—",
    source: alert.sourceIp,
    destination: alert.destinationIp,
  };
}

/**
 * Retrieves supporting knowledge and converts it to citations.
 *
 * Returns the standard insufficient-evidence message when nothing clears the
 * relevance floor, so the caller states that plainly rather than answering
 * from an empty corpus.
 */
function retrieveSources(
  question: string,
  techniqueIds: string[]
): { sources: KnowledgeCitation[]; insufficientKnowledge: string | null } {
  const result = retrieve({ text: question, techniqueIds });
  if (result.insufficient) {
    return { sources: [], insufficientKnowledge: INSUFFICIENT_EVIDENCE };
  }
  return {
    sources: result.chunks.map((c, i) => ({
      index: i + 1,
      documentId: c.documentId,
      title: c.title,
      source: c.source,
      excerpt: excerpt(c.content),
      relevanceScore: c.relevanceScore,
      url: c.metadata.url,
    })),
    insufficientKnowledge: null,
  };
}

function metaFor(alert: SocAlert | null, confidence: number | null): ResponseMeta {
  return {
    alertRef: alert?.ref ?? null,
    techniqueId: alert?.techniqueId ?? null,
    confidence,
    generatedAt: new Date().toLocaleTimeString("en-GB", { hour12: false }),
  };
}

/** Evidence worth surfacing, capped so the panel stays scannable. */
function observed(alert: SocAlert): string[] {
  return alert.evidence.slice(0, 6).map((e) => `${e.label}: ${e.value}`);
}

/** Routes an action into a SOC response category by its verb. */
function categorise(action: string): ActionCategory {
  const a = action.toLowerCase();
  if (/isolat|block|contain|quarantin|revoke|disable/.test(a)) return "Containment";
  if (/collect|preserve|capture|gather|before remediation|before removal/.test(a)) return "Evidence";
  if (/reset|rotate|patch|policy|threshold|exclusion|lockout/.test(a)) return "Remediation";
  return "Investigation";
}

/** Finding -> Evidence -> Why it matters. Concise by construction: each field
 *  is a single clause, so the renderer never has to truncate a paragraph. */
function findingsFor(alert: SocAlert, analysis: AIInvestigationAnalysis, related: SocAlert[]): Finding[] {
  const out: Finding[] = [];

  out.push({
    finding: analysis.assessment.verdict.replace(/_/g, " ").toLowerCase(),
    evidence: `${analysis.assessment.supporting.length} supporting, ${analysis.assessment.contradicting.length} contradicting indicator(s)`,
    whyItMatters: analysis.assessment.guardrail ?? "Determines whether this warrants containment or closure.",
  });

  const key = alert.evidence[0];
  if (key) {
    out.push({
      finding: `${key.label} is the primary signal`,
      evidence: `${key.label}: ${key.value}`,
      whyItMatters: analysis.correlatedEvidence[0]?.significance ?? "Anchors the rest of the host timeline.",
    });
  }

  const sameHost = related.filter((a) => a.host === alert.host);
  out.push({
    finding: sameHost.length
      ? `Activity on ${alert.host} is not isolated`
      : `No corroborating activity on ${alert.host}`,
    evidence: sameHost.length
      ? sameHost.slice(0, 3).map((a) => a.ref).join(", ")
      : "No related alerts share this host",
    whyItMatters: sameHost.length
      ? "Multiple detections on one host usually describe a sequence rather than separate events."
      : "Isolated detections are more often benign, which lowers urgency.",
  });

  if (alert.techniqueId) {
    out.push({
      finding: `Maps to ${alert.techniqueId}`,
      evidence: analysis.mitreReasoning[0]?.whyRelevant ?? null,
      whyItMatters: `Places the activity in the ${analysis.mitreReasoning[0]?.tactic ?? "adversary"} stage of the chain.`,
    });
  }

  const factors = analysis.riskReasoning.length;
  if (factors > 0) {
    out.push({
      finding: `Risk ${alert.riskScore}/100 (${analysis.scorecard.priority})`,
      evidence: analysis.scorecard.priorityReason,
      whyItMatters: "Sets queue position relative to everything else open.",
    });
  }

  return out.slice(0, 5);
}

function actionsFor(analysis: AIInvestigationAnalysis): RecommendedAction[] {
  const mapped = analysis.recommendedResponseActions.map((a) => ({
    category: categorise(a.action),
    text: `${a.action} — ${a.reason}`,
  }));
  // Stable category order so the analyst always reads containment first.
  return ACTION_ORDER.flatMap((c) => mapped.filter((m) => m.category === c));
}

function contextLine(alert: SocAlert, related: SocAlert[]): string[] {
  return [
    `Alert ${alert.ref} — ${alert.title}`,
    `${alert.evidence.length} evidence field${alert.evidence.length === 1 ? "" : "s"} from the alert store`,
    related.length > 0
      ? `${related.length} correlated alert${related.length === 1 ? "" : "s"} sharing host, source or account`
      : "No correlated alerts share an entity with this one",
    alert.notes.length > 0
      ? `${alert.notes.length} investigation note${alert.notes.length === 1 ? "" : "s"}`
      : "No investigation notes recorded yet",
  ];
}

const NO_DATA: SocResponse = {
  title: "No alert data available",
  meta: { alertRef: null, techniqueId: null, confidence: null, generatedAt: "" },
  threatAssessment: null,
  observedEvidence: [],
  analysis: [
    {
      finding: "No alerts are present",
      evidence: "Alert store is empty",
      whyItMatters: "There is nothing to assess until detections exist.",
    },
  ],
  recommendedActions: [
    { category: "Investigation", text: "Upload logs in the Log Explorer or run a Simulation Lab scenario to generate detections." },
  ],
  nextSteps: ["Return here once alerts exist and ask again."],
  contextUsed: ["Alert store — empty"],
  sources: [],
  insufficientKnowledge: null,
  limitations: ["This assistant only reasons over data already present in the application."],
};

export class LocalChatEngine implements ChatProvider {
  readonly id = "rule_based" as const;
  readonly label = "Rule-based analysis";

  async respond(question: string, intent: ChatIntent, ctx: ChatContext): Promise<SocResponse> {
    if (intent === "incident_summary") return this.incidentSummary(ctx);
    if (intent === "general") return this.general(question, ctx);

    const alert = resolveAlert(question, ctx);
    if (!alert) return NO_DATA;

    const related = relatedTo(alert, ctx.alerts);
    // Single knowledge base: the same engine the Investigation panel uses.
    const analysis = await getProvider().analyzeInvestigation(buildContextFromAlert(alert, related));

    const retrieved = retrieveSources(question, alert.techniqueId ? [alert.techniqueId] : []);
    const base = {
      ...retrieved,
      meta: metaFor(alert, analysis.confidenceBreakdown.overall),
      threatAssessment: assessmentOf(alert, analysis),
      observedEvidence: observed(alert),
      contextUsed: contextLine(alert, related),
      limitations: analysis.limitations,
    };
    const findings = findingsFor(alert, analysis, related);
    const actions = actionsFor(analysis);

    switch (intent) {
      case "mitre":
        return {
          ...base,
          title: `MITRE ATT&CK mapping — ${alert.ref}`,
          analysis: analysis.mitreReasoning.length
            ? analysis.mitreReasoning.slice(0, 5).map((m) => ({
                finding: `${m.techniqueId} ${m.techniqueName}`,
                evidence: m.tactic,
                whyItMatters: `${m.whyRelevant} Mapping confidence ${Math.round(m.confidence * 100)}%.`,
              }))
            : [{
                finding: "No confident technique mapping",
                evidence: null,
                whyItMatters: "The available evidence does not implicate a specific technique.",
              }],
          recommendedActions: actions.slice(0, 3),
          nextSteps: analysis.threatHunting.slice(0, 4),
        };

      case "explain":
        return {
          ...base,
          title: `Explanation — ${alert.ref}`,
          analysis: [
            { finding: "What was detected", evidence: analysis.summary, whyItMatters: analysis.threatExplanation },
            { finding: "Probable root cause", evidence: null, whyItMatters: analysis.rootCause },
            ...findings.slice(1, 4),
          ].slice(0, 5),
          recommendedActions: actions.slice(0, 4),
          nextSteps: analysis.recommendedInvestigationSteps.slice(0, 3).map((st) => st.title),
        };

      case "investigate":
        return {
          ...base,
          title: `Investigation plan — ${alert.ref}`,
          analysis: findings,
          recommendedActions: analysis.threatHunting.slice(0, 4).map((h) => ({
            category: "Investigation" as ActionCategory,
            text: h,
          })),
          nextSteps: analysis.recommendedInvestigationSteps.slice(0, 4).map((st) => `${st.title} — ${st.reason}`),
        };

      case "response":
        return {
          ...base,
          title: `Recommended response — ${alert.ref}`,
          analysis: [
            {
              finding: analysis.assessment.verdict.replace(/_/g, " ").toLowerCase(),
              evidence: `Confidence ${analysis.assessment.confidence}%`,
              whyItMatters: analysis.assessment.guardrail ?? "Confidence is sufficient to act on the recommendations below.",
            },
            ...findings.slice(1, 4),
          ],
          recommendedActions: actions,
          nextSteps: analysis.recommendedInvestigationSteps.slice(0, 3).map((st) => st.title),
          limitations: [
            "Every action listed is a recommendation requiring analyst approval. Nothing is executed.",
            ...analysis.limitations,
          ],
        };

      case "analyze":
      default:
        return {
          ...base,
          title: `Threat analysis — ${alert.ref}`,
          analysis: findings,
          recommendedActions: actions,
          nextSteps: analysis.recommendedInvestigationSteps.slice(0, 4).map((st) => `${st.title} — ${st.reason}`),
        };
    }
  }

  private async incidentSummary(ctx: ChatContext): Promise<SocResponse> {
    const now = new Date().toLocaleTimeString("en-GB", { hour12: false });
    if (ctx.incidents.length === 0) {
      return {
        title: "Incident summary",
        meta: { alertRef: null, techniqueId: null, confidence: null, generatedAt: now },
        threatAssessment: null,
        observedEvidence: [],
        analysis: [{ finding: "No incidents tracked", evidence: "Incident store is empty", whyItMatters: "Nothing is currently under coordinated response." }],
        recommendedActions: [
          { category: "Investigation", text: "Escalate an alert from the Alerts or Investigation workspace to create one." },
        ],
        nextSteps: ["Review the alert queue for correlated activity worth escalating."],
        contextUsed: ["Incident store — empty"],
        sources: [],
        insufficientKnowledge: null,
        limitations: ["This assistant only reasons over data already present in the application."],
      };
    }

    const open = ctx.incidents.filter((i) => i.status !== "resolved");
    const ranked = [...ctx.incidents].sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.riskScore - a.riskScore
    );
    const top = ranked[0];
    const technique = top.techniqueIds[0]
      ? mitreTechniques.find((t) => t.technique_id === top.techniqueIds[0])
      : undefined;

    const incidentRetrieved = retrieveSources(
      "incident escalation triage containment summary",
      top.techniqueIds
    );

    return {
      ...incidentRetrieved,
      title: `Incident summary — ${top.ref}`,
      meta: {
        alertRef: top.alertRefs[0] ?? null,
        techniqueId: top.techniqueIds[0] ?? null,
        confidence: null,
        generatedAt: now,
      },
      threatAssessment: {
        severity: top.severity,
        riskScore: top.riskScore,
        priority: top.status.toUpperCase(),
        confidence: 0,
        verdict: top.status,
        techniqueId: technique?.technique_id ?? null,
        techniqueName: technique?.name ?? null,
        tactic: technique?.tactic ?? null,
        host: top.host,
        account: top.user ?? "—",
        source: top.sourceIp,
        destination: null,
      },
      observedEvidence: top.assets.map((a) => `${a.host} (${a.ip}) — ${a.status}, risk ${a.risk}`),
      analysis: [
        {
          finding: `${ctx.incidents.length} incident${ctx.incidents.length === 1 ? "" : "s"} tracked, ${open.length} open`,
          evidence: ranked.slice(0, 3).map((i) => `${i.ref} (${i.severity})`).join(", "),
          whyItMatters: "Defines current coordinated response load.",
        },
        {
          finding: `${top.ref} is highest priority`,
          evidence: `${top.title} · risk ${top.riskScore}/100 · ${top.alertRefs.length} correlated alert(s)`,
          whyItMatters: "Carries the greatest combination of severity and risk.",
        },
        {
          finding: top.techniqueIds.length ? "Technique chain identified" : "No techniques mapped",
          evidence: top.techniqueIds.length ? top.techniqueIds.join(" → ") : null,
          whyItMatters: top.techniqueIds.length
            ? "Indicates how far along the chain the activity progressed."
            : "Attribution rests on evidence alone.",
        },
        {
          finding: `${top.assets.length} asset(s) in scope`,
          evidence: top.assets.map((a) => a.host).join(", "),
          whyItMatters: "Bounds the containment surface.",
        },
      ],
      recommendedActions: ranked.slice(0, 3).map((i) => ({
        category: (i.status === "new" ? "Investigation" : "Containment") as ActionCategory,
        text: `${i.ref} — ${i.status === "new" ? "assign an analyst and begin triage" : `continue ${i.status}`} (${i.severity}).`,
      })),
      nextSteps: [
        `Open ${top.ref} and review its correlated alerts together.`,
        "Confirm containment status for each affected asset.",
        "Record findings as incident notes so the audit trail stays complete.",
      ],
      contextUsed: [
        `Incident store — ${ctx.incidents.length} incidents`,
        `Alert store — ${ctx.alerts.length} alerts`,
      ],
      limitations: [
        "Produced by a deterministic rule-based engine over simulated data.",
        "No external service was contacted and no model was consulted.",
      ],
    };
  }

  /** Unrelated questions get a data summary and NO threat assessment. The
   *  assistant must never manufacture an assessment it has no basis for. */
  private async general(question: string, ctx: ChatContext): Promise<SocResponse> {
    const openIncidents = ctx.incidents.filter((i) => i.status !== "resolved").length;
    const dash = buildDashboardContext(ctx.alerts, openIncidents, 248, false);
    const result = await getProvider().analyzeDashboard(dash, "summarize_alerts", question);

    const generalRetrieved = retrieveSources(question, []);

    return {
      ...generalRetrieved,
      title: "Current security posture",
      meta: {
        alertRef: null,
        techniqueId: null,
        confidence: null,
        generatedAt: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      },
      threatAssessment: null,
      observedEvidence: [],
      analysis: [
        {
          finding: "That question is outside what I can answer from the current data",
          evidence: null,
          whyItMatters: "I only reason over the alerts, incidents and techniques present in this application, so I will not speculate.",
        },
        {
          finding: result.summary,
          evidence: dash.topTechniques.map((t) => `${t.id} ×${t.count}`).join(", ") || null,
          whyItMatters: "Summarises what is actually in the queue right now.",
        },
      ],
      recommendedActions: result.recommendedSteps.slice(0, 3).map((st) => ({
        category: "Investigation" as ActionCategory,
        text: `${st.title} — ${st.reason}`,
      })),
      nextSteps: [
        'Ask about a specific alert by reference, for example "Analyze ALT-10492".',
        "Use the quick actions above for a focused answer.",
      ],
      contextUsed: [
        `Alert store — ${ctx.alerts.length} alerts`,
        `Incident store — ${ctx.incidents.length} incidents`,
      ],
      limitations: result.limitations,
    };
  }
}

