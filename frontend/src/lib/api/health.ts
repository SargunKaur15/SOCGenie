import { request } from "./client";
import * as fx from "../data/fixtures";
import type { HealthStatus } from "../types";

export const healthApi = {
  /**
   * Fetched same-origin through the Vite proxy so it works regardless of
   * VITE_API_BASE_URL. The generic `request()` helper returns a fixture in
   * DEMO_MODE *before* issuing any HTTP call, which meant a running ML service
   * could never be reflected here. Falls back to the fixture only on failure,
   * where "not loaded" is the honest answer.
   */
  get: async (): Promise<HealthStatus> => {
    // TEMPORARY DIAGNOSTIC — Phase 13-C. Remove once ML status is confirmed.
    const trace = (stage: string, detail: unknown) =>
      console.log(`[socgenie/health] ${stage}`, detail);
    try {
      const res = await fetch("/api/health");
      trace("GET /api/health ->", `HTTP ${res.status} ${res.headers.get("content-type") ?? ""}`);
      if (!res.ok) {
        trace("non-2xx, falling back to fixture", fx.health.ml_engine);
        return fx.health;
      }
      const data = (await res.json()) as Partial<HealthStatus>;
      trace("body received", data);
      if (!data || typeof data.ml_engine !== "object" || data.ml_engine === null) {
        trace("no ml_engine field -> fixture. Node was NOT rebuilt, or the old build is running.", data);
        return fx.health;
      }
      const merged = { ...fx.health, ...data } as HealthStatus;
      trace("ml_engine.loaded used by the UI =", merged.ml_engine.loaded);
      return merged;
    } catch (err) {
      trace("fetch threw -> fixture. Vite proxy or Node is unreachable.", err instanceof Error ? err.message : err);
      return fx.health;
    }
  },
};
