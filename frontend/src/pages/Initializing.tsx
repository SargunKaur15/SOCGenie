import { useEffect, useState } from "react";
import { ArrowRight, SkipForward } from "lucide-react";
import { NetworkCanvas } from "../components/auth/NetworkCanvas";
import { ThemeSelector } from "../components/auth/ThemeSelector";
import { ShieldEmblem } from "../components/auth/ShieldEmblem";
import { InitCheckRow } from "../components/auth/InitCheckRow";
import { useInitializationChecks } from "../hooks/useInitializationChecks";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

/**
 * Post-login initialization surface.
 *
 * Every line reflects a real Phase 1 startup check (see useInitializationChecks).
 * In DEMO_MODE every check genuinely does resolve "ok" — a self-contained demo
 * environment with no external backend is its own valid ready state, not a
 * failure being dressed up. Nothing here claims a production database
 * connection or a trained model exists; see that hook's own honesty contract.
 *
 * The user is never trapped — Skip is available from the first frame, and Enter
 * becomes the primary action as soon as the checks settle.
 */
export function Initializing({ onEnter }: { onEnter: () => void }) {
  const { checks, complete } = useInitializationChecks();
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);

  // Small settle beat so the final row is readable before the CTA swaps in.
  useEffect(() => {
    if (!complete) return;
    const id = window.setTimeout(() => setReady(true), reduced ? 0 : 260);
    return () => window.clearTimeout(id);
  }, [complete, reduced]);

  const settledCount = checks.filter((c) => c.status === "ok" || c.status === "info").length;
  const progress = Math.round((settledCount / checks.length) * 100);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-bg-primary px-4 py-10">
      <NetworkCanvas />

      <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-6">
        <ThemeSelector />
      </div>

      <div className="relative z-10 w-full max-w-[520px]">
        <div className="flex flex-col items-center text-center">
          <ShieldEmblem size={104} scanning={!ready} />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">SOCGenie</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            {ready ? "Security operations environment ready" : "Initializing security operations environment"}
          </p>
        </div>

        <div className="mt-7 animate-card-in rounded-xl border border-border bg-bg-surface p-6 shadow-panel ring-1 ring-black/5 sm:p-7 dark:ring-white/[0.03]">
          {/* Determinate progress — reflects settled checks, not a timer. */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                System checks
              </span>
              <span className="mono text-xs tabular text-text-secondary">
                {settledCount} / {checks.length}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Initialization progress"
              />
            </div>
          </div>

          <ul className="flex flex-col gap-0.5" aria-live="polite">
            {checks.map((check, i) => (
              <InitCheckRow
                key={check.id}
                index={i}
                label={check.label}
                status={check.status}
                detail={check.detail}
              />
            ))}
          </ul>

          <div className="mt-5 border-t border-border pt-5">
            {ready ? (
              <div className="animate-fade-in">
                <p className="mb-1 text-center text-2xs font-semibold uppercase tracking-wider text-status-success">
                  All system checks passed
                </p>
                <p className="mb-4 text-center text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">SOCGenie is ready.</span>{" "}
                  <span className="text-text-muted">The security operations environment is fully initialized.</span>
                </p>
                <button
                  type="button"
                  autoFocus
                  onClick={onEnter}
                  className="group/enter flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-[15px] font-semibold text-bg-primary transition-all duration-200 hover:-translate-y-px hover:brightness-110 hover:shadow-[0_8px_24px_-8px_rgb(var(--accent)/0.55)] active:translate-y-0 active:scale-[0.99]"
                >
                  Enter SOC
                  <ArrowRight
                    size={17}
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover/enter:translate-x-1"
                  />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onEnter}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg-elevated text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
              >
                <SkipForward size={15} aria-hidden="true" />
                Skip to Command Center
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-text-muted">
          Academic research prototype · Statuses reflect actual Phase 1 system state
        </p>
      </div>
    </div>
  );
}
