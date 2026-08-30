import { useMemo, useState } from "react";
import {
  Sparkles, Send, Search, BookOpen, Target, ScanSearch, ShieldCheck,
  RotateCcw, Loader2, AlertCircle,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { SeverityBadge } from "../components/ui/SeverityBadge";
import { useAiChat } from "../hooks/useAiChat";
import { useAlerts } from "../hooks/useAlerts";
import type { ChatIntent } from "../lib/ai/chat";

/**
 * SOCGenie Assist — alert-scoped AI.
 *
 * Uses the EXISTING chat path end to end: useAiChat(focusAlertRef) already
 * accepts a focus alert and already routes through getChatProvider(), the
 * grounding guard and the deterministic fallback. Nothing is duplicated here.
 *
 * Estate-wide analysis (posture, patterns) remains available through the
 * dashboard AI path; it is simply not what this page does.
 */

const ACTIONS: { intent: ChatIntent; label: string; icon: typeof Search; prompt: string }[] = [
  { intent: "analyze", label: "Analyze Alert", icon: Search,
    prompt: "Analyse this alert and give me your threat assessment." },
  { intent: "explain", label: "Explain Alert", icon: BookOpen,
    prompt: "Explain this alert in plain language." },
  { intent: "mitre", label: "MITRE ATT&CK Mapping", icon: Target,
    prompt: "Which MITRE ATT&CK technique does this map to, and why?" },
  { intent: "investigate", label: "Investigate Alert", icon: ScanSearch,
    prompt: "What should I investigate next on this alert?" },
  { intent: "response", label: "Recommended Response", icon: ShieldCheck,
    prompt: "What response actions do you recommend for this alert?" },
];

export function Assist() {
  const { alerts } = useAlerts();
  const [selectedRef, setSelectedRef] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [lastPrompt, setLastPrompt] = useState<{ text: string; intent?: ChatIntent } | null>(null);

  // The hook is keyed on the focus alert, so switching alerts re-scopes the
  // conversation through the existing path rather than a second one.
  const { messages, thinking, error, send, clear, providerLabel } = useAiChat(selectedRef || null);

  /** Most recent first, using the existing minutesAgo ordering field. */
  const ordered = useMemo(
    () => [...alerts].sort((a, b) => a.minutesAgo - b.minutesAgo),
    [alerts]
  );
  const selected = ordered.find((a) => a.ref === selectedRef) ?? null;
  const latest = messages.filter((m) => m.role === "assistant").at(-1);

  const run = (text: string, intent?: ChatIntent) => {
    if (!selected || thinking) return;
    setLastPrompt({ text, intent });
    void send(text, intent);
  };

  const askFreeText = () => {
    const q = question.trim();
    if (q === "") return;
    run(q);
    setQuestion("");
  };

  const newAnalysis = () => {
    clear();
    setLastPrompt(null);
    setQuestion("");
  };

  // Follow-up chips appear ONLY when the selected alert actually carries the
  // underlying data. A chip for network activity on an alert with no
  // destination would invite the model to invent one.
  const followUps = selected
    ? [
        selected.evidence.length > 0 && { label: "Evidence", q: "Walk me through the supporting evidence." },
        selected.destinationIp !== null && { label: "Network Activity", q: "What does the network activity show?" },
        selected.techniqueId !== null && { label: "MITRE Context", q: "Give me more context on this technique." },
        selected.notes.length > 0 && { label: "Timeline", q: "Summarise the timeline of analyst activity." },
      ].filter((c): c is { label: string; q: string } => c !== false)
    : [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={Sparkles} title="SOCGenie Assist" description="Alert-scoped analysis" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-[900px] flex-col gap-4">

          {ordered.length === 0 ? (
            <Panel eyebrow="Assist" title="No alerts available">
              <p className="text-2xs leading-relaxed text-text-secondary">
                Assist analyses a specific alert, and the queue is currently empty. Upload a log
                file in Log Explorer to generate alerts, then return here.
              </p>
            </Panel>
          ) : (
            <>
              <Panel eyebrow="Assist" title="Select an alert">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Native select: the project has no shared Select primitive,
                      and this matches the styling used elsewhere. */}
                  <select
                    value={selectedRef}
                    onChange={(e) => { setSelectedRef(e.target.value); newAnalysis(); }}
                    aria-label="Select an alert to analyse"
                    className="min-w-[280px] flex-1 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-2xs text-text-primary focus:border-accent focus:outline-none"
                  >
                    <option value="">Select an alert…</option>
                    {ordered.map((a) => (
                      <option key={a.ref} value={a.ref}>
                        {a.ref} · {a.severity} · {a.host} — {a.title.slice(0, 48)}
                      </option>
                    ))}
                  </select>
                  {selected && <SeverityBadge severity={selected.severity} />}
                </div>

                {selected ? (
                  <p className="mono mt-2 text-2xs text-text-muted">
                    {selected.host} · {selected.sourceIp}
                    {selected.techniqueId ? ` · ${selected.techniqueId}` : ""} · risk {selected.riskScore}/100
                  </p>
                ) : (
                  <p className="mt-2 text-2xs text-text-muted">
                    Choose an alert to enable analysis.
                  </p>
                )}
              </Panel>

              <Panel eyebrow="Assist" title="What are you looking for?">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.intent}
                      type="button"
                      onClick={() => run(a.prompt, a.intent)}
                      disabled={!selected || thinking}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-left text-2xs font-semibold text-text-primary transition-colors hover:border-accent/50 hover:bg-bg-surface focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <a.icon size={13} className="shrink-0 text-accent" aria-hidden="true" />
                      {a.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Input
                    icon={Search}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") askFreeText(); }}
                    placeholder="Ask about this alert…"
                    aria-label="Ask a question about the selected alert"
                    className="min-w-[220px] flex-1"
                    disabled={!selected || thinking}
                  />
                  <Button
                    variant="primary" icon={Send} onClick={askFreeText}
                    disabled={!selected || thinking || question.trim() === ""}
                  >
                    Ask
                  </Button>
                </div>
              </Panel>

              {thinking && (
                <Panel eyebrow="Assist" title="Analysing">
                  <p className="flex items-center gap-2 text-2xs text-text-secondary" role="status" aria-live="polite">
                    <Loader2 size={13} className="animate-spin text-accent" aria-hidden="true" />
                    Reviewing {selectedRef} against the knowledge base…
                  </p>
                </Panel>
              )}

              {error !== null && (
                <Panel eyebrow="Assist" title="Analysis could not be completed">
                  <p className="flex items-start gap-2 text-2xs leading-relaxed text-text-secondary">
                    <AlertCircle size={13} className="mt-0.5 shrink-0 text-status-high" aria-hidden="true" />
                    {error}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="primary" icon={RotateCcw}
                      onClick={() => { if (lastPrompt) run(lastPrompt.text, lastPrompt.intent); }}
                      disabled={!lastPrompt || thinking}
                    >
                      Retry
                    </Button>
                  </div>
                  <p className="mt-2 text-2xs text-text-muted">
                    {selectedRef} is still selected. Retry repeats the last request.
                  </p>
                </Panel>
              )}

              {latest?.response && (
                <>
                  <Panel
                    eyebrow="Assessment"
                    title={latest.response.title}
                    actions={
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{providerLabel}</Badge>
                        <Button icon={RotateCcw} onClick={newAnalysis}>New analysis</Button>
                      </div>
                    }
                  >
                    {latest.response.threatAssessment ? (
                      <p className="text-2xs leading-relaxed text-text-secondary">
                        {latest.response.threatAssessment.verdict} · risk{" "}
                        {latest.response.threatAssessment.riskScore}/100 · confidence{" "}
                        {latest.response.threatAssessment.confidence}%
                      </p>
                    ) : (
                      <p className="text-2xs text-text-muted">No threat assessment for this question type.</p>
                    )}
                    {latest.response.analysis.map((f) => (
                      <div key={f.finding} className="mt-2">
                        <p className="text-2xs font-medium text-text-primary">{f.finding}</p>
                        {/* `evidence` is quoted from the alert; `whyItMatters`
                            is interpretation. Labelled so they never blur. */}
                        <p className="mono mt-0.5 text-2xs text-text-secondary">Evidence: {f.evidence}</p>
                        <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">
                          Why it matters: {f.whyItMatters}
                        </p>
                      </div>
                    ))}
                  </Panel>

                  {latest.response.observedEvidence.length > 0 && (
                    <Panel eyebrow="Observed" title="Evidence from the alert">
                      <ul className="space-y-1">
                        {latest.response.observedEvidence.map((e) => (
                          <li key={e} className="mono text-2xs leading-relaxed text-text-secondary">• {e}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-2xs text-text-muted">
                        Read directly from the alert record. Not model-generated.
                      </p>
                    </Panel>
                  )}

                  {latest.response.recommendedActions.length > 0 && (
                    <Panel eyebrow="Recommended" title="Suggested actions">
                      <ul className="space-y-1">
                        {latest.response.recommendedActions.map((a) => (
                          <li key={a.text} className="text-2xs leading-relaxed text-text-secondary">
                            <span className="mono mr-1.5 text-text-muted">{a.category}</span>
                            {a.text}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-2xs text-text-muted">
                        Recommendations require analyst approval. SOCGenie executes nothing.
                      </p>
                    </Panel>
                  )}

                  {latest.response.nextSteps.length > 0 && (
                    <Panel eyebrow="Recommended" title="Next steps">
                      <ol className="space-y-1">
                        {latest.response.nextSteps.map((s, i) => (
                          <li key={s} className="text-2xs leading-relaxed text-text-secondary">
                            <span className="mono mr-1.5 text-text-muted">{i + 1}.</span>{s}
                          </li>
                        ))}
                      </ol>
                    </Panel>
                  )}

                  {latest.response.sources.length > 0 && (
                    <Panel eyebrow="Grounding" title="Knowledge sources">
                      <ul className="space-y-1">
                        {latest.response.sources.map((citation) => (
                          <li key={citation.documentId} className="text-2xs text-text-secondary">
                            <span className="mono text-text-muted">[{citation.index}]</span>{" "}
                            {citation.title}
                            <span className="mono ml-1.5 text-text-muted">{citation.source}</span>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  )}

                  {followUps.length > 0 && (
                    <Panel eyebrow="Continue" title="Follow-up">
                      <div className="flex flex-wrap gap-2">
                        {followUps.map((c) => (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => run(c.q)}
                            disabled={thinking}
                            className="rounded-full border border-border bg-bg-elevated px-3 py-1 text-2xs text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary focus:border-accent focus:outline-none disabled:opacity-50"
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-2xs text-text-muted">
                        Only options supported by this alert&apos;s data are shown.
                      </p>
                    </Panel>
                  )}

                  {latest.response.limitations.length > 0 && (
                    <Panel eyebrow="Scope" title="Limitations">
                      <ul className="space-y-1">
                        {latest.response.limitations.map((l) => (
                          <li key={l} className="text-2xs leading-relaxed text-text-muted">• {l}</li>
                        ))}
                      </ul>
                    </Panel>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
