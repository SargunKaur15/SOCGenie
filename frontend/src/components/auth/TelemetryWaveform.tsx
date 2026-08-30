import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/**
 * Ambient scrolling waveform beneath the SOC status strip.
 *
 * Decorative only, same convention as NetworkCanvas: no axis, no numbers, no
 * claim of measuring anything real — a composite of a few fixed sine waves
 * scrolling left, not Math.random() per frame. Renders one static frame
 * under prefers-reduced-motion.
 */
export function TelemetryWaveform({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;

    const cs = getComputedStyle(document.documentElement);
    const accent = (cs.getPropertyValue("--accent").trim() || "56 189 248").split(/\s+/).map(Number);
    const line = `rgb(${accent[0]} ${accent[1]} ${accent[2]})`;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      const mid = height / 2;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 3) {
        const phase = x * 0.045 + t;
        const y =
          mid +
          Math.sin(phase) * (height * 0.18) +
          Math.sin(phase * 2.3 + 1.2) * (height * 0.08) +
          Math.sin(phase * 0.5) * (height * 0.05);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = line;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    resize();
    draw(0);

    if (!reduced) {
      let start = 0;
      const frame = (now: number) => {
        if (!start) start = now;
        draw((now - start) / 700);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(() => {
      resize();
      draw(0);
    });
    ro.observe(canvas);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block h-full w-full ${className}`}
    />
  );
}
