import { useEffect, useRef, useState } from "react";
import { Crosshair, Check, ChevronRight, Clock, BookOpen, AlertTriangle } from "lucide-react";
import { AnalystAvatar } from "./AnalystAvatar";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { ACTION_ORDER, type ChatMessage, type ThreatAssessment, type ActionCategory } from "../../lib/ai/chat";

/* The engine now emits typed fields, so this file does NO string parsing —
   the previous version regex-matched values out of prose, which was fragile. */

const SEVERITY_TONE: Record<string, string> = {
  critical: "border-status-critical/45 bg-status-critical/12 text-status-critical",
  high: "border-status-high/45 bg-status-high/12 text-status-high",
  medium: "border-status-medium/45 bg-status-medium/12 text-status-medium",
  low: "border-status-low/45 bg-status-low/12 text-status-low",
};
const SEVERITY_GLOW: Record<string, string> = {
  critical: "bg-status-critical/35",
  high: "bg-status-high/30",
};
const CATEGORY_TONE: Record<ActionCategory, string> = {
  Containment: "text-status-critical",
  Investigation: "text-accent",
  Evidence: "text-status-medium",
  Remediation: "text-status-success",
};

function riskTone(n: number) {
  if (n >= 75) return "text-status-critical";
  if (n >= 50) return "text-status-high";
  if (n >= 25) return "text-status-medium";
  return "text-status-low";
}

/** Counts up once per response; never re-runs for the same value. */
function useCountUp(target: number, enabled: boolean) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const raf = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (!enabled) {
      setValue(target);
      done.current = true;
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / 620, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(step);
      else done.current = true;
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, enabled]);

  return value;
}

/** Stagger delay is dropped under reduced motion: the global CSS rule collapses
 *  duration but NOT delay, so items would otherwise sit invisible. */
function reveal(index: number, reduced: boolean, step = 45, base = 0) {
  if (reduced) return {};
  return { animationDelay: `${base + index * step}ms`, animationFillMode: "backwards" as const };
}
const REVEAL = "animate-fade-in-up";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-20 shrink-0 text-2xs text-text-muted">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function ThreatCard({ a, reduced }: { a: ThreatAssessment; reduced: boolean }) {
  const risk = useCountUp(a.riskScore, !reduced);
  const glow = SEVERITY_GLOW[a.severity];

  return (
    <div
      className={`mt-2.5 rounded-lg border border-border bg-bg-surface px-2.5 py-2.5 ${reduced ? "" : REVEAL}`}
      style={reveal(0, reduced)}
    >
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
        Threat assessment
      </p>

      <div className="space-y-1.5">
        <Row label="Severity">
          <span className="inline-flex items-center gap-2">
            <span className="relative inline-flex">
              {glow && !reduced && (
                <span aria-hidden="true" className={`absolute inset-0 animate-sev-glow rounded blur-sm ${glow}`} />
              )}
              <span className={`relative rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase ${SEVERITY_TONE[a.severity]}`}>
                {a.severity}
              </span>
            </span>
            <span className="rounded border border-border px-1.5 py-0.5 text-2xs font-semibold text-text-secondary">
              {a.priority}
            </span>
          </span>
        </Row>

        <Row label="Risk score">
          <span className={`mono text-sm font-semibold tabular ${riskTone(a.riskScore)}`}>
            {risk}
            <span className="text-2xs text-text-muted">/100</span>
          </span>
        </Row>

        {/* Confidence does not apply to every response type — an incident
            summary has no verdict confidence. Rendering 0% there reads as "no
            confidence" rather than "not applicable", so the row is omitted. */}
        {a.confidence > 0 && (
          <Row label="Confidence">
            <span className="mono text-2xs font-semibold tabular text-text-primary">
              {a.confidence}%
            </span>
            <span className="ml-2 text-2xs text-text-secondary">{a.verdict}</span>
          </Row>
        )}

        <Row label="MITRE">
          {a.techniqueId ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span className="mono inline-flex items-center gap-1 rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-2xs font-semibold text-accent transition-colors duration-150 hover:border-accent/70 hover:bg-accent/20">
                <Crosshair size={10} aria-hidden="true" />
                {a.techniqueId}
              </span>
              <span className="text-2xs text-text-primary">{a.techniqueName}</span>
              {a.tactic && <span className="text-2xs text-text-muted">· {a.tactic}</span>}
            </span>
          ) : (
            <span className="text-2xs text-text-muted">No confident mapping</span>
          )}
        </Row>

        <Row label="Host">
          <span className="mono text-2xs text-text-secondary">{a.host}</span>
        </Row>
        <Row label="Account">
          <span className="mono text-2xs text-text-secondary">{a.account}</span>
        </Row>
        <Row label="Source">
          <span className="mono text-2xs text-text-secondary">
            {a.source}
            {a.destination && <span className="text-text-muted"> → {a.destination}</span>}
          </span>
        </Row>
      </div>
    </div>
  );
}

export function ChatBubble({ message }: { message: ChatMessage }) {
  const reduced = usePrefersReducedMotion();

  if (message.role === "user") {
    return (
      <div className={`flex justify-end ${reduced ? "" : REVEAL}`}>
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-accent/30 bg-accent/10 px-3 py-2">
          <p className="text-xs leading-relaxed text-text-primary">{message.text}</p>
          <p className="mt-1 text-right text-2xs text-text-muted">{message.createdAt}</p>
        </div>
      </div>
    );
  }

  const r = message.response;
  if (!r) return null;

  const evidenceBase = 120;
  const analysisBase = 180;
  const actionsBase = 280;
  const stepsBase = 360;

  return (
    <div className={`flex gap-2 ${reduced ? "" : REVEAL}`}>
      <span className="mt-0.5 shrink-0">
        <AnalystAvatar size={26} className="h-[26px] w-[26px] rounded-full" />
      </span>

      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-border bg-bg-elevated px-3 py-2.5">
        <p className="text-xs font-semibold text-text-primary">{r.title}</p>

        {/* Metadata strip — citable at a glance */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border pb-2">
          {r.meta.alertRef && (
            <span className="mono text-2xs text-text-muted">{r.meta.alertRef}</span>
          )}
          {r.meta.techniqueId && (
            <span className="mono text-2xs text-accent">{r.meta.techniqueId}</span>
          )}
          {r.meta.confidence !== null && (
            <span className="mono text-2xs text-text-muted">conf {r.meta.confidence}%</span>
          )}
          <span className="mono ml-auto inline-flex items-center gap-1 text-2xs text-text-muted">
            <Clock size={9} aria-hidden="true" />
            {r.meta.generatedAt}
          </span>
        </div>

        {r.threatAssessment && <ThreatCard a={r.threatAssessment} reduced={reduced} />}

        {r.observedEvidence.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Observed evidence
            </p>
            <ul className="space-y-0.5">
              {r.observedEvidence.map((e, i) => (
                <li
                  key={e}
                  className={`flex items-start gap-1.5 ${reduced ? "" : REVEAL}`}
                  style={reveal(i, reduced, 40, evidenceBase)}
                >
                  <Check size={10} className="mt-0.5 shrink-0 text-status-success" aria-hidden="true" />
                  <span className="mono break-all text-2xs text-text-secondary">{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.analysis.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Analysis
            </p>
            <ul className="space-y-2">
              {r.analysis.map((f, i) => (
                <li
                  key={`an-${i}`}
                  className={`border-l-2 border-accent/40 pl-2.5 ${reduced ? "" : REVEAL}`}
                  style={reveal(i, reduced, 45, analysisBase)}
                >
                  <p className="text-2xs font-medium leading-relaxed text-text-primary">{f.finding}</p>
                  {f.evidence && (
                    <p className="mono mt-0.5 break-all text-2xs text-text-muted">{f.evidence}</p>
                  )}
                  <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">{f.whyItMatters}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.recommendedActions.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Recommended actions
            </p>
            <ul className="space-y-1">
              {r.recommendedActions.map((a, i) => (
                <li
                  key={`ra-${i}`}
                  className={`group flex gap-2 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-bg-surface ${reduced ? "" : REVEAL}`}
                  style={reveal(i, reduced, 45, actionsBase)}
                >
                  <span className={`w-[74px] shrink-0 text-2xs font-semibold ${CATEGORY_TONE[a.category]}`}>
                    {a.category}
                  </span>
                  <span className="text-2xs leading-relaxed text-text-secondary group-hover:text-text-primary">
                    {a.text}
                  </span>
                </li>
              ))}
            </ul>
            {/* Order is containment first — the sequence an analyst works in. */}
            <p className="mt-1.5 pl-1.5 text-2xs text-text-muted">
              Ordered {ACTION_ORDER.join(" → ").toLowerCase()}. All require analyst approval.
            </p>
          </div>
        )}

        {r.nextSteps.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Next steps
            </p>
            <ul className="space-y-1">
              {r.nextSteps.map((item, i) => (
                <li
                  key={`ns-${i}`}
                  className={`group flex gap-1.5 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-bg-surface ${reduced ? "" : REVEAL}`}
                  style={reveal(i, reduced, 45, stepsBase)}
                >
                  <span className="mono shrink-0 text-2xs font-semibold text-accent/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <ChevronRight size={11} className="mt-0.5 shrink-0 text-text-muted group-hover:text-accent" aria-hidden="true" />
                  <span className="text-2xs leading-relaxed text-text-secondary group-hover:text-text-primary">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Knowledge sources — every retrieved document is traceable. */}
        {r.insufficientKnowledge ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-md border border-status-medium/30 bg-status-medium/[0.06] px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
            {r.insufficientKnowledge}
          </p>
        ) : (
          r.sources.length > 0 && (
            <div className="mt-3 border-t border-border pt-2.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                <BookOpen size={11} aria-hidden="true" /> Knowledge sources
              </p>
              <ul className="space-y-1">
                {r.sources.map((src) => (
                  <li key={src.documentId}>
                    <details className="group/src rounded-md px-1.5 py-1 transition-colors hover:bg-bg-surface">
                      <summary className="flex cursor-pointer items-baseline gap-2">
                        <span className="mono shrink-0 text-2xs text-accent">[{src.index}]</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-2xs text-text-primary">{src.title}</span>
                          <span className="block text-2xs text-text-muted">{src.source}</span>
                        </span>
                        <span className="mono shrink-0 text-2xs tabular text-text-muted">
                          {src.relevanceScore.toFixed(2)}
                        </span>
                      </summary>
                      <div className="mt-1.5 pl-6">
                        <p className="text-2xs leading-relaxed text-text-secondary">{src.excerpt}</p>
                        <p className="mono mt-1 text-2xs text-text-muted">{src.documentId}</p>
                        {/* Only rendered when a genuine URL exists — never fabricated. */}
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-2xs text-accent hover:underline"
                          >
                            Open reference
                          </a>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 pl-1.5 text-2xs text-text-muted">
                {r.sources.length} source{r.sources.length === 1 ? "" : "s"} used · local curated
                knowledge base, not live threat intelligence
              </p>
            </div>
          )
        )}

        <details className="mt-3 border-t border-border pt-2">
          <summary className="cursor-pointer text-2xs text-text-muted hover:text-text-secondary">
            Context used · limitations
          </summary>
          <div className="mt-2 space-y-2">
            <ul className="space-y-0.5">
              {r.contextUsed.map((c) => (
                <li key={c} className="text-2xs text-text-secondary">• {c}</li>
              ))}
            </ul>
            <ul className="space-y-0.5">
              {r.limitations.map((l) => (
                <li key={l} className="text-2xs text-text-muted">• {l}</li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}
