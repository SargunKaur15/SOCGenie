import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * Canvas-rendered security network for the authentication surfaces.
 *
 * Replaces the previous DOM-node implementation: ~70 animated nodes as
 * absolutely-positioned elements meant ~70 style recalculations per frame.
 * A single canvas draws the same scene in one paint.
 *
 * ── SCENE ──────────────────────────────────────────────────────────────────
 *  3 parallax layers (far/mid/near) with different node counts, speeds, radii
 *  and alphas. Nodes drift continuously and wrap at the edges. Edges are
 *  computed per frame from proximity, so connections genuinely appear and
 *  dissolve as nodes move. Particles travel real edges. Nodes occasionally
 *  emit an expanding pulse, and a small minority carry success/critical tint
 *  to suggest heterogeneous security activity.
 *
 * ── HONESTY ────────────────────────────────────────────────────────────────
 *  Decorative only. Nothing here is derived from data and no count, label or
 *  value is drawn. Tinted nodes assert no severity.
 *
 * ── PERFORMANCE ────────────────────────────────────────────────────────────
 *  Single rAF loop, delta-timed so speed is frame-rate independent. Edge
 *  search is O(n²) within a layer only (~26² worst case). Rendering pauses
 *  entirely when the tab is hidden. DPR-aware, ResizeObserver-driven.
 *  Under prefers-reduced-motion one static frame is drawn and no loop starts.
 */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 0 = accent, 1 = success, 2 = critical, 3 = secondary (ambient depth) */
  tint: number;
  /** seconds until this node next pulses */
  pulseIn: number;
  /** 0 → 1 while a pulse expands, else -1 */
  pulseT: number;
}

interface Particle {
  a: number;
  b: number;
  t: number;
  speed: number;
  tint: number;
}

interface Layer {
  nodes: Node[];
  particles: Particle[];
  speed: number;
  alpha: number;
  maxDist: number;
  radius: [number, number];
}

const LAYER_SPEC = [
  { count: 26, speed: 3.5, alpha: 0.30, maxDist: 120, radius: [0.7, 1.2] as [number, number] },
  { count: 20, speed: 6.0, alpha: 0.48, maxDist: 150, radius: [1.0, 1.7] as [number, number] },
  { count: 12, speed: 9.0, alpha: 0.70, maxDist: 180, radius: [1.4, 2.2] as [number, number] },
];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Reads a design token stored as "r g b" and returns an rgba() builder.
 *  Keeps the canvas on the same palette as the rest of the UI and lets it
 *  re-theme without a colour table. rgba() is used rather than CSS Color 4
 *  slash syntax, which older canvas colour parsers reject. */
type Rgba = (alpha: number) => string;

function toRgba(triplet: string): Rgba {
  const [r, g, b] = triplet.split(/[\s,]+/).map((n) => Number(n) || 0);
  return (alpha: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string) => cs.getPropertyValue(name).trim() || "56 189 248";
  return {
    accent: toRgba(get("--accent")),
    success: toRgba(get("--status-success")),
    critical: toRgba(get("--status-critical")),
    secondary: toRgba(get("--accent-secondary")),
    line: toRgba(get("--border-default")),
    isLight: document.documentElement.classList.contains("light"),
  };
}

export function NetworkCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let layers: Layer[] = [];
    let tokens = readTokens();
    let raf = 0;
    let last = 0;

    const build = () => {
      layers = LAYER_SPEC.map((spec) => {
        const nodes: Node[] = Array.from({ length: spec.count }, () => {
          const roll = Math.random();
          return {
            x: rand(0, width),
            y: rand(0, height),
            vx: rand(-1, 1),
            vy: rand(-1, 1),
            r: rand(spec.radius[0], spec.radius[1]),
            // Deliberate minority: ~5% critical, ~8% success, ~12% ambient
            // secondary. The overwhelming majority stay on the primary accent.
            tint: roll > 0.95 ? 2 : roll > 0.87 ? 1 : roll > 0.75 ? 3 : 0,
            pulseIn: rand(4, 24),
            pulseT: -1,
          };
        });
        return { nodes, particles: [], speed: spec.speed, alpha: spec.alpha, maxDist: spec.maxDist, radius: spec.radius };
      });
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    const tintOf = (t: number): Rgba =>
      t === 1 ? tokens.success : t === 2 ? tokens.critical : t === 3 ? tokens.secondary : tokens.accent;

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, width, height);
      // Light surfaces need more ink for the same perceived subtlety.
      const weight = tokens.isLight ? 1.35 : 1;

      for (const layer of layers) {
        const { nodes, maxDist } = layer;

        // Advance nodes
        if (dt > 0) {
          for (const n of nodes) {
            n.x += n.vx * layer.speed * dt;
            n.y += n.vy * layer.speed * dt;
            if (n.x < -20) n.x = width + 20;
            if (n.x > width + 20) n.x = -20;
            if (n.y < -20) n.y = height + 20;
            if (n.y > height + 20) n.y = -20;

            if (n.pulseT >= 0) {
              n.pulseT += dt * 0.55;
              if (n.pulseT > 1) {
                n.pulseT = -1;
                n.pulseIn = rand(8, 28);
              }
            } else {
              n.pulseIn -= dt;
              if (n.pulseIn <= 0) n.pulseT = 0;
            }
          }
        }

        // Edges — recomputed each frame, so connections form and dissolve
        ctx.lineWidth = 1;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > maxDist * maxDist) continue;
            const d = Math.sqrt(d2);
            const fade = (1 - d / maxDist) * layer.alpha * 0.55 * weight;
            ctx.strokeStyle = tokens.line(fade);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            // Occasionally send a packet along this edge
            if (dt > 0 && layer.particles.length < 6 && Math.random() < 0.0012) {
              layer.particles.push({ a: i, b: j, t: 0, speed: rand(0.25, 0.5), tint: a.tint || b.tint });
            }
          }
        }

        // Particles travelling real edges
        for (let p = layer.particles.length - 1; p >= 0; p--) {
          const part = layer.particles[p];
          const a = nodes[part.a];
          const b = nodes[part.b];
          if (dt > 0) part.t += part.speed * dt;
          if (part.t >= 1 || !a || !b) {
            layer.particles.splice(p, 1);
            continue;
          }
          const px = a.x + (b.x - a.x) * part.t;
          const py = a.y + (b.y - a.y) * part.t;
          const fade = Math.sin(part.t * Math.PI) * layer.alpha * weight;
          ctx.fillStyle = tintOf(part.tint)(fade);
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Nodes + pulses
        for (const n of nodes) {
          if (n.pulseT >= 0) {
            const ease = 1 - Math.pow(1 - n.pulseT, 2);
            ctx.strokeStyle = tintOf(n.tint)((1 - n.pulseT) * 0.35 * layer.alpha * weight);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r + ease * 16, 0, Math.PI * 2);
            ctx.stroke();
          }
          const highlight = n.pulseT >= 0 ? 1.6 : 1;
          ctx.fillStyle = tintOf(n.tint)(layer.alpha * 0.9 * highlight * weight);
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const frame = (now: number) => {
      const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();

    if (reduced) {
      draw(0); // one static frame; no loop
    } else {
      start();
    }

    // Pause entirely while the tab is hidden
    const onVisibility = () => {
      if (reduced) return;
      document.hidden ? stop() : start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(canvas);

    // Re-read tokens when the theme class changes
    const mo = new MutationObserver(() => {
      tokens = readTokens();
      if (reduced) draw(0);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      stop();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Depth base — the surface should never read as flat black or flat white */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 28% 34%, rgb(var(--accent) / 0.05), transparent 62%)," +
            "radial-gradient(90% 70% at 86% 76%, rgb(var(--accent-secondary) / 0.045), transparent 60%)," +
            "linear-gradient(180deg, rgb(var(--bg-secondary) / 0.5), transparent 42%)",
        }}
      />

      {/* Fine grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--bg-surface)) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgb(var(--bg-surface)) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(circle at 50% 34%, black, transparent 76%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 34%, black, transparent 76%)",
        }}
      />

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Readability guard: damps the network behind the content band */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(72% 58% at 50% 50%, rgb(var(--bg-primary) / 0.55), transparent 72%)",
        }}
      />
    </div>
  );
}
