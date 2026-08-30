import { useEffect, useRef, useState } from "react";
import { X, Send, AlertTriangle, Loader2, Trash2, Sparkles, Check } from "lucide-react";
import { Button } from "../ui/Button";
import { AnalystAvatar, AVATAR_RING_FROM, AVATAR_RING_TO } from "./AnalystAvatar";
import { Input } from "../ui/Input";
import { ChatBubble } from "./ChatBubble";
import { useAiChat } from "../../hooks/useAiChat";
import { QUICK_ACTIONS, SUGGESTED_PROMPTS } from "../../lib/ai/chat";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/** Stages shown while a response is being produced. Presentation only — these
 *  label the pipeline the engine already runs; they do not drive it. */
const THINKING_STAGES = [
  "Analysing alert",
  "Correlating evidence",
  "Mapping MITRE ATT&CK",
  "Preparing response",
] as const;
import { Badge } from "../ui/Badge";

/**
 * Floating entry point to the assistant — compact orb.
 *
 * Presentation only. Props and the click contract are unchanged, so it still
 * opens the single existing panel via the caller's state. No assistant logic
 * lives here.
 *
 * SIZING: 52px mobile / 58px tablet / 64px desktop. The avatar fills the
 * circle rather than sitting small inside it, because AnalystAvatar is a
 * self-contained circular composition (background, hair, hoodie, laptop) — an
 * inset version would read as a picture in a frame instead of an orb.
 *
 * PALETTE NOTE: the violet-to-blue ring is a deliberate, explicitly requested
 * exception to the no-purple rule in PRD v2.0 §24, scoped to this control.
 * Ring colours are imported from AnalystAvatar so the glow cannot drift from
 * the illustration.
 *
 * The float is transform-only, so the global prefers-reduced-motion rule in
 * index.css settles it at rest.
 */
export function AISocGenieButton({ onClick, open }: { onClick: () => void; open: boolean }) {
  const ring = `linear-gradient(135deg, ${AVATAR_RING_FROM}, ${AVATAR_RING_TO})`;

  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      aria-label="Open AI SOCGenie Assistant"
      className="group fixed bottom-5 right-5 z-40 flex flex-col items-center gap-1.5 rounded-full transition-transform duration-200 hover:scale-105 active:scale-100"
    >
      <span className="relative flex items-center justify-center">
        {/* Restrained halo — tight blur so it reads as a rim, not a cloud. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full opacity-40 blur-md transition-opacity duration-300 group-hover:opacity-70"
          style={{ background: ring }}
        />

        {/* Thin gradient border holding the avatar */}
        <span
          className="relative h-[52px] w-[52px] animate-emoji-float rounded-full p-[2px] shadow-[0_4px_14px_-4px_rgba(139,92,246,0.55)] transition-shadow duration-300 group-hover:shadow-[0_6px_18px_-4px_rgba(139,92,246,0.8)] sm:h-[58px] sm:w-[58px] lg:h-16 lg:w-16"
          style={{ background: ring }}
        >
          <span className="block h-full w-full overflow-hidden rounded-full bg-bg-primary">
            <AnalystAvatar size={64} className="h-full w-full rounded-full" />
          </span>
        </span>

        {/* Availability dot — the local engine is always ready. Makes no claim
            about a model or an external service. */}
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-bg-primary bg-status-success"
        />
      </span>

      <span className="rounded-full border border-accent/25 bg-bg-surface/85 px-2 py-0.5 text-[9px] font-semibold tracking-tight text-text-secondary backdrop-blur-sm transition-colors duration-200 group-hover:border-accent/50 group-hover:text-text-primary sm:text-[10px]">
        AI SOCGenie
      </span>
    </button>
  );
}

/**
 * AI SOCGenie assistant drawer.
 *
 * Conversation state and all reasoning live outside this component:
 * useAiChat owns the transcript, and getChatProvider() owns the analysis. This
 * file only renders. That keeps the UI swappable when a real model or RAG
 * pipeline replaces the local engine.
 *
 * Context is injected automatically from the alert and incident stores, so the
 * analyst never pastes alert data in.
 */
export function AISocGenieDrawer({
  open,
  onClose,
  focusAlertRef,
}: {
  open: boolean;
  onClose: () => void;
  /** Optional alert to bias questions toward, e.g. one already on screen. */
  focusAlertRef?: string | null;
}) {
  const { messages, thinking, error, send, clear, providerLabel, alertCount, incidentCount } =
    useAiChat(focusAlertRef);
  const [question, setQuestion] = useState("");
  const [stage, setStage] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  // Advance the thinking label while a response is in flight.
  useEffect(() => {
    if (!thinking) {
      setStage(0);
      return;
    }
    const id = window.setInterval(
      () => setStage((s) => Math.min(s + 1, THINKING_STAGES.length - 1)),
      420
    );
    return () => window.clearInterval(id);
  }, [thinking]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-bg-primary/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="AI SOCGenie assistant"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-border bg-bg-surface shadow-panel"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <AnalystAvatar
              size={34}
              className={`h-[34px] w-[34px] shrink-0 rounded-full ${reduced ? "" : "animate-emoji-float"}`}
            />
            <div>
              <p className="text-sm font-semibold text-text-primary">AI SOCGenie</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-text-muted" aria-live="polite">
                <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${
                      thinking ? "bg-accent" : "bg-status-success"
                    } ${reduced ? "" : "animate-ping"}`}
                  />
                  <span
                    className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                      thinking ? "bg-accent" : "bg-status-success"
                    }`}
                  />
                </span>
                {thinking ? THINKING_STAGES[stage] : "Ready"} · {providerLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clear}
                aria-label="Clear conversation"
                title="Clear conversation"
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close AI SOCGenie"
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {/* Quick actions — each sends with an explicit intent, so routing does
            not depend on keyword matching. */}
        <div className="shrink-0 border-b border-border px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.intent}
                disabled={thinking}
                onClick={() => send(a.prompt, a.intent)}
                className="rounded-md border border-border bg-bg-elevated px-2 py-1 text-2xs text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !thinking && (
            <div>
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <p className="text-2xs leading-relaxed text-text-secondary">
                  I can analyse alerts, explain detections, map them to MITRE ATT&amp;CK and suggest
                  next steps. I read the current data directly — {alertCount} alert
                  {alertCount === 1 ? "" : "s"} and {incidentCount} incident
                  {incidentCount === 1 ? "" : "s"} — so you never need to paste anything in.
                </p>
              </div>

              <p className="mb-2 mt-4 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Try asking
              </p>
              <div className="flex flex-col gap-1.5">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-left text-2xs text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
                  >
                    {p}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-2xs leading-relaxed text-text-muted">
                Responses are produced by a local deterministic engine. No external service is
                contacted, no model is trained, and nothing it recommends is executed.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}

            {thinking && (
              <div className="flex gap-2">
                <span className="mt-0.5 shrink-0">
                  <AnalystAvatar
                    size={26}
                    className={`h-[26px] w-[26px] rounded-full ${reduced ? "" : "animate-emoji-float"}`}
                  />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-border bg-bg-elevated px-3 py-2.5">
                  <ol className="space-y-1">
                    {THINKING_STAGES.map((label, i) => (
                      <li
                        key={label}
                        className={`flex items-center gap-2 text-2xs ${
                          i < stage ? "text-text-secondary" : i === stage ? "text-accent" : "text-text-muted"
                        }`}
                      >
                        {i < stage ? (
                          <Check size={11} className="shrink-0 text-status-success" aria-hidden="true" />
                        ) : i === stage ? (
                          <Loader2
                            size={11}
                            className={`shrink-0 ${reduced ? "" : "animate-spin"}`}
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="h-1 w-1 shrink-0 rounded-full bg-text-muted/50" aria-hidden="true" />
                        )}
                        {label}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {error && (
              <p className="flex items-start gap-2 rounded-md border border-status-medium/30 bg-status-medium/[0.06] px-3 py-2.5 text-2xs leading-relaxed text-text-secondary">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
                {error} The dashboard is unaffected.
              </p>
            )}
          </div>

          <div ref={endRef} />
        </div>

        <form
          className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            const q = question.trim();
            if (!q || thinking) return;
            send(q);
            setQuestion("");
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about an alert, host or technique…"
              aria-label="Message AI SOCGenie"
              disabled={thinking}
            />
          </div>
          <Button type="submit" icon={Send} disabled={!question.trim() || thinking}>
            Send
          </Button>
        </form>
      </aside>
    </>
  );
}
