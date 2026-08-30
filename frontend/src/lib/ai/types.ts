/* ---------------------------------------------------------------------------
   SOCGenie AI layer — contracts.

   ARCHITECTURE (locked in PRD v2.0 §21):
       UI -> context builder -> AIProvider -> typed response

   The provider is an interface so a real model can be connected later without
   touching a component. The shipped implementation is deterministic and
   rule-based; it consults no external service and makes no detection decision.
   Detection remains the responsibility of the rule engine and, in a later
   phase, the trained models.
--------------------------------------------------------------------------- */
import type { Severity } from "../types";

export type Priority = "high" | "medium" | "low";

/** How the analysis was produced. Displayed verbatim in the UI — never
 *  presented as a connected external model unless one genuinely is. */
export type AnalysisSource = "rule_based" | "llm";

// ── Context passed to the provider ───────────────────────────────────────────

/** Only the fields an analyst would actually reason over. Application state is
 *  never passed wholesale. */
export interface InvestigationContext {
  kind: "investigation";
  investigationId: string;
  alertRef: string;
  title: string;
  severity: Severity;
  riskScore: number;
  status: string;
  detectionSource: string;
  host: string;
  user: string | null;
  sourceIp: string;
  destinationIp: string | null;
  techniqueId: string | null;
  techniqueName: string | null;
  tactic: string | null;
  /** Adjacent techniques in the same chain. */
  relatedTechniqueIds: string[];
  evidence: { label: string; value: string }[];
  riskFactors: { label: string; weight: number; present: boolean }[];
  relatedAlerts: { ref: string; title: string; severity: Severity; host: string }[];
  timelineTypes: string[];
  noteCount: number;
}

export interface DashboardContext {
  kind: "dashboard";
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  openIncidents: number;
  totalAlerts: number;
  endpointsMonitored: number;
  topTechniques: { id: string; name: string; count: number }[];
  topAlerts: { ref: string; title: string; severity: Severity; host: string; riskScore: number }[];
  /** Hosts appearing in more than one alert — the multi-stage signal. */
  repeatedHosts: { host: string; count: number }[];
  mlEngineTrained: boolean;
}

export type AnalysisContext = InvestigationContext | DashboardContext;

// ── Provider output ──────────────────────────────────────────────────────────

export interface MitreReasoning {
  techniqueId: string;
  techniqueName: string;
  tactic: string | null;
  whyRelevant: string;
  /** 0-1. A deterministic weight derived from observed evidence, not a model
   *  probability. Labelled as such wherever it is displayed. */
  confidence: number;
}

export interface CorrelatedEvidence {
  evidence: string;
  significance: string;
}

export interface RecommendedStep {
  title: string;
  reason: string;
  priority: Priority;
}

export interface RecommendedAction {
  action: string;
  reason: string;
  priority: Priority;
  /** Every action is advisory. Kept explicit so the UI cannot forget it. */
  requiresApproval: true;
}


// ── Assessment layer (Phase 7 V3) ────────────────────────────────────────────

export type Priority4 = "P1" | "P2" | "P3" | "P4";

export type Verdict =
  | "LIKELY_FALSE_POSITIVE"
  | "POSSIBLE_FALSE_POSITIVE"
  | "UNCERTAIN"
  | "POSSIBLE_TRUE_POSITIVE"
  | "LIKELY_TRUE_POSITIVE";

export const VERDICT_LABEL: Record<Verdict, string> = {
  LIKELY_FALSE_POSITIVE: "Likely false positive",
  POSSIBLE_FALSE_POSITIVE: "Possible false positive",
  UNCERTAIN: "Uncertain",
  POSSIBLE_TRUE_POSITIVE: "Possible true positive",
  LIKELY_TRUE_POSITIVE: "Likely true positive",
};

export type EvidenceStrength = "LOW" | "MODERATE" | "HIGH";
export type BlastRadius = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Each component is computed from a documented rule; see intelligenceEngine. */
export interface ConfidenceBreakdown {
  evidenceStrength: number;
  correlationStrength: number;
  behaviourConfidence: number;
  mitreConfidence: number;
  overall: number;
  /** One line per component explaining what drove it. */
  explanation: string[];
}

export interface Scorecard {
  threatLikelihood: number;
  falsePositiveLikelihood: number;
  evidenceStrength: EvidenceStrength;
  confidence: number;
  riskScore: number;
  riskLevel: Severity;
  blastRadius: BlastRadius;
  priority: Priority4;
  priorityReason: string;
}

export interface VerdictAssessment {
  verdict: Verdict;
  confidence: number;
  supporting: string[];
  contradicting: string[];
  /** Set when evidence is thin, conflicting or confidence is low. */
  guardrail: string | null;
}

/** OBSERVED / INFERRED / RECOMMENDED, kept structurally distinct so inference
 *  can never be rendered as fact. */
export interface ReasoningTriad {
  observed: string[];
  inferred: string[];
  recommended: string[];
}

export interface EvidenceChainItem {
  /** Reference to real application data — an alert ref or evidence label.
   *  Never a fabricated identifier. */
  id: string;
  time: string | null;
  type: string;
  source: string;
  summary: string;
  relevance: string;
}

export interface IocFinding {
  indicator: string;
  type: "ip" | "host" | "user" | "process" | "domain";
  classification: "TRUSTED" | "UNKNOWN" | "SUSPICIOUS" | "INDICATOR_MATCH";
  rationale: string;
}

export interface AnomalyFinding {
  observed: string;
  interpretation: string;
}

export interface AttackStoryStep {
  time: string;
  event: string;
  tactic: string | null;
  important: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: "user" | "host" | "process" | "ip" | "alert" | "technique";
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface AffectedAssets {
  confirmed: { asset: string; reason: string }[];
  potential: { asset: string; reason: string }[];
}

export interface ReplayStep {
  step: string;
  status: "complete" | "skipped";
  detail: string;
  evidenceCount: number | null;
}

export interface DedupSummary {
  groupedCount: number;
  reason: string;
}

export interface AIInvestigationAnalysis {
  kind: "investigation";
  source: AnalysisSource;
  generatedAt: string;
  summary: string;
  threatExplanation: string;
  threatLevel: Severity;
  riskReasoning: string[];
  mitreReasoning: MitreReasoning[];
  correlatedEvidence: CorrelatedEvidence[];
  recommendedInvestigationSteps: RecommendedStep[];
  recommendedResponseActions: RecommendedAction[];
  confidence: number;
  followUpQuestions: string[];
  /** Stated openly wherever the analysis is shown. */
  limitations: string[];

  scorecard: Scorecard;
  confidenceBreakdown: ConfidenceBreakdown;
  assessment: VerdictAssessment;
  triad: ReasoningTriad;
  evidenceChain: EvidenceChainItem[];
  iocFindings: IocFinding[];
  anomalies: AnomalyFinding[];
  attackStory: AttackStoryStep[];
  attackChain: string[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  affectedAssets: AffectedAssets;
  rootCause: string;
  threatHunting: string[];
  executiveSummary: string;
  technicalSummary: string[];
  replay: ReplayStep[];
  dedup: DedupSummary | null;
  /** No historical snapshots exist, so this is honestly reported as such. */
  whatChanged: string[];
}

/** Free-form and quick-action answers share one shape so the panel renders
 *  both with a single component. */
export interface AIDashboardAnalysis {
  kind: "dashboard";
  source: AnalysisSource;
  generatedAt: string;
  title: string;
  summary: string;
  sections: { heading: string; lines: string[] }[];
  recommendedSteps: RecommendedStep[];
  confidence: number;
  followUpQuestions: string[];
  limitations: string[];
}

export type AIAnalysis = AIInvestigationAnalysis | AIDashboardAnalysis;

export type DashboardIntent =
  | "summarize_alerts"
  | "explain_top_threat"
  | "security_posture"
  | "suspicious_patterns"
  | "triage_priority"
  | "unknown";

/** Implement this to connect a real model in a future phase. */
export interface AIProvider {
  readonly id: AnalysisSource;
  readonly label: string;
  analyzeInvestigation(context: InvestigationContext): Promise<AIInvestigationAnalysis>;
  analyzeDashboard(context: DashboardContext, intent: DashboardIntent, question?: string): Promise<AIDashboardAnalysis>;
}
