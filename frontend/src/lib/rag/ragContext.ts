/* ---------------------------------------------------------------------------
   RAG context builder.

   Assembles the prompt-shaped context a model would receive, with each block
   clearly labelled by ORIGIN. The separation is the point: an analyst — and
   later a model — must be able to tell what came from this application versus
   what came from the knowledge base, because only the former is evidence.
--------------------------------------------------------------------------- */
import { retrieve } from "./retriever";
import type { RetrievalResult } from "./types";
import type { SocAlert } from "../../mocks/alertStore";
import type { SocIncident } from "../../mocks/incidentStore";

export interface RagContextInput {
  question: string;
  alert?: SocAlert | null;
  incident?: SocIncident | null;
  relatedAlerts?: SocAlert[];
  topK?: number;
}

export interface RagContext {
  /** Labelled, model-ready text. */
  prompt: string;
  retrieval: RetrievalResult;
  /** Origin accounting, surfaced in the UI. */
  origins: { application: string[]; knowledgeBase: string[] };
}

export function buildRagContext(input: RagContextInput): RagContext {
  const { question, alert, incident, relatedAlerts = [], topK } = input;

  const retrieval = retrieve({
    text: question,
    techniqueIds: alert?.techniqueId ? [alert.techniqueId] : incident?.techniqueIds ?? [],
    topK,
  });

  const application: string[] = [];
  const sections: string[] = [];

  if (alert) {
    application.push(`Alert ${alert.ref} from the alert store`);
    sections.push(
      [
        "CURRENT ALERT (source: SOCGenie application data)",
        `  Reference: ${alert.ref}`,
        `  Title: ${alert.title}`,
        `  Severity: ${alert.severity}   Risk: ${alert.riskScore}/100   Status: ${alert.status}`,
        `  Host: ${alert.host}   Account: ${alert.user ?? "—"}`,
        `  Source: ${alert.sourceIp}${alert.destinationIp ? `   Destination: ${alert.destinationIp}` : ""}`,
        `  Technique: ${alert.techniqueId ?? "none mapped"}`,
        `  Detection source: ${alert.detectionSource}`,
      ].join("\n")
    );

    application.push(`${alert.evidence.length} evidence fields recorded on ${alert.ref}`);
    sections.push(
      [
        "OBSERVED EVIDENCE (source: SOCGenie application data)",
        ...alert.evidence.map((e) => `  ${e.label}: ${e.value}`),
      ].join("\n")
    );
  }

  if (incident) {
    application.push(`Incident ${incident.ref} from the incident store`);
    sections.push(
      [
        "CURRENT INCIDENT (source: SOCGenie application data)",
        `  Reference: ${incident.ref}   Status: ${incident.status}`,
        `  Severity: ${incident.severity}   Risk: ${incident.riskScore}/100`,
        `  Correlated alerts: ${incident.alertRefs.join(", ") || "none"}`,
        `  Techniques: ${incident.techniqueIds.join(", ") || "none mapped"}`,
      ].join("\n")
    );
  }

  if (relatedAlerts.length > 0) {
    application.push(`${relatedAlerts.length} correlated alerts sharing an entity`);
    sections.push(
      [
        "RELATED ALERTS (source: SOCGenie application data)",
        ...relatedAlerts.slice(0, 5).map((a) => `  ${a.ref} — ${a.title} (${a.severity}) on ${a.host}`),
      ].join("\n")
    );
  }

  const knowledgeBase = retrieval.chunks.map((c) => `${c.source} — ${c.title}`);
  sections.push(
    retrieval.insufficient
      ? "RETRIEVED KNOWLEDGE (source: local curated knowledge base)\n  No document cleared the relevance threshold."
      : [
          "RETRIEVED KNOWLEDGE (source: local curated knowledge base — NOT live threat intelligence)",
          ...retrieval.chunks.map(
            (c, i) =>
              `  [${i + 1}] ${c.source} — ${c.title} (relevance ${c.relevanceScore.toFixed(2)}, matched on ${c.metadata.matchedOn.join("; ")})\n      ${c.content}`
          ),
        ].join("\n")
  );

  sections.push(`ANALYST QUESTION\n  ${question}`);

  return {
    prompt: sections.join("\n\n"),
    retrieval,
    origins: { application, knowledgeBase },
  };
}
