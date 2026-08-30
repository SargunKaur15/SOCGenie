import { useEffect, useState } from "react";

/**
 * Tracks the OS reduced-motion preference.
 *
 * index.css already neutralises CSS animation durations globally, but that only
 * freezes animations at their end state. Decorative layers need to be removed
 * entirely, and the initialization sequence needs to shorten its pacing, so
 * those components read the preference directly.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
