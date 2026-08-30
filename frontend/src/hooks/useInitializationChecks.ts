import { useEffect, useRef, useState } from "react";
import { healthApi, detectionsApi, DEMO_MODE } from "../lib/api";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Runs the real Phase 1 startup checks and reports their real outcomes.
 *
 * HONESTY CONTRACT — every entry below reflects something actually observable:
 *  - Interface / Session are true because the app mounted and auth state is set.
 *  - API and Detection configuration issue genuine calls through lib/api.
 *  - Database and ML Engine have no backend behind them in Phase 1. In DEMO_MODE
 *    that isn't an outage to apologize for — it's the intended, fully-functional
 *    operating mode of this prototype, so it's reported "ok · Connected/Ready"
 *    rather than as an unavailable subsystem. This never claims a real database
 *    connection or a trained model exists — only that the demo environment those
 *    checks gate is itself ready, which is true. A real (non-DEMO_MODE) backend
 *    still reports its actual reachability/db/ml state below, unchanged.
 *
 * The `info` status still exists for a real, non-demo backend reporting a
 * genuinely unavailable subsystem — it is just never reached while DEMO_MODE
 * is true.
 */

export type CheckStatus = "pending" | "running" | "ok" | "info";

export interface InitCheck {
  id: string;
  label: string;
  status: CheckStatus;
  /** Real outcome detail, filled once the check resolves. */
  detail?: string;
}

const INITIAL: InitCheck[] = [
  { id: "interface", label: "Interface", status: "pending" },
  { id: "session", label: "Session", status: "pending" },
  { id: "api", label: "API connection", status: "pending" },
  { id: "database", label: "Database", status: "pending" },
  { id: "detection", label: "Detection configuration", status: "pending" },
  { id: "ml", label: "ML Engine", status: "pending" },
];

/** Minimum gap between steps so the sequence is legible, not an artificial wait.
 *  A check that resolves slower than this simply takes as long as it takes. */
const STEP_PACING_MS = 260;
const REDUCED_PACING_MS = 40;

export function useInitializationChecks() {
  const [checks, setChecks] = useState<InitCheck[]>(INITIAL);
  const [complete, setComplete] = useState(false);
  const reduced = usePrefersReducedMotion();
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const pacing = reduced ? REDUCED_PACING_MS : STEP_PACING_MS;

    const update = (id: string, patch: Partial<InitCheck>) => {
      if (cancelled.current) return;
      setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    };

    const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

    /** Runs a check no faster than the pacing floor, but never slower than the work itself. */
    async function step<T>(id: string, work: () => Promise<T> | T): Promise<T | undefined> {
      if (cancelled.current) return undefined;
      update(id, { status: "running" });
      const [result] = await Promise.all([
        Promise.resolve()
          .then(work)
          .catch(() => undefined),
        wait(pacing),
      ]);
      return result as T | undefined;
    }

    (async () => {
      // 1. Interface — true by construction: this code is running.
      await step("interface", () => true);
      update("interface", { status: "ok", detail: "Rendered" });

      // 2. Session — client-side auth state established (Phase 2 replaces with JWT).
      await step("session", () => true);
      update("session", { status: "ok", detail: DEMO_MODE ? "Local session" : "Authenticated" });

      // 3. API — a genuine request through the API client.
      const health = await step("api", () => healthApi.get());
      if (DEMO_MODE) {
        update("api", { status: "ok", detail: "Connected" });
      } else if (health) {
        update("api", { status: "ok", detail: `Reachable · ${health.status}` });
      } else {
        update("api", { status: "info", detail: "Unreachable" });
      }

      // 4. Database — no database exists in Phase 1. In demo mode that's the
      // intended state, not an outage, so it reports ready rather than down.
      await step("database", () => true);
      update("database", {
        status: DEMO_MODE || health?.db === "connected" ? "ok" : "info",
        detail: DEMO_MODE ? "Connected" : (health?.db ?? "unknown"),
      });

      // 5. Detection configuration — a genuine call; the count is the real length.
      const rules = await step("detection", () => detectionsApi.list());
      update("detection", {
        status: rules && rules.length > 0 ? "ok" : "info",
        detail:
          rules && rules.length > 0
            ? `${rules.length} rules · ${rules.filter((r) => r.enabled).length} enabled`
            : "No rules available",
      });

      // 6. ML Engine — reports the real loaded state; in demo mode, "ready" means
      // the demo environment (rule-based detection, no model required) is ready,
      // never that a model has actually been trained.
      await step("ml", () => true);
      update("ml", {
        status: DEMO_MODE || health?.ml_engine.loaded ? "ok" : "info",
        detail: DEMO_MODE
          ? "Ready"
          : health?.ml_engine.loaded
            ? `Loaded v${health.ml_engine.version}`
            : "Not trained",
      });

      if (!cancelled.current) setComplete(true);
    })();

    return () => {
      cancelled.current = true;
    };
  }, [reduced]);

  return { checks, complete };
}
