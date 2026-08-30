import { Shield } from "lucide-react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * SOCGenie Intelligence Core.
 *
 * An abstract security-infrastructure visualisation: a shield at the centre,
 * three counter-rotating orbital rings carrying nodes, and three workflow
 * stages (DETECT / ANALYZE / RESPOND) connected by signal paths.
 *
 * GEOMETRY — one 360×360 SVG viewBox, centre (180,180):
 *   ring radii 52 / 68 / 84   ·  connector 92 → 118  ·  stage label 132
 *   stages sit at 150° / 90° / 30° (screen degrees, y down)
 *
 * TIMING — the workflow runs on a 6s cycle, 2s per stage, driven purely by CSS
 * animation-delay offsets (0s / 2s / 4s). No JavaScript timer. Ring rotation
 * periods (48s / 72s / 96s) are intentionally non-harmonic with the workflow
 * and with each other, so nothing ever falls into visible lockstep.
 *
 * BRANDING, NOT TELEMETRY. No counts, scores, model metrics or event names are
 * rendered — any number here would be fabricated. The three labels are the
 * product's actual workflow stages.
 *
 * Rendering is one inline SVG plus absolutely-positioned HTML for text (better
 * type rendering than SVG <text>). Signal particles use native SVG
 * <animateMotion>. No canvas, no WebGL, no animation library.
 */

const CENTER = 180;

const STAGES = [
  { label: "DETECT", angle: 150, phase: 0 },
  { label: "ANALYZE", angle: 90, phase: 1 },
  { label: "RESPOND", angle: 30, phase: 2 },
] as const;

const polar = (angleDeg: number, radius: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
};

/** Nodes riding each orbital ring, at fixed angles on that ring. */
const RINGS = [
  { r: 52, duration: 48, ccw: true, nodeAngles: [20, 200], dashed: false },
  { r: 68, duration: 72, ccw: false, nodeAngles: [70, 190, 310], dashed: false },
  { r: 84, duration: 96, ccw: true, nodeAngles: [130], dashed: true },
];

export function IntelligenceCore() {
  const reduced = usePrefersReducedMotion();
  const offset = (phase: number) => `${phase * 2}s`;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[400px] select-none" aria-hidden="true">
      {/* Soft radial lighting behind the core — depth, not glow. */}
      <div
        className={`absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.07] blur-3xl dark:bg-accent/[0.10] ${
          reduced ? "" : "animate-core-halo"
        }`}
      />

      <svg viewBox="0 0 360 360" className="absolute inset-0 h-full w-full">
        {/* Orbital rings */}
        {RINGS.map((ring, i) => (
          <g
            key={`ring-${i}`}
            style={{
              transformOrigin: `${CENTER}px ${CENTER}px`,
              animation: reduced
                ? undefined
                : `${ring.ccw ? "orbit-ccw" : "orbit-ring"} ${ring.duration}s linear infinite`,
            }}
          >
            <circle
              cx={CENTER}
              cy={CENTER}
              r={ring.r}
              fill="none"
              stroke="rgb(var(--border-default))"
              strokeWidth="1"
              strokeDasharray={ring.dashed ? "3 5" : undefined}
            />
            {ring.nodeAngles.map((angle) => {
              const p = polar(angle, ring.r);
              return (
                <circle
                  key={`n-${i}-${angle}`}
                  cx={p.x}
                  cy={p.y}
                  r="2.5"
                  className="fill-accent"
                  opacity="0.75"
                />
              );
            })}
          </g>
        ))}

        {/* Signal paths from core to each stage */}
        {STAGES.map((stage) => {
          const from = polar(stage.angle, 92);
          const to = polar(stage.angle, 118);
          const path = `M${from.x} ${from.y} L${to.x} ${to.y}`;
          return (
            <g key={`path-${stage.label}`}>
              <path d={path} stroke="rgb(var(--border-default))" strokeWidth="1" fill="none" />
              <circle cx={to.x} cy={to.y} r="3" fill="rgb(var(--bg-surface))" stroke="rgb(var(--border-default))" strokeWidth="1" />
              {!reduced && (
                <>
                  {/* Signal travelling out to the stage during its phase */}
                  <circle r="2.5" className="fill-accent">
                    <animateMotion
                      dur="6s"
                      begin={offset(stage.phase)}
                      repeatCount="indefinite"
                      path={path}
                      keyPoints="0;1;1"
                      keyTimes="0;0.14;1"
                      calcMode="linear"
                    />
                    <animate
                      attributeName="opacity"
                      dur="6s"
                      begin={offset(stage.phase)}
                      repeatCount="indefinite"
                      values="0;1;1;0;0"
                      keyTimes="0;0.03;0.12;0.18;1"
                    />
                  </circle>
                  {/* Stage node acknowledges receipt */}
                  <circle cx={to.x} cy={to.y} r="3" className="fill-accent">
                    <animate
                      attributeName="opacity"
                      dur="6s"
                      begin={offset(stage.phase)}
                      repeatCount="indefinite"
                      values="0;0;1;0.4;0"
                      keyTimes="0;0.12;0.16;0.3;0.36"
                    />
                  </circle>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Central shield */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className={`relative flex h-[74px] w-[74px] items-center justify-center rounded-2xl border border-accent/30 bg-bg-surface shadow-panel ${
            reduced ? "" : "animate-core-breathe"
          }`}
        >
          <Shield size={26} strokeWidth={1.6} className="text-accent" />
          {!reduced && (
            <>
              <span className="absolute inset-0 rounded-2xl border border-accent/25 animate-shield-ring" />
              <span
                className="absolute inset-0 rounded-2xl border border-accent/15 animate-shield-ring"
                style={{ animationDelay: "1.6s" }}
              />
            </>
          )}
        </div>
      </div>

      {/* Stage labels, positioned at r=132 on the same angles as their paths */}
      {STAGES.map((stage) => {
        const p = polar(stage.angle, 132);
        return (
          <span
            key={stage.label}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-bg-surface/80 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-text-secondary backdrop-blur-sm ${
              reduced ? "" : "animate-stage-activate"
            }`}
            style={{
              left: `${(p.x / 360) * 100}%`,
              top: `${(p.y / 360) * 100}%`,
              animationDelay: reduced ? undefined : offset(stage.phase),
            }}
          >
            {stage.label}
          </span>
        );
      })}

      {/* Core caption */}
      <span className="absolute left-1/2 top-[calc(50%+52px)] -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
        SOCGenie Intelligence
      </span>
    </div>
  );
}
