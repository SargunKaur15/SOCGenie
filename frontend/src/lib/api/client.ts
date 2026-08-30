/**
 * SOCGenie API client — THE SOLE NETWORK BOUNDARY.
 * No component may call fetch() directly.
 *
 * PHASE 1: no backend exists. `DEMO_MODE` is true whenever VITE_API_BASE_URL is
 * unset, and every resource module resolves against local fixtures instead.
 * Phase 2 sets the env var; not a single page component changes.
 */
import type { ApiError } from "../types";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
export const DEMO_MODE = API_BASE === "";

export class SocGenieApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "SocGenieApiError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Simulated latency so loading states are exercised during Phase 1 development. */
const DEMO_LATENCY_MS = 180;

/**
 * @param path      API path, e.g. "/api/alerts"
 * @param fallback  Phase-1 fixture resolver. Throw here to model a real error
 *                  (e.g. MODEL_NOT_TRAINED) rather than inventing a value.
 */
export async function request<T>(
  path: string,
  fallback: () => T,
  init?: RequestInit
): Promise<T> {
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, DEMO_LATENCY_MS));
    return fallback();
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let payload: { error?: ApiError };
    try {
      payload = await res.json();
    } catch {
      payload = {};
    }
    throw new SocGenieApiError(
      res.status,
      payload.error ?? { code: "UNKNOWN", message: res.statusText }
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}
