/* ---------------------------------------------------------------------------
   Transport-level hardening: headers, origin policy, content-type, JSON shape.
--------------------------------------------------------------------------- */
import type { ServerConfig } from "./config";

/**
 * Applied to every response.
 *
 * No CSP here: this server returns JSON only and never serves HTML, so a CSP
 * would protect nothing while risking breakage of the Vite-served app. The
 * frontend's CSP belongs in the deployment that serves it — recorded in the
 * documentation rather than faked here.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "cross-origin-resource-policy": "same-site",
  // Every response here is per-request and may carry alert data.
  "cache-control": "no-store, no-cache, must-revalidate",
  pragma: "no-cache",
};

export interface OriginDecision {
  allowed: boolean;
  /** Echoed origin, never "*" — the API is credentialed. */
  allowOrigin: string | null;
}

export function checkOrigin(origin: string | undefined, cfg: ServerConfig): OriginDecision {
  // Same-origin and non-browser callers (curl, tests) send no Origin header.
  if (!origin) return { allowed: true, allowOrigin: null };
  if (cfg.allowedOrigins.includes(origin)) return { allowed: true, allowOrigin: origin };
  return { allowed: false, allowOrigin: null };
}

/** Rejects anything that is not JSON, which blocks simple-request CSRF forms. */
export function isJsonContentType(header: string | undefined): boolean {
  if (!header) return false;
  return header.split(";")[0].trim().toLowerCase() === "application/json";
}

export interface ShapeLimits {
  maxDepth: number;
  maxKeys: number;
  maxArrayLength: number;
}

export const DEFAULT_SHAPE_LIMITS: ShapeLimits = { maxDepth: 8, maxKeys: 200, maxArrayLength: 100 };

/**
 * Structural bound on parsed JSON.
 *
 * Size alone does not bound cost: 64 KB of deeply nested arrays is cheap to
 * send and expensive to walk. Also rejects `__proto__` and `constructor` keys
 * outright — validate.ts builds fields explicitly so pollution is not currently
 * reachable, but defence in depth costs nothing here.
 */
export function checkJsonShape(
  value: unknown,
  limits: ShapeLimits = DEFAULT_SHAPE_LIMITS,
  depth = 0
): { ok: true } | { ok: false; reason: string } {
  if (depth > limits.maxDepth) return { ok: false, reason: "JSON nesting too deep." };

  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayLength) return { ok: false, reason: "Array too long." };
    for (const item of value) {
      const r = checkJsonShape(item, limits, depth + 1);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length > limits.maxKeys) return { ok: false, reason: "Too many object keys." };
    for (const k of keys) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") {
        return { ok: false, reason: "Disallowed property name." };
      }
      const r = checkJsonShape((value as Record<string, unknown>)[k], limits, depth + 1);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  if (typeof value === "string" && value.length > 8000) {
    return { ok: false, reason: "String value too long." };
  }
  return { ok: true };
}
