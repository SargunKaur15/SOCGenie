import { request, DEMO_MODE, SocGenieApiError } from "./client";
import * as fx from "../data/fixtures";
import type { MlStatus, MlMetrics, FeatureImportance } from "../types";

export const mlApi = {
  /**
   * Fetched same-origin so it works regardless of VITE_API_BASE_URL. The
   * generic `request()` helper short-circuits to a fixture in DEMO_MODE, which
   * would hide a genuinely running model. On any failure this degrades to the
   * fixture, whose status is "not_trained" — an honest fallback, not a
   * fabricated one.
   */
  status: async (): Promise<MlStatus> => {
    try {
      const res = await fetch("/api/ml/status");
      if (!res.ok) return fx.mlStatus;
      const data = (await res.json()) as Partial<MlStatus>;
      if (typeof data.status !== "string") return fx.mlStatus;
      return { ...fx.mlStatus, ...data } as MlStatus;
    } catch {
      return fx.mlStatus;
    }
  },

  /**
   * Returns 404 NO_TRAINED_MODEL until Phase 9 produces artifacts.
   * We surface the real error rather than empty metrics so the UI can show an
   * honest "no model" state instead of zeros that look like results.
   */
  metrics: () =>
    request<MlMetrics>("/api/ml/metrics", () => {
      throw new SocGenieApiError(404, {
        code: "NO_TRAINED_MODEL",
        message: "No trained model artifact is available.",
      });
    }),

  features: () =>
    request<FeatureImportance[]>("/api/ml/features", () => {
      throw new SocGenieApiError(404, {
        code: "NO_TRAINED_MODEL",
        message: "Feature importances require a fitted model.",
      });
    }),

  /**
   * Phase 11 wires this to the loaded artifacts. In demo mode it rejects rather
   * than returning a plausible classification — SOCGenie never fabricates a
   * prediction (PRD v2.0 §14, Blueprint §14).
   */
  predict: (_features: Record<string, number | null>) => {
    if (DEMO_MODE) {
      return Promise.reject(
        new SocGenieApiError(503, {
          code: "MODEL_NOT_TRAINED",
          message: "SOCGenie ML Engine is not connected. Inference available from Phase 11.",
        })
      );
    }
    return request<never>("/api/ml/predict", () => {
      throw new Error("unreachable");
    }, { method: "POST", body: JSON.stringify({ features: _features }) });
  },
};
