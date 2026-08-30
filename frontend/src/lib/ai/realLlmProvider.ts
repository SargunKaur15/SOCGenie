/* ---------------------------------------------------------------------------
   Real model provider — INTERFACE ONLY, deliberately not connected.

   This exists so the swap point is real rather than hypothetical. It satisfies
   ChatProvider but performs no inference and contacts nothing. Every method
   fails loudly rather than returning a plausible-looking answer, because a
   provider that silently degrades to invention is worse than one that is
   absent.

   WHEN THIS IS EVENTUALLY CONNECTED, it must call a BACKEND PROXY, never a
   model API directly. An API key placed in frontend code is readable by anyone
   who opens the network tab; there is no configuration that makes that safe.
   No key, no endpoint and no environment variable is read here today.
--------------------------------------------------------------------------- */
import type { ChatContext, ChatIntent, ChatProvider, SocResponse, KnowledgeCitation } from "./chat";
import { postChat, cachedBackendStatus, type BackendChatSuccess } from "./backendClient";
import { resolveAlert } from "./chatEngine";

export const REAL_PROVIDER_NOT_CONFIGURED = "REAL MODEL PROVIDER NOT CONFIGURED";

export class RealLLMProvider implements ChatProvider {
  readonly id = "llm" as const;
  readonly label = "Real model — not configured";

  /**
   * True only when the backend proxy has been probed AND reports a configured
   * provider. Derived from the server, never from a client env var — a
   * VITE_ variable could be set without a key existing and would then claim a
   * connection that does not exist.
   */
  static isConfigured(): boolean {
    const status = cachedBackendStatus();
    return status !== null && status.reachable && status.configured;
  }

  async respond(question: string, intent: ChatIntent, context: ChatContext): Promise<SocResponse> {
    // Phase 17: `void intent;` stood here, discarding the parameter. Analyze,
    // Explain, MITRE, Investigate and Response therefore reached the model with
    // one shared instruction set and produced near-identical answers.
    if (!RealLLMProvider.isConfigured()) {
      throw new Error(REAL_PROVIDER_NOT_CONFIGURED);
    }

    // Send only what the server needs: the question plus the alert in scope.
    // Application state is never shipped wholesale.
    const alert = resolveAlert(question, context);
    const res = await postChat(
      question,
      alert
        ? {
            alertRef: alert.ref,
            host: alert.host,
            techniqueId: alert.techniqueId ?? undefined,
            severity: alert.severity,
            evidence: alert.evidence,
          }
        : undefined,
      intent
    );

    // Throwing lets the caller fall back to the deterministic engine. Returning
    // a plausible-looking answer here would be the failure mode this whole
    // architecture exists to prevent.
    if (!res.ok) throw new Error(res.error);

    return toSocResponse(res, alert?.ref ?? null, intent);
  }
}

/** Maps the proxy payload onto the existing SOCGenie contract, so the UI is
 *  unchanged whether the answer came from the model or the local engine. */
function toSocResponse(res: BackendChatSuccess, alertRef: string | null, intent: string): SocResponse {
  const r = res.result;
  const sources: KnowledgeCitation[] = res.sources.map((s) => ({
    index: s.index,
    documentId: s.documentId,
    title: s.title,
    // Reference material is labelled at the citation, so an analyst can see at
    // a glance which sources bear on this alert and which are background.
    source: s.evidenced ? s.source : `${s.source} · reference`,
    excerpt: s.excerpt,
    relevanceScore: s.relevanceScore,
    url: s.url,
  }));

  const INTENT_TITLE: Record<string, string> = {
    analyze: "Threat assessment",
    explain: "Explanation",
    mitre: "MITRE ATT&CK mapping",
    investigate: "Investigation plan",
    response: "Recommended response",
    incident_summary: "Incident summary",
    general: "AI analysis",
  };
  const heading = INTENT_TITLE[intent] ?? "AI analysis";

  return {
    title: alertRef ? `${heading} — ${alertRef}` : heading,
    meta: {
      alertRef,
      // Evidenced only. Contextual techniques must never become the primary
      // mapping, which is exactly what the grounding fix prevents.
      techniqueId: r.mitreTechniques[0] ?? null,
      confidence: r.confidence,
      generatedAt: new Date().toLocaleTimeString("en-GB", { hour12: false }),
    },
    threatAssessment: null,
    observedEvidence: r.observed,
    analysis: [
      { finding: r.answer, evidence: null, whyItMatters: "Model-generated analysis, grounded in the retrieved context." },
      ...r.inferred.map((i) => ({
        finding: "Inferred",
        evidence: null,
        whyItMatters: i,
      })),
    ].slice(0, 5),
    recommendedActions: r.recommended.map((text) => ({ category: "Investigation" as const, text })),
    nextSteps: r.warnings.length > 0 ? r.warnings : ["Validate this analysis against the alert evidence before acting."],
    contextUsed: [
      `Model: ${res.model} via the SOCGenie backend proxy`,
      res.redactionApplied.length > 0
        ? `Redaction applied before sending: ${res.redactionApplied.join(", ")}`
        : "No credential patterns were detected in the outbound context",
    ],
    sources,
    insufficientKnowledge: r.insufficientEvidence ? res.insufficientKnowledge : res.insufficientKnowledge,
    limitations: [
      "Generated by an external model through the backend proxy. Treat as advisory.",
      ...(r.contextualTechniques.length > 0
        ? [
            `Reference only, NOT assessed for this alert: ${r.contextualTechniques.join(", ")}. These appear in retrieved knowledge but are not supported by this alert's evidence.`,
          ]
        : []),
      ...r.guardWarnings,
      "Technique IDs not present in the retrieved context were removed before display.",
      "All recommendations require analyst approval. Nothing is executed.",
    ],
  };
}
