import { Eye, Crosshair, Search, Zap } from "lucide-react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * SOCGenie Intelligence Visualization.
 *
 *                    SECURITY EVENTS
 *                           |
 *                    ( SOCGenie )        <- ONE large core circle
 *                     /    |    \
 *                DETECT ANALYZE RESPOND
 *
 * ── GEOMETRY ───────────────────────────────────────────────────────────────
 * One coordinate system. Every element — SVG and HTML overlay alike — derives
 * from the constants below; HTML positions via `at()`, which converts viewBox
 * units to percentages. CX is the single shared vertical axis.
 *
 * The core is the LARGEST circle (r=84); the two concentric rings sit OUTSIDE
 * it (r=100, r=116). Previously the core was smaller than its rings, so the
 * eye read the outer ring as "the main circle" and the wordmark as a small
 * badge floating inside it.
 *
 * The wordmark is SVG <text>, not HTML, so it scales with the viewBox and is
 * centred by textAnchor/dominantBaseline rather than by layout — it cannot
 * drift or overflow at any size.
 *
 * ── TIMING ─────────────────────────────────────────────────────────────────
 * One 8s cycle: event packet traverses the ingress rail (0-18%), the core
 * pulses (20%), then DETECT / ANALYZE / RESPOND fire at +0s / +1.5s / +3s.
 * Phase-locked by animation-delay; no JavaScript timer. Orbital periods
 * (46s / 68s) are non-harmonic with the cycle and with each other.
 *
 * BRANDING, NOT TELEMETRY. No counts, severities or model metrics are drawn.
 */

// ── Single source of truth ───────────────────────────────────────────────────
const VB = { w: 520, h: 500 };
const CX = VB.w / 2;              // 260 — the shared vertical axis
const CORE_Y = 225;
const CORE_R = 84;                // the ONE large central circle
const RING_R = [100, 116];        // subtle rings, OUTSIDE the core
const GAP = 178;                  // symmetric spacing above and below the core
const EVENTS_Y = CORE_Y - GAP;    // 47
const ACTION_Y = CORE_Y + GAP;    // 403
const ACTION_DX = 150;            // symmetric offset for DETECT / RESPOND
const NODE_D = 44;

/** viewBox units → percentage, so HTML overlays share the SVG's geometry. */
const at = (x: number, y: number) => ({
  left: `${(x / VB.w) * 100}%`,
  top: `${(y / VB.h) * 100}%`,
});

/** Rails run centre-to-centre and are occluded by the discs they connect. */
const INGRESS_PATH = `M${CX} ${EVENTS_Y} L${CX} ${CORE_Y}`;

const STAGES = [
  { label: "DETECT", caption: "Identify suspicious activity", Icon: Crosshair, token: "--status-critical", delay: "0s", x: CX - ACTION_DX },
  { label: "ANALYZE", caption: "Correlate and build context", Icon: Search, token: "--accent", delay: "1.5s", x: CX },
  { label: "RESPOND", caption: "Act with evidence", Icon: Zap, token: "--status-success", delay: "3s", x: CX + ACTION_DX },
] as const;

/** Symmetric curve from core centre to an action-node centre; control points
 *  mirror, so left and right branches are exact reflections. */
const branchPath = (x: number) =>
  x === CX
    ? `M${CX} ${CORE_Y} L${CX} ${ACTION_Y}`
    : `M${CX} ${CORE_Y} C${CX} ${CORE_Y + 100}, ${x} ${ACTION_Y - 100}, ${x} ${ACTION_Y}`;

const INGRESS_PACKETS = [
  { begin: "0s", token: "--accent" },
  { begin: "2.7s", token: "--status-medium" },
  { begin: "5.4s", token: "--status-critical" },
];

/** Orbital dots riding the rings' perimeter. */
const ORBITS = [
  { r: RING_R[0], duration: 46, ccw: false, angles: [0, 140, 250] },
  { r: RING_R[1], duration: 68, ccw: true, angles: [70, 210] },
];

const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CORE_Y + r * Math.sin(rad) };
};

export function IntelligenceVisualization() {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-[520px] select-none" aria-hidden="true">
      <div className="relative w-full" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
        {/* Soft radial depth, concentric with the core */}
        <div
          className={`absolute h-[42%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.07] blur-3xl dark:bg-accent/[0.11] ${
            reduced ? "" : "animate-core-halo"
          }`}
          style={at(CX, CORE_Y)}
        />

        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full">
          <defs>
            {/* Subtle inner glow — a soft wash inside the core, not a halo */}
            <radialGradient id="socgenie-core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="50%" stopColor="rgb(var(--accent))" stopOpacity="0" />
              <stop offset="88%" stopColor="rgb(var(--accent))" stopOpacity="0.08" />
              <stop offset="100%" stopColor="rgb(var(--accent-secondary))" stopOpacity="0.12" />
            </radialGradient>
          </defs>

          {/* ── Rails: centre to centre, drawn first ── */}
          <path d={INGRESS_PATH} stroke="rgb(var(--border-default))" strokeWidth="1" fill="none" />
          {STAGES.map((s) => (
            <path key={`rail-${s.label}`} d={branchPath(s.x)} stroke="rgb(var(--border-default))" strokeWidth="1" fill="none" />
          ))}

          {/* ── Concentric rings, OUTSIDE the core ── */}
          {RING_R.map((r, i) => (
            <circle
              key={r}
              cx={CX}
              cy={CORE_Y}
              r={r}
              fill="none"
              stroke={i === 1 ? "rgb(var(--accent-secondary))" : "rgb(var(--border-default))"}
              strokeWidth="1"
              strokeDasharray={i === 1 ? "3 7" : undefined}
              opacity={i === 1 ? 0.34 : 1}
            />
          ))}

          {/* ── Orbital dots on the perimeter ── */}
          {ORBITS.map((orbit, i) => (
            <g
              key={`orbit-${i}`}
              style={{
                transformOrigin: `${CX}px ${CORE_Y}px`,
                animation: reduced
                  ? undefined
                  : `${orbit.ccw ? "orbit-ccw" : "orbit-ring"} ${orbit.duration}s linear infinite`,
              }}
            >
              {orbit.angles.map((deg) => {
                const p = polar(deg, orbit.r);
                return <circle key={deg} cx={p.x} cy={p.y} r="2.5" className="fill-accent" opacity="0.7" />;
              })}
            </g>
          ))}

          {/* ── THE core circle — one large node, concentric with everything ── */}
          <g
            className={reduced ? undefined : "animate-core-halo"}
            style={{ transformOrigin: `${CX}px ${CORE_Y}px` }}
          >
            <circle cx={CX} cy={CORE_Y} r={CORE_R + 6} fill="none" stroke="rgb(var(--accent))" strokeWidth="1" opacity="0.18" />
          </g>
          <circle cx={CX} cy={CORE_Y} r={CORE_R} fill="rgb(var(--bg-surface))" />
          <circle cx={CX} cy={CORE_Y} r={CORE_R} fill="url(#socgenie-core-glow)" />
          <circle cx={CX} cy={CORE_Y} r={CORE_R} fill="none" stroke="rgb(var(--accent))" strokeWidth="1.5" opacity="0.75" />

          {/* Impact ring — expands from the core when an event lands */}
          {!reduced && (
            <circle
              cx={CX}
              cy={CORE_Y}
              r={CORE_R}
              fill="none"
              stroke="rgb(var(--accent))"
              strokeWidth="1.5"
              className="animate-core-impact"
              style={{ transformOrigin: `${CX}px ${CORE_Y}px` }}
            />
          )}

          {/* ── Wordmark: SVG text, so it scales with the diagram and is centred
                 by the text engine rather than by layout ── */}
          <text
            x={CX}
            y={CORE_Y - 4}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="27"
            fontWeight="700"
            letterSpacing="-0.4"
          >
            <tspan fill="rgb(var(--text-primary))">SOC</tspan>
            <tspan fill="rgb(var(--accent))">Genie</tspan>
          </text>
          <text
            x={CX}
            y={CORE_Y + 24}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="8.5"
            fontWeight="600"
            letterSpacing="2"
            fill="rgb(var(--text-muted))"
          >
            INTELLIGENCE CORE
          </text>

          {/* ── Signal particles, following the rail paths exactly ── */}
          {!reduced && (
            <>
              {INGRESS_PACKETS.map((pkt) => (
                <circle key={pkt.begin} r="3" fill={`rgb(var(${pkt.token}))`} opacity="0">
                  <animateMotion dur="8s" begin={pkt.begin} repeatCount="indefinite" path={INGRESS_PATH}
                    keyPoints="0;1;1" keyTimes="0;0.18;1" calcMode="linear" />
                  <animate attributeName="opacity" dur="8s" begin={pkt.begin} repeatCount="indefinite"
                    values="0;1;1;0;0" keyTimes="0;0.03;0.15;0.18;1" />
                </circle>
              ))}
              {STAGES.map((s) => (
                <circle key={`out-${s.label}`} r="3" fill={`rgb(var(${s.token}))`} opacity="0">
                  <animateMotion dur="8s" begin={s.delay} repeatCount="indefinite" path={branchPath(s.x)}
                    keyPoints="0;1;1" keyTimes="0;0.13;1" calcMode="linear" />
                  <animate attributeName="opacity" dur="8s" begin={s.delay} repeatCount="indefinite"
                    values="0;1;1;0;0" keyTimes="0;0.03;0.11;0.13;1" />
                </circle>
              ))}
            </>
          )}
        </svg>

        {/* ── SECURITY EVENTS — on the core axis ── */}
        <span
          className="absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-bg-surface px-2.5 py-1.5"
          style={at(CX, EVENTS_Y)}
        >
          <Eye size={11} className="text-text-muted" />
          <span className="text-[10px] font-semibold tracking-[0.14em] text-text-secondary">SECURITY EVENTS</span>
        </span>

        {/* ── Action nodes — one baseline, symmetric about the axis ── */}
        {STAGES.map(({ label, caption, Icon, token, delay, x }) => (
          <span key={label}>
            <span
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-default items-center justify-center rounded-full border bg-bg-surface transition-transform duration-200 hover:scale-110 ${
                reduced ? "border-border" : "animate-stage-fire"
              }`}
              style={{
                ...at(x, ACTION_Y),
                width: `${(NODE_D / VB.w) * 100}%`,
                aspectRatio: "1 / 1",
                ...(reduced ? {} : ({ animationDelay: delay, "--stage-accent": `rgb(var(${token}))` } as React.CSSProperties)),
              }}
            >
              <Icon
                size={16}
                strokeWidth={1.8}
                className={reduced ? "opacity-70" : "animate-stage-icon"}
                style={{ color: `rgb(var(${token}))`, ...(reduced ? {} : { animationDelay: delay }) }}
              />
            </span>

            <span className="absolute w-[30%] -translate-x-1/2 text-center" style={at(x, ACTION_Y + NODE_D / 2 + 10)}>
              <span className="block text-[11px] font-semibold tracking-[0.12em]" style={{ color: `rgb(var(${token}))` }}>
                {label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-text-muted">{caption}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
