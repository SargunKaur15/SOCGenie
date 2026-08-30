/* ---------------------------------------------------------------------------
   Conversational layer contracts.

   Sits ALONGSIDE the existing AIProvider rather than replacing it. The chat
   engine delegates to analyzeInvestigation / analyzeDashboard, so the curated
   security knowledge lives in exactly one place.

   ChatProvider is the seam a real model or RAG pipeline plugs into later: the
   UI depends only on this interface, never on a concrete engine.
--------------------------------------------------------------------------- */
import type { AnalysisSource } from "./types";
import type { Severity } from "../types";
import type { SocAlert } from "../../mocks/alertStore";
import type { SocIncident } from "../../mocks/incidentStore";

export type ChatRole = "user" | "assistant";

export type ChatIntent =
  | "analyze"
  | "explain"
  | "mitre"
  | "investigate"
  | "response"
  | "incident_summary"
  | "general";

export const QUICK_ACTIONS: { intent: ChatIntent; label: string; prompt: string }[] = [
  { intent: "analyze", label: "Analyze", prompt: "Analyze the latest critical alert" },
  { intent: "explain", label: "Explain", prompt: "Explain this alert in plain language" },
  { intent: "mitre", label: "MITRE mapping", prompt: "Map this alert to MITRE ATT&CK" },
  { intent: "investigate", label: "Investigate", prompt: "What should I investigate next?" },
  { intent: "response", label: "Response", prompt: "Recommend a response for this alert" },
  { intent: "incident_summary", label: "Incident summary", prompt: "Generate an incident summary" },
];

export const SUGGESTED_PROMPTS = [
  "Analyze the latest critical alert",
  "Explain this PowerShell alert",
  "Map this alert to MITRE ATT&CK",
  "What should I investigate next?",
  "Generate an incident summary",
];

/** SOC analyst response format.
 *
 * Fields are TYPED, not pre-formatted sentences. The renderer builds chips from
 * these directly, so the presentation layer no longer parses strings out of
 * prose — a fragility in the previous version.
 */
export interface ThreatAssessment {
  severity: Severity;
  riskScore: number;
  priority: string;
  /** 0-100. A deterministic weight, not a model probability. */
  confidence: number;
  verdict: string;
  techniqueId: string | null;
  techniqueName: string | null;
  tactic: string | null;
  host: string;
  account: string;
  source: string;
  destination: string | null;
}

export type ActionCategory = "Containment" | "Investigation" | "Evidence" | "Remediation";

export const ACTION_ORDER: ActionCategory[] = ["Containment", "Investigation", "Evidence", "Remediation"];

export interface RecommendedAction {
  category: ActionCategory;
  text: string;
}

/** Shown at the head of every reply so the analyst can cite it. */
export interface ResponseMeta {
  alertRef: string | null;
  techniqueId: string | null;
  confidence: number | null;
  generatedAt: string;
}

/** A citation for one retrieved knowledge document. */
export interface KnowledgeCitation {
  index: number;
  documentId: string;
  title: string;
  source: string;
  excerpt: string;
  relevanceScore: number;
  /** Only present when a genuine public URL exists. Never fabricated. */
  url: string | null;
}

/** One concise finding in Finding -> Evidence -> Why it matters form. */
export interface Finding {
  finding: string;
  evidence: string | null;
  whyItMatters: string;
}

export interface SocResponse {
  title: string;
  meta: ResponseMeta;
  threatAssessment: ThreatAssessment | null;
  /** Raised separately from the assessment so it can be scanned quickly. */
  observedEvidence: string[];
  analysis: Finding[];
  recommendedActions: RecommendedAction[];
  nextSteps: string[];
  /** Transparency: exactly which application data the answer was built from. */
  contextUsed: string[];
  /** Retrieved knowledge backing this answer. Empty when nothing cleared the
   *  relevance floor — in which case `insufficientKnowledge` is set. */
  sources: KnowledgeCitation[];
  /** Set to the standard message when retrieval found nothing usable. */
  insufficientKnowledge: string | null;
  limitations: string[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  createdAt: string;
  /** User messages carry text; assistant messages carry a structured response. */
  text?: string;
  response?: SocResponse;
}

/** Live application data handed to the engine. Nothing is fetched or invented. */
export interface ChatContext {
  alerts: SocAlert[];
  incidents: SocIncident[];
  /** Optional focus, e.g. an alert the analyst already has open. */
  focusAlertRef?: string | null;
}

export interface ChatProvider {
  readonly id: AnalysisSource;
  readonly label: string;
  respond(question: string, intent: ChatIntent, context: ChatContext): Promise<SocResponse>;
}
