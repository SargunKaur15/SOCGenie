import { useEffect, useMemo } from "react";

/**
 * A one-shot, full-screen cinematic overlay played when the analyst
 * navigates INTO MITRE ATT&CK — "entering the tactical intelligence map"
 * rather than a plain page fade. Purely a visual overlay: the MITRE page
 * is already mounted underneath by the time this renders (App.tsx's `page`
 * state change is synchronous), so it can never block or delay navigation —
 * it just fades away and unmounts itself via `onDone`.
 *
 * Only ever rendered when prefers-reduced-motion is off (the caller gates
 * that); the existing page-level fade in AppShell already provides the
 * reduced-motion-safe fallback.
 *
 * CSS-only (no Canvas/WebGL) — a ~1.4s one-shot effect doesn't justify the
 * cost of mounting a second Three.js scene during a navigation boundary.
 *
 * Phases (roughly): 0-250ms dim/vignette in, 150-900ms energy ring expands,
 * 280-1030ms grid tunnel forms, 550-1050ms streaks travel outward,
 * 1000-1400ms everything resolves/fades — "entering the intelligence map"
 * as one deliberate cinematic beat.
 */

const STREAK_COUNT = 16;

export function MitreEntryTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 1400);
    return () => window.clearTimeout(id);
  }, [onDone]);

  const streaks = useMemo(
    () =>
      Array.from({ length: STREAK_COUNT }, (_, i) => ({
        angle: (i / STREAK_COUNT) * 360,
        delay: 550 + (i % 4) * 45,
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
      {/* Dim / vignette — darkens the outgoing view without ever going blank. */}
      <div
        className="absolute inset-0 animate-mitre-vignette"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 50%, transparent 30%, rgb(3 7 13 / 0.6) 100%)",
        }}
      />

      {/* Radial energy pulse — the core "emitting" outward. */}
      <div
        className="absolute left-1/2 top-1/2 h-[56vmin] w-[56vmin] -translate-x-1/2 -translate-y-1/2 animate-mitre-pulse-ring rounded-full border-2"
        style={{
          borderColor: "rgb(var(--accent))",
          boxShadow: "0 0 70px 12px rgb(var(--accent-secondary) / 0.3)",
          animationDelay: "150ms",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[36vmin] w-[36vmin] -translate-x-1/2 -translate-y-1/2 animate-mitre-pulse-ring rounded-full border"
        style={{ borderColor: "rgb(var(--accent-secondary))", animationDelay: "260ms" }}
      />

      {/* System scan — one thin diagonal sweep crossing the centre, gone
          well before the transition ends. A threat-intel system scanning
          the matrix, not a laser. */}
      <div
        className="absolute left-[-20%] top-0 h-px w-[140%] animate-mitre-scan"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgb(var(--accent) / 0.7) 45%, rgb(var(--accent-secondary) / 0.5) 55%, transparent)",
        }}
      />

      {/* Grid tunnel — a scaling, fading technical grid, masked to a soft
          circular vignette so it reads as depth/perspective rather than a
          flat tiled pattern. */}
      <div
        className="absolute inset-0 animate-mitre-tunnel"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--accent) / 0.3) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgb(var(--accent) / 0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at 50% 50%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black, transparent 70%)",
        }}
      />

      {/* Particle streaks — radiating outward, cyan/violet only. */}
      {streaks.map((s) => (
        <div
          key={s.angle}
          className="absolute left-1/2 top-1/2 h-[2px] w-9 origin-left animate-mitre-streak rounded-full"
          style={
            {
              "--streak-angle": `${s.angle}deg`,
              animationDelay: `${s.delay}ms`,
              background: `linear-gradient(90deg, rgb(var(${
                s.angle % 40 < 20 ? "--accent" : "--accent-secondary"
              })), transparent)`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
