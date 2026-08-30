/* ---------------------------------------------------------------------------
   Backend client.

   The ONLY place the frontend talks to the proxy. It holds no credential and
   knows no provider host — it calls a same-origin path, and Vite (dev) or the
   deployment (prod) routes /api to the server.

   Status is probed once and cached: the answer only changes when the server
   restarts, and re-probing on every render would be noise.
--------------------------------------------------------------------------- */

import { authHeader, setApiToken, clearApiToken } from "../auth/apiToken";

export interface BackendStatus {
  reachable: boolean;
  configured: boolean;
  provider: string;
  model: string | null;
  mode: "REAL_MODEL_CONNECTED" | "LOCAL_FALLBACK";
  authEnabled?: boolean;
}

export const UNREACHABLE: BackendStatus = {
  reachable: false,
  configured: false,
  provider: "none",
  model: null,
  mode: "LOCAL_FALLBACK",
};

let cached: BackendStatus | null = null;
let inflight: Promise<BackendStatus> | null = null;

export async function probeBackend(force = false): Promise<BackendStatus> {
  if (cached && !force) return cached;
  if (inflight && !force) return inflight;

  inflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 2500);
      const res = await fetch("/api/ai/status", { signal: controller.signal });
      window.clearTimeout(timer);
      if (!res.ok) {
        // Assign, so cachedBackendStatus() reports a definite state rather
        // than staying null on a non-2xx probe.
        cached = UNREACHABLE;
        return cached;
      }
      const data = (await res.json()) as Omit<BackendStatus, "reachable">;
      cached = { ...data, reachable: true };
      return cached;
    } catch {
      // No proxy running is the normal case in a frontend-only setup, so this
      // is not an error condition — it simply means the fallback is used.
      cached = UNREACHABLE;
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Synchronous read of the last probe. Null until the first probe resolves. */
export function cachedBackendStatus(): BackendStatus | null {
  return cached;
}

export interface BackendChatContext {
  alertRef?: string;
  host?: string;
  techniqueId?: string;
  severity?: string;
  evidence?: { label: string; value: string }[];
}

export interface BackendChatSuccess {
  ok: true;
  mode: "REAL_MODEL_CONNECTED";
  model: string;
  result: {
    answer: string;
    confidence: number;
    observed: string[];
    inferred: string[];
    recommended: string[];
    mitreTechniques: string[];
    contextualTechniques: string[];
    citedSources: number[];
    warnings: string[];
    insufficientEvidence: boolean;
    guardWarnings: string[];
  };
  sources: {
    index: number;
    documentId: string;
    title: string;
    source: string;
    excerpt: string;
    relevanceScore: number;
    url: string | null;
    evidenced: boolean;
  }[];
  insufficientKnowledge: string | null;
  redactionApplied: string[];
}

export interface BackendChatFailure {
  ok: false;
  code: string;
  error: string;
}

/**
 * Exchanges credentials for a signed bearer token.
 *
 * The password is sent to the backend and never stored. The token that comes
 * back carries a SERVER-SIGNED role, which is why the browser can no longer
 * influence its own privileges.
 */
export async function apiLogin(
  email: string,
  password: string
): Promise<{ ok: true; role: "admin" | "analyst" } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data: unknown = await res.json();
    if (!res.ok || typeof data !== "object" || data === null) {
      return { ok: false, error: "Invalid credentials" };
    }
    const d = data as { token?: unknown; role?: unknown };
    if (typeof d.token !== "string" || (d.role !== "admin" && d.role !== "analyst")) {
      return { ok: false, error: "Malformed login response" };
    }
    setApiToken(d.token, d.role);
    return { ok: true, role: d.role };
  } catch {
    // The proxy being absent is normal in a frontend-only setup.
    return { ok: false, error: "Backend unreachable" };
  }
}

export function apiLogout() {
  clearApiToken();
}

export async function postChat(
  message: string,
  context?: BackendChatContext,
  /** Selects the per-intent system prompt server-side. Omitted means the
   *  server applies "general". */
  intent?: string
): Promise<BackendChatSuccess | BackendChatFailure> {
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify({
        message,
        ...(context ? { context } : {}),
        ...(intent ? { intent } : {}),
      }),
    });
    const data: unknown = await res.json();
    if (res.ok && typeof data === "object" && data !== null && (data as { ok?: unknown }).ok === true) {
      return data as BackendChatSuccess;
    }
    const err = data as { error?: string; code?: string };
    return { ok: false, code: err.code ?? "INTERNAL_ERROR", error: err.error ?? "AI provider unavailable" };
  } catch {
    return { ok: false, code: "PROVIDER_UNAVAILABLE", error: "AI provider unavailable" };
  }
}
