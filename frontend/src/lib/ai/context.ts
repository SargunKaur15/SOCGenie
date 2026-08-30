/* ---------------------------------------------------------------------------
   Context builders.

   These extract the minimum an analyst would reason over. Application state is
   never passed wholesale, and everything here is derived from the existing
   stores — no new data source is introduced.
--------------------------------------------------------------------------- */
import type { SocAlert } from "../../mocks/alertStore";
import type { InvestigationView } from "../../mocks/investigationStore";
import { mitreTechniques } from "../data/fixtures";
import { buildRiskFactors, buildTechniqueIds, buildTimeline } from "../../mocks/investigation";
import { INVESTIGATION_STATUS_LABEL } from "../../mocks/investigationStore";
import type { DashboardContext, InvestigationContext } from "./types";
import type { Severity } from "../types";

export function buildInvestigationContext(
  view: InvestigationView,
  relatedAlerts: SocAlert[]
): InvestigationContext {
  const alert = view.alert;
  const technique = alert.techniqueId
    ? mitreTechniques.find((t) => t.technique_id === alert.techniqueId)
    : undefined;

  return {
    kind: "investigation",
    investigationId: view.investigationId,
    alertRef: alert.ref,
    title: alert.title,
    severity: alert.severity,
    riskScore: alert.riskScore,
    status: INVESTIGATION_STATUS_LABEL[view.status],
    detectionSource: alert.detectionSource,
    host: alert.host,
    user: alert.user,
    sourceIp: alert.sourceIp,
    destinationIp: alert.destinationIp,
    techniqueId: alert.techniqueId,
    techniqueName: technique?.name ?? null,
    tactic: technique?.tactic ?? null,
    relatedTechniqueIds: buildTechniqueIds(alert),
    evidence: alert.evidence,
    riskFactors: buildRiskFactors(alert),
    relatedAlerts: relatedAlerts.slice(0, 6).map((a) => ({
      ref: a.ref,
      title: a.title,
      severity: a.severity,
      host: a.host,
    })),
    timelineTypes: buildTimeline(alert).map((e) => e.type),
    noteCount: alert.notes.length,
  };
}

/**
 * Builds investigation context directly from an alert.
 *
 * The chat can be asked about any alert, including ones with no investigation
 * record yet, so a minimal view is synthesised rather than requiring the
 * overlay store. Same fields, same downstream analysis.
 */
export function buildContextFromAlert(
  alert: SocAlert,
  relatedAlerts: SocAlert[]
): InvestigationContext {
  const view: InvestigationView = {
    alertRef: alert.ref,
    investigationId: `INV-2026-${alert.ref.replace(/\D/g, "")}`,
    status: alert.status === "resolved" ? "resolved" : alert.status === "investigating" ? "investigating" : "new",
    assignedTo: null,
    openedMinutesAgo: alert.minutesAgo,
    updatedMinutesAgo: alert.minutesAgo,
    activity: [],
    alert,
  };
  return buildInvestigationContext(view, relatedAlerts);
}

export function buildDashboardContext(
  alerts: SocAlert[],
  openIncidents: number,
  endpointsMonitored: number,
  mlEngineTrained: boolean
): DashboardContext {
  const count = (s: Severity) => alerts.filter((a) => a.severity === s).length;

  // Technique frequency across the current alert set.
  const techCounts = new Map<string, number>();
  for (const a of alerts) {
    if (!a.techniqueId) continue;
    techCounts.set(a.techniqueId, (techCounts.get(a.techniqueId) ?? 0) + 1);
  }
  const topTechniques = [...techCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, c]) => ({
      id,
      name: mitreTechniques.find((t) => t.technique_id === id)?.name ?? id,
      count: c,
    }));

  // Hosts appearing more than once — the clearest multi-stage indicator.
  const hostCounts = new Map<string, number>();
  for (const a of alerts) hostCounts.set(a.host, (hostCounts.get(a.host) ?? 0) + 1);
  const repeatedHosts = [...hostCounts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([host, c]) => ({ host, count: c }));

  const rank: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const topAlerts = [...alerts]
    .sort((a, b) => rank[b.severity] - rank[a.severity] || b.riskScore - a.riskScore)
    .slice(0, 5)
    .map((a) => ({
      ref: a.ref,
      title: a.title,
      severity: a.severity,
      host: a.host,
      riskScore: a.riskScore,
    }));

  return {
    kind: "dashboard",
    criticalAlerts: count("critical"),
    highAlerts: count("high"),
    mediumAlerts: count("medium"),
    lowAlerts: count("low"),
    openIncidents,
    totalAlerts: alerts.length,
    endpointsMonitored,
    topTechniques,
    topAlerts,
    repeatedHosts,
    mlEngineTrained,
  };
}

/** Maps a free-text question onto an intent. Deliberately simple keyword
 *  matching — it is honest about being rule-based rather than pretending to
 *  parse natural language. */
export function classifyQuestion(question: string) {
  const q = question.toLowerCase();
  if (/first|priorit|triage|start|next/.test(q)) return "triage_priority" as const;
  if (/mitre|technique|tactic|att&ck|attack/.test(q)) return "explain_top_threat" as const;
  if (/relat|connect|pattern|correlat|multi|chain/.test(q)) return "suspicious_patterns" as const;
  if (/postur|overall|today|health|summar[iy]s?e today|status/.test(q)) return "security_posture" as const;
  if (/alert|critical|increas|volume/.test(q)) return "summarize_alerts" as const;
  return "unknown" as const;
}
