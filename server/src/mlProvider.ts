/* ---------------------------------------------------------------------------
   ML service client — Phase 13-A.

   Node is the only caller. The browser never reaches the Python service, which
   binds 127.0.0.1 and is not exposed. Same pattern as the OpenRouter provider:
   the proxy holds the upstream, the client holds nothing.

   ML UNAVAILABLE IS A NORMAL STATE, not an error. No model is trained yet, so
   the unavailable path is the default and is fully tested. Every failure —
   unreachable, timeout, malformed, wrong schema version — resolves to
   "unavailable", never to a fabricated score.
--------------------------------------------------------------------------- */
import type { ServerConfig } from "./config";

/** Localhost only. Not configurable to a remote host by design: an env var
 *  pointing elsewhere would turn this into an SSRF sink. */
const ML_BASE = "http://127.0.0.1:8000";
const DEFAULT_TIMEOUT_MS = 5000;

export interface MlPrediction {
  index: number;
  label: string;
  /** 0 when the predicted class is BENIGN. Enforced by the service AND here. */
  mlConfidence: number;
  anomalyScore: number;
  isBenign: boolean;
}

/** Real metrics read from model_card.json by the Python service. Optional
 *  because /score responses do not carry them. Never synthesised here. */
export interface MlModelMetrics {
  classes: string[];
  dataset: string | null;
  trainedAt: string | null;
  featureCount: number | null;
  macroF1: number | null;
  accuracy: number | null;
  benignHoldoutFpr: number | null;
  checksumsVerified: boolean;
}

export interface MlAvailable {
  available: true;
  modelVersion: string;
  schemaVersion: string;
  predictions: MlPrediction[];
  metrics?: MlModelMetrics;
}

export interface MlUnavailable {
  available: false;
  /** Safe, human-readable. Never a stack trace, path or internal Python error. */
  reason: string;
}

export type MlResult = MlAvailable | MlUnavailable;

const unavailable = (reason: string): MlUnavailable => ({ available: false, reason });

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Validates the upstream payload field by field. An ML response is untrusted
 *  input like any other: nothing is passed through unchecked. */
function parsePredictions(raw: unknown, expected: number): MlPrediction[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MlPrediction[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const p = item as Record<string, unknown>;
    if (!isFiniteNumber(p.index) || typeof p.label !== "string") return null;
    if (!isFiniteNumber(p.ml_confidence) || !isFiniteNumber(p.anomaly_score)) return null;
    if (p.ml_confidence < 0 || p.ml_confidence > 1) return null;
    if (p.anomaly_score < 0 || p.anomaly_score > 1) return null;

    const isBenign = p.is_benign === true || p.label === "BENIGN";
    out.push({
      index: p.index,
      label: p.label,
      // Re-applied here, independently of the service. A confidently benign
      // flow must never contribute ML risk, even if an upstream change forgot.
      mlConfidence: isBenign ? 0 : p.ml_confidence,
      anomalyScore: p.anomaly_score,
      isBenign,
    });
  }
  return out.length === expected ? out : null;
}

export async function mlStatus(timeoutMs = 2000): Promise<MlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${ML_BASE}/status`, { signal: controller.signal });
    if (!res.ok) return unavailable(`ML service responded ${res.status}.`);
    const data = (await res.json()) as Record<string, unknown>;
    if (data.available !== true) {
      return unavailable(typeof data.reason === "string" ? data.reason : "No trained model loaded.");
    }
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

    return {
      available: true,
      modelVersion: typeof data.model_version === "string" ? data.model_version : "unknown",
      schemaVersion: typeof data.schema_version === "string" ? data.schema_version : "unknown",
      predictions: [],
      // Passed through verbatim. A null means the model card did not record it,
      // which is reported as unavailable rather than filled with a default.
      metrics: {
        classes: Array.isArray(data.classes) ? data.classes.filter((c): c is string => typeof c === "string") : [],
        dataset: str(data.dataset),
        trainedAt: str(data.trained_at),
        featureCount: num(data.feature_count),
        macroF1: num(data.macro_f1),
        accuracy: num(data.accuracy),
        benignHoldoutFpr: num(data.benign_holdout_fpr),
        checksumsVerified: data.checksums_verified === true,
      },
    };
  } catch {
    // Not running is the expected state in Phase 13-A.
    return unavailable("ML service is not running.");
  } finally {
    clearTimeout(timer);
  }
}

export async function scoreFlows(
  flows: Record<string, number>[],
  cfg?: Pick<ServerConfig, "providerTimeoutMs">
): Promise<MlResult> {
  if (flows.length === 0) return unavailable("No flows supplied.");
  if (flows.length > 500) return unavailable("Too many flows in one request.");

  const controller = new AbortController();
  const timeout = Math.min(cfg?.providerTimeoutMs ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${ML_BASE}/score`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      // Only raw features. Engineered features are computed inside the service
      // so training and serving cannot diverge.
      body: JSON.stringify({ flows }),
    });

    if (!res.ok) return unavailable(`ML service responded ${res.status}.`);

    const data = (await res.json()) as Record<string, unknown>;
    if (data.available !== true) {
      return unavailable(typeof data.reason === "string" ? data.reason : "No trained model loaded.");
    }

    const predictions = parsePredictions(data.predictions, flows.length);
    if (predictions === null) return unavailable("ML service returned a malformed response.");

    if (typeof data.schema_version !== "string") {
      return unavailable("ML service did not report a feature schema version.");
    }

    return {
      available: true,
      modelVersion: typeof data.model_version === "string" ? data.model_version : "unknown",
      schemaVersion: data.schema_version,
      predictions,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    // Message only. Never the stack, never the upstream body.
    return unavailable(aborted ? "ML service timed out." : "ML service is unreachable.");
  } finally {
    clearTimeout(timer);
  }
}
