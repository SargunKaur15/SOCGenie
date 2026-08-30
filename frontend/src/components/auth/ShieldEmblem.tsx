import { Shield } from "lucide-react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * The SOCGenie shield with a scanning ring — the initialization screen's
 * counterpart to the login page's Intelligence Core, using the same visual
 * language at a smaller scale.
 *
 * A single orbital ring carries three signal nodes around the shield while
 * `scanning` is true; it stops once initialization completes. The mark itself
 * never rotates.
 */
export function ShieldEmblem({ size = 96, scanning = false }: { size?: number; scanning?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const animate = scanning && !reduced;
  const box = 120;
  const center = box / 2;
  const ringRadius = 52;

  const nodes = [0, 120, 240].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: center + ringRadius * Math.cos(rad), y: center + ringRadius * Math.sin(rad) };
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Radial depth behind the mark */}
      <div
        className={`absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.08] blur-2xl dark:bg-accent/[0.12] ${
          animate ? "animate-core-halo" : ""
        }`}
      />

      <svg viewBox={`0 0 ${box} ${box}`} className="absolute inset-0 h-full w-full">
        <g
          style={{
            transformOrigin: `${center}px ${center}px`,
            animation: animate ? "orbit-ring 14s linear infinite" : undefined,
          }}
        >
          <circle
            cx={center}
            cy={center}
            r={ringRadius}
            fill="none"
            stroke="rgb(var(--border-default))"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
          {nodes.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r="2.5" className="fill-accent" opacity="0.75" />
          ))}
        </g>
      </svg>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className={`relative flex items-center justify-center rounded-2xl border border-accent/30 bg-bg-surface shadow-panel ${
            animate ? "animate-core-breathe" : ""
          }`}
          style={{ width: size * 0.56, height: size * 0.56 }}
        >
          <Shield size={size * 0.26} strokeWidth={1.6} className="text-accent" />
          {animate && (
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
    </div>
  );
}
