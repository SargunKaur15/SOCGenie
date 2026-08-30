/* ---------------------------------------------------------------------------
   Server configuration — SECRETS LIVE HERE AND NOWHERE ELSE.

   Read from process.env, which exists only on the server. No value in this
   module is ever serialised into a response, logged, or exposed through any
   endpoint. `publicStatus()` is the ONLY thing the browser may see, and it
   deliberately returns booleans and names — never the key.
--------------------------------------------------------------------------- */

import { randomBytes } from "node:crypto";

export type ProviderName = "anthropic" | "openrouter" | "none";

export interface ServerConfig {
  provider: ProviderName;
  apiKey: string | null;
  model: string;
  port: number;
  /** Hard ceiling on an inbound message, in characters. */
  maxMessageChars: number;
  /** Upstream request timeout, milliseconds. */
  providerTimeoutMs: number;
  /** Requests allowed per window, per client. */
  rateLimitMax: number;
  rateLimitWindowMs: number;
  /** Stricter budget for LLM calls, which cost money and upstream quota. */
  aiRateLimitMax: number;

  // ── Phase 11 ──
  /** HMAC key for session tokens. Random per boot when unset, which logs out
   *  existing sessions on restart — acceptable, and far safer than a default. */
  authSecret: string;
  tokenTtlSeconds: number;
  demoAnalystPassword: string | null;
  demoAdminPassword: string | null;
  allowedOrigins: string[];
  /** Ceiling on an upstream provider response body, in bytes. */
  maxProviderBytes: number;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Default model per provider. Overridable with LLM_MODEL. */
const DEFAULT_MODEL: Record<Exclude<ProviderName, "none">, string> = {
  anthropic: "claude-sonnet-4-6",
  // OpenRouter's free tier changes over time; this is a starting point, not a
  // guarantee. If it 404s, set LLM_MODEL to any current ":free" model.
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
};

/** Each provider reads its own key. Resolving here keeps LlmProvider.complete()
 *  unchanged — a provider never needs to know which env var it came from. */
function resolveProvider(): { provider: ProviderName; apiKey: string | null } {
  const name = (process.env.LLM_PROVIDER ?? "none").toLowerCase();
  if (name === "anthropic") {
    return { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY?.trim() || null };
  }
  if (name === "openrouter") {
    return { provider: "openrouter", apiKey: process.env.OPENROUTER_API_KEY?.trim() || null };
  }
  return { provider: "none", apiKey: null };
}

export function loadConfig(): ServerConfig {
  const { provider, apiKey } = resolveProvider();

  return {
    provider,
    apiKey,
    model:
      process.env.LLM_MODEL?.trim() ||
      (provider === "none" ? "" : DEFAULT_MODEL[provider]),
    port: intFromEnv("PORT", 8787),
    maxMessageChars: intFromEnv("MAX_MESSAGE_CHARS", 4000),
    providerTimeoutMs: intFromEnv("PROVIDER_TIMEOUT_MS", 25_000),
    rateLimitMax: intFromEnv("RATE_LIMIT_MAX", 20),
    rateLimitWindowMs: intFromEnv("RATE_LIMIT_WINDOW_MS", 60_000),
    aiRateLimitMax: intFromEnv("AI_RATE_LIMIT_MAX", 8),

    // A random per-boot secret is safer than any shipped constant. Set
    // AUTH_SECRET to keep sessions alive across restarts.
    authSecret: process.env.AUTH_SECRET?.trim() || randomBytes(32).toString("hex"),
    tokenTtlSeconds: intFromEnv("TOKEN_TTL_SECONDS", 8 * 60 * 60),
    demoAnalystPassword: process.env.DEMO_ANALYST_PASSWORD?.trim() || null,
    demoAdminPassword: process.env.DEMO_ADMIN_PASSWORD?.trim() || null,
    allowedOrigins: (process.env.ALLOWED_ORIGINS?.trim() || "http://localhost:5173,http://127.0.0.1:5173")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    maxProviderBytes: intFromEnv("MAX_PROVIDER_BYTES", 256 * 1024),
  };
}

/**
 * A provider counts as configured only when BOTH a provider name and a key are
 * present. Treating a name alone as configured would let a half-finished .env
 * present itself as a working model.
 */
export function isProviderConfigured(cfg: ServerConfig): boolean {
  return cfg.provider !== "none" && cfg.apiKey !== null && cfg.apiKey.length > 0;
}

/** The only configuration shape the browser is ever given. Contains no secret. */
export function publicStatus(cfg: ServerConfig) {
  return {
    configured: isProviderConfigured(cfg),
    provider: isProviderConfigured(cfg) ? cfg.provider : ("none" as ProviderName),
    model: isProviderConfigured(cfg) ? cfg.model : null,
    mode: isProviderConfigured(cfg) ? ("REAL_MODEL_CONNECTED" as const) : ("LOCAL_FALLBACK" as const),
    // Boolean only. Never the secret, the passwords, or the origin list.
    authEnabled: cfg.demoAnalystPassword !== null || cfg.demoAdminPassword !== null,
  };
}
