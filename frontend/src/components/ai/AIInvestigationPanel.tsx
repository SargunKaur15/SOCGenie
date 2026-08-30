import { useState } from "react";
import { Sparkles, RefreshCw, AlertTriangle, ClipboardCopy, Check, ChevronDown } from "lucide-react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { AIScorecard } from "./AIScorecard";
import { AIAssessment, AIWhyList } from "./AIAssessment";
import { AIEvidenceChain } from "./AIEvidenceChain";
import { AIAttackStory } from "./AIAttackStory";
import { AIPlan } from "./AIPlan";
import { AIReplay } from "./AIReplay";
import { AIAnalystDecision } from "./AIAnalystDecision";
import { ANALYSIS_STAGES, type AiState } from "../../hooks/useAiSocGenie";
import type { AIInvestigationAnalysis } from "../../lib/ai/types";
import type { AnalystDecision, DecisionRecord } from "../../mocks/decisionStore";

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-semibold text-text-primary">{title}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function AIInvestigationPanel({
  state,
  providerLabel,
  decisions,
  onAnalyze,
  onRecordDecision,
  onAddToNotes,
}: {
  state: AiState<AIInvestigationAnalysis>;
  providerLabel: string;
  decisions: DecisionRecord[];
  onAnalyze: () => void;
  onRecordDecision: (decision: AnalystDecision, reason: string) => void;
  onAddToNotes: (summary: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Never claims a model is connected. */}
      <Badge tone="neutral">{providerLabel}</Badge>
      {state.status === "ready" && (
        <Button icon={RefreshCw} onClick={onAnalyze}>Re-analyse</Button>
      )}
    </div>
  );

  return (
    <Panel eyebrow="AI SOCGenie" title="Automated Analysis" actions={header}>
      {state.status === "idle" && (
        <div className="py-2">
          <p className="text-xs leading-relaxed text-text-secondary">
            Run a first-pass analysis of this investigation. The engine reads the alert, its
            evidence and any correlated alerts, then produces an assessment for you to validate.
          </p>
          <p className="mt-2 text-2xs leading-relaxed text-text-muted">
            Analysis is produced by a local deterministic engine. No external service is contacted,
            no model is trained, and nothing it recommends is executed.
          </p>
          <Button variant="primary" icon={Sparkles} onClick={onAnalyze} className="mt-3">
            Analyse with AI SOCGenie
          </Button>
        </div>
      )}

      {state.status === "running" && (
        <div className="py-2">
          <ol className="space-y-1">
            {ANALYSIS_STAGES.map((s, i) => (
              <li
                key={s}
                className={`flex items-center gap-2 text-2xs ${
                  i < state.stage ? "text-text-secondary" : i === state.stage ? "text-accent" : "text-text-muted"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    i < state.stage ? "bg-status-success" : i === state.stage ? "bg-accent" : "bg-text-muted/40"
                  }`}
                />
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      {state.status === "error" && (
        <div className="py-2">
          <p className="flex items-start gap-2 rounded-md border border-status-medium/30 bg-status-medium/[0.06] px-3 py-2.5 text-2xs leading-relaxed text-text-secondary">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
            <span>
              <span className="font-medium text-text-primary">Automated analysis unavailable. </span>
              {state.message} Manual investigation is unaffected — every panel on this page continues
              to work without it.
            </span>
          </p>
          <Button icon={RefreshCw} onClick={onAnalyze} className="mt-3">Try again</Button>
        </div>
      )}

      {state.status === "ready" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs leading-relaxed text-text-primary">{state.result.summary}</p>
            <p className="mt-2 text-2xs leading-relaxed text-text-secondary">
              {state.result.threatExplanation}
            </p>
          </div>

          <AIScorecard scorecard={state.result.scorecard} breakdown={state.result.confidenceBreakdown} />

          <Section title="Assessment">
            <AIAssessment assessment={state.result.assessment} triad={state.result.triad} />
          </Section>

          <Section title="Why this conclusion">
            <AIWhyList reasons={state.result.riskReasoning} />
          </Section>

          <Section title="Evidence, indicators and anomalies" defaultOpen={false}>
            <AIEvidenceChain
              chain={state.result.evidenceChain}
              iocs={state.result.iocFindings}
              anomalies={state.result.anomalies}
            />
          </Section>

          <Section title="Attack story and scope" defaultOpen={false}>
            <AIAttackStory
              story={state.result.attackStory}
              chain={state.result.attackChain}
              graph={state.result.graph}
              assets={state.result.affectedAssets}
              rootCause={state.result.rootCause}
            />
          </Section>

          <Section title="MITRE reasoning" defaultOpen={false}>
            <ul className="space-y-2">
              {state.result.mitreReasoning.map((m) => (
                <li key={m.techniqueId} className="rounded-md border border-border bg-bg-elevated px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs text-text-primary">
                      <span className="mono mr-1.5 text-accent">{m.techniqueId}</span>
                      {m.techniqueName}
                    </span>
                    <span className="mono text-2xs tabular text-text-muted">
                      {Math.round(m.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-2xs text-text-muted">{m.tactic}</p>
                  <p className="mt-1 text-2xs leading-relaxed text-text-secondary">{m.whyRelevant}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Recommended actions">
            <AIPlan
              steps={state.result.recommendedInvestigationSteps}
              actions={state.result.recommendedResponseActions}
              hunting={state.result.threatHunting}
            />
          </Section>

          <Section title="Decision">
            <AIAnalystDecision history={decisions} onRecord={onRecordDecision} />
          </Section>

          <Section title="Reports and handoff" defaultOpen={false}>
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  Executive summary
                </p>
                <p className="text-2xs leading-relaxed text-text-secondary">{state.result.executiveSummary}</p>
              </div>
              <div>
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  Technical summary
                </p>
                <ul className="space-y-1">
                  {state.result.technicalSummary.map((t) => (
                    <li key={t} className="text-2xs leading-relaxed text-text-secondary">• {t}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  icon={copied ? Check : ClipboardCopy}
                  onClick={async () => {
                    const text = [
                      "SOCGenie investigation handoff",
                      "",
                      "EXECUTIVE SUMMARY",
                      state.result.executiveSummary,
                      "",
                      "TECHNICAL SUMMARY",
                      ...state.result.technicalSummary.map((t) => `- ${t}`),
                      "",
                      "OUTSTANDING QUESTIONS",
                      ...state.result.followUpQuestions.map((q) => `- ${q}`),
                      "",
                      "LIMITATIONS",
                      ...state.result.limitations.map((l) => `- ${l}`),
                    ].join("\n");
                    try {
                      await navigator.clipboard.writeText(text);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1600);
                    } catch {
                      /* clipboard unavailable — non-fatal */
                    }
                  }}
                >
                  {copied ? "Copied" : "Copy handoff summary"}
                </Button>
                <Button onClick={() => onAddToNotes(state.result.executiveSummary)}>
                  Add summary to notes
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Outstanding questions" defaultOpen={false}>
            <ul className="space-y-1">
              {state.result.followUpQuestions.map((q) => (
                <li key={q} className="text-2xs leading-relaxed text-text-secondary">• {q}</li>
              ))}
            </ul>
          </Section>

          <Section title="How this was produced" defaultOpen={false}>
            <AIReplay steps={state.result.replay} />
          </Section>

          <Section title="Limitations" defaultOpen={false}>
            <ul className="space-y-1">
              {state.result.limitations.map((l) => (
                <li key={l} className="text-2xs leading-relaxed text-text-muted">• {l}</li>
              ))}
              {state.result.whatChanged.map((w) => (
                <li key={w} className="text-2xs leading-relaxed text-text-muted">• {w}</li>
              ))}
              {state.result.dedup && (
                <li className="text-2xs leading-relaxed text-text-muted">• {state.result.dedup.reason}</li>
              )}
            </ul>
          </Section>
        </div>
      )}
    </Panel>
  );
}
