import { Shield, Radar, Brain, Zap } from "lucide-react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * SOCGenie intelligence diagram — a looping DETECT → ANALYZE → RESPOND
 * workflow driven from a central shield node.
 *
 * The cycle is 6s, split into three 2s phases. Every animated element shares
 * that 6s duration and is offset by 0s / 2s / 4s, so the whole diagram stays
 * phase-locked without any JavaScript timer: the connector trace fills, the
 * node border brightens, and its indicator dot flashes, in sequence.
 *
 * BRANDING, NOT TELEMETRY. No counts, scores, accuracy figures or event names
 * appear here — any number would be fabricated. The three labels are the
 * product's actual workflow stages.
 *
 * Pure CSS animation plus one inline SVG. No canvas, no library.
 */

const CYCLE_S = 6;

const CAPABILITIES = [
  { label: "DETECT", Icon: Radar, phase: 0 },
  { label: "ANALYZE", Icon: Brain, phase: 1 },
  { label: "RESPOND", Icon: Zap, phase: 2 },
] as const;

export function IntelligenceVisual() {
  const reduced = usePrefersReducedMotion();

  /** Phase offset in seconds for a given stage. */
  const offset = (phase: number) => `${phase * (CYCLE_S / 3)}s`;

  return (
    <div className="relative mx-auto w-full max-w-[420px] select-none" aria-hidden="true">
      {/* ── Central intelligence core ─────────────────────── */}
      <div className="relative flex justify-center">
        {!reduced && (
          <>
            {/* System pulse: two staggered expanding rings */}
            <span className="absolute top-1/2 left-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/30 animate-shield-ring" />
            <span
              className="absolute top-1/2 left-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/20 animate-shield-ring"
              style={{ animationDelay: "1.4s" }}
            />
            {/* Slow orbit carrying a single node */}
            <div className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2">
              <div className="h-full w-full rounded-full border border-dashed border-border animate-orbit-ring">
                <span className="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent/80 shadow-[0_0_6px_1px_rgb(var(--accent)/0.4)]" />
              </div>
            </div>
          </>
        )}

        <div
          className={`relative flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/30 bg-bg-surface shadow-panel ${
            reduced ? "" : "animate-core-breathe"
          }`}
        >
          <Shield size={26} strokeWidth={1.6} className="text-accent" />
        </div>
      </div>

      <p className="relative mt-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
        SOCGenie Intelligence
      </p>

      {/* ── Connectors: a static rail plus a phase-locked filling trace ── */}
      <div className="relative mt-3 h-12">
        <svg viewBox="0 0 400 48" className="h-full w-full" preserveAspectRatio="none">
          <path
            d="M200 0 V16 M200 16 H62 V48 M200 16 H338 V48 M200 16 V48"
            fill="none"
            stroke="rgb(var(--border-default))"
            strokeWidth="1"
          />
        </svg>

        {!reduced && (
          <>
            {/* Vertical trace into each node, filling during that node's phase */}
            {CAPABILITIES.map((cap, i) => (
              <span
                key={`trace-${cap.label}`}
                className="absolute top-4 h-8 w-px origin-top bg-gradient-to-b from-accent/70 to-accent/20 animate-trace-fill"
                style={{ left: `${[15.5, 50, 84.5][i]}%`, animationDelay: offset(cap.phase) }}
              />
            ))}
            {/* Packet travelling the same path */}
            {CAPABILITIES.map((cap, i) => (
              <span
                key={`dot-${cap.label}`}
                className="absolute top-3 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_1px_rgb(var(--accent)/0.5)] animate-flow-down"
                style={{
                  left: `calc(${[15.5, 50, 84.5][i]}% - 3px)`,
                  animationDuration: `${CYCLE_S}s`,
                  animationDelay: offset(cap.phase),
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Capability nodes ──────────────────────────────── */}
      <div className="relative grid grid-cols-3 gap-2">
        {CAPABILITIES.map(({ label, Icon, phase }) => (
          <div
            key={label}
            className={`group flex flex-col items-center gap-1.5 rounded-lg border border-border bg-bg-surface/70 px-2 py-3 backdrop-blur-sm transition-colors duration-200 hover:border-accent/50 ${
              reduced ? "" : "animate-node-receive"
            }`}
            style={reduced ? undefined : { animationDelay: offset(phase) }}
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg-elevated text-accent transition-colors duration-200 group-hover:border-accent/40">
              <Icon size={15} strokeWidth={1.8} />
              <span
                className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent ${
                  reduced ? "opacity-40" : "animate-node-dot"
                }`}
                style={reduced ? undefined : { animationDelay: offset(phase) }}
              />
            </span>
            <span className="text-2xs font-semibold tracking-[0.12em] text-text-secondary transition-colors duration-200 group-hover:text-text-primary">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
