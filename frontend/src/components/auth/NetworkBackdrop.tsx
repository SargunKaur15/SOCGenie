import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * Live security-network environment for the authentication surfaces.
 *
 * Six independent layers, all CSS transform/opacity — no canvas, no WebGL,
 * no animation library:
 *   1. drifting grid       2. connection links (async brightening)
 *   3. travelling packets  4. endpoint nodes
 *   5. signal points       6. scanning wave
 *
 * DECORATIVE ONLY. No counts, labels, or values are rendered anywhere here;
 * this is product visualisation, never telemetry.
 *
 * Every duration/delay pair is deliberately non-harmonic so layers never fall
 * into visible lockstep. Under prefers-reduced-motion only the static grid
 * renders.
 */

interface Link {
  top: number;
  left: number;
  width: number;
  rotate: number;
  /** packet timing */
  delay: number;
  duration: number;
  /** link brightening cycle */
  breatheDelay: number;
  breatheDuration: number;
  reverse?: boolean;
}

const LINKS: Link[] = [
  { top: 18, left: 3, width: 24, rotate: 16, delay: 0, duration: 7.3, breatheDelay: 0.4, breatheDuration: 9 },
  { top: 34, left: 70, width: 26, rotate: -13, delay: 2.1, duration: 8.6, breatheDelay: 3.2, breatheDuration: 11, reverse: true },
  { top: 52, left: 6, width: 21, rotate: -21, delay: 1.3, duration: 9.4, breatheDelay: 6.1, breatheDuration: 8.5 },
  { top: 68, left: 64, width: 27, rotate: 11, delay: 3.7, duration: 7.8, breatheDelay: 1.9, breatheDuration: 12, reverse: true },
  { top: 11, left: 46, width: 17, rotate: 30, delay: 5.2, duration: 8.1, breatheDelay: 4.6, breatheDuration: 10 },
  { top: 84, left: 30, width: 22, rotate: -7, delay: 6.4, duration: 9.9, breatheDelay: 2.7, breatheDuration: 9.5 },
  { top: 44, left: 34, width: 15, rotate: 24, delay: 4.1, duration: 8.9, breatheDelay: 7.3, breatheDuration: 11.5, reverse: true },
  { top: 76, left: 84, width: 14, rotate: -28, delay: 1.7, duration: 7.1, breatheDelay: 5.4, breatheDuration: 10.5 },
];

const NODES: { top: number; left: number; delay: number; duration: number }[] = [
  { top: 18, left: 3, delay: 0, duration: 4.2 },
  { top: 25, left: 27, delay: 0.7, duration: 5.1 },
  { top: 34, left: 70, delay: 1.4, duration: 4.6 },
  { top: 28, left: 93, delay: 2.2, duration: 5.4 },
  { top: 52, left: 6, delay: 1.1, duration: 4.9 },
  { top: 44, left: 34, delay: 2.6, duration: 5.7 },
  { top: 68, left: 64, delay: 1.8, duration: 4.4 },
  { top: 74, left: 90, delay: 3.1, duration: 5.2 },
  { top: 11, left: 46, delay: 3.5, duration: 4.8 },
  { top: 84, left: 30, delay: 2.9, duration: 5.5 },
  { top: 60, left: 52, delay: 0.4, duration: 6.0 },
  { top: 90, left: 68, delay: 4.2, duration: 4.7 },
];

/** Tiny points that flash occasionally — "connection activity". */
const SIGNALS: { top: number; left: number; delay: number }[] = [
  { top: 22, left: 16, delay: 0 },
  { top: 40, left: 82, delay: 1.9 },
  { top: 58, left: 22, delay: 3.4 },
  { top: 30, left: 58, delay: 5.1 },
  { top: 79, left: 46, delay: 2.4 },
  { top: 66, left: 12, delay: 6.2 },
  { top: 14, left: 72, delay: 4.3 },
];

export function NetworkBackdrop({ className = "" }: { className?: string }) {
  const reduced = usePrefersReducedMotion();

  const gridStyle: React.CSSProperties = {
    backgroundImage:
      "linear-gradient(rgb(var(--bg-surface)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--bg-surface)) 1px, transparent 1px)",
    backgroundSize: "48px 48px",
  };

  const focusMask = {
    maskImage: "radial-gradient(circle at 50% 45%, transparent 22%, black 58%)",
    WebkitMaskImage: "radial-gradient(circle at 50% 45%, transparent 22%, black 58%)",
  } as React.CSSProperties;

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* 0. Depth base — a cool tint and two soft radial pools so the surface
             reads as an environment rather than flat black (or flat white). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 28% 38%, rgb(var(--accent) / 0.05), transparent 62%)," +
            "radial-gradient(90% 70% at 88% 78%, rgb(var(--status-low) / 0.035), transparent 60%)," +
            "linear-gradient(180deg, rgb(var(--bg-secondary) / 0.55), transparent 45%)",
        }}
      />

      {/* 1. Grid — drifts one full cell over 40s. Oversized so the translate
             never exposes an edge. */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          maskImage: "radial-gradient(circle at 50% 32%, black, transparent 78%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 32%, black, transparent 78%)",
        }}
      >
        <div
          className={`absolute -inset-[60px] ${reduced ? "" : "animate-grid-drift"}`}
          style={gridStyle}
        />
      </div>

      {reduced ? null : (
        <div className="absolute inset-0" style={focusMask}>
          {/* 2 + 3. Links with travelling packets */}
          {LINKS.map((link, i) => (
            <div
              key={`link-${i}`}
              className="absolute h-px origin-left overflow-hidden bg-accent/25 animate-link-breathe dark:bg-accent/20"
              style={{
                top: `${link.top}%`,
                left: `${link.left}%`,
                width: `${link.width}%`,
                transform: `rotate(${link.rotate}deg)`,
                animationDelay: `${link.breatheDelay}s`,
                animationDuration: `${link.breatheDuration}s`,
              }}
            >
              <span
                className={`absolute top-1/2 h-[3px] w-[3px] -translate-y-1/2 rounded-full bg-accent shadow-[0_0_6px_1px_rgb(var(--accent)/0.5)] ${
                  link.reverse ? "animate-packet-rtl" : "animate-packet-travel"
                }`}
                style={{ animationDelay: `${link.delay}s`, animationDuration: `${link.duration}s` }}
              />
            </div>
          ))}

          {/* 4. Endpoint nodes */}
          {NODES.map((node, i) => (
            <span
              key={`node-${i}`}
              className="absolute h-1 w-1 rounded-full bg-accent/60 animate-node-breathe"
              style={{
                top: `${node.top}%`,
                left: `${node.left}%`,
                animationDelay: `${node.delay}s`,
                animationDuration: `${node.duration}s`,
              }}
            />
          ))}

          {/* 5. Occasional signal activity */}
          {SIGNALS.map((sig, i) => (
            <span
              key={`sig-${i}`}
              className="absolute h-[3px] w-[3px] rounded-full bg-accent animate-signal-blink"
              style={{
                top: `${sig.top}%`,
                left: `${sig.left}%`,
                animationDelay: `${sig.delay}s`,
                animationDuration: `${7 + (i % 3) * 1.7}s`,
              }}
            />
          ))}

          {/* 5b. Occasional threat-toned indicators. Abstract and unlabelled —
                 no count, name or severity is asserted; these convey that the
                 topology carries heterogeneous events, nothing more. */}
          {[
            { top: 26, left: 63, token: "--status-critical", delay: 3.1 },
            { top: 71, left: 19, token: "--status-medium", delay: 8.4 },
            { top: 47, left: 88, token: "--status-medium", delay: 13.2 },
          ].map((t, i) => (
            <span
              key={`threat-${i}`}
              className="absolute h-[3px] w-[3px] rounded-full animate-signal-blink"
              style={{
                top: `${t.top}%`,
                left: `${t.left}%`,
                backgroundColor: `rgb(var(${t.token}))`,
                animationDelay: `${t.delay}s`,
                animationDuration: "16s",
              }}
            />
          ))}

          {/* 6. Slow diagonal scanning wave */}
          <div className="absolute -inset-x-1/4 inset-y-0">
            <div className="h-40 w-full bg-gradient-to-b from-transparent via-accent/[0.07] to-transparent animate-wave-sweep dark:via-accent/[0.05]" />
          </div>
        </div>
      )}
    </div>
  );
}
