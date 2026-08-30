/* ---------------------------------------------------------------------------
   Request validation.

   Frontend-supplied role is accepted into the type but NEVER used for
   authorisation — see handler.ts. There is no server-side identity yet, so
   trusting a client-declared role would be authorisation theatre.
--------------------------------------------------------------------------- */
import type { ServerConfig } from "./config";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const INTENTS = new Set([
  "analyze", "explain", "mitre", "investigate", "response",
  "incident_summary", "general",
]);

export interface ChatRequest {
  message: string;
  /** Selects the per-intent instruction block. Absent means "general". */
  intent?: string;
  context?: {
    alertRef?: string;
    host?: string;
    techniqueId?: string;
    severity?: string;
    /** Evidence label/value pairs already on screen. Redacted before use. */
    evidence?: { label: string; value: string }[];
  };
}

export interface ValidationFailure {
  code: ErrorCode;
  error: string;
}

const ALERT_REF = /^[A-Z]{2,5}-\d{1,10}$/;
const TECHNIQUE = /^T\d{4}(\.\d{3})?$/;
const HOST = /^[A-Za-z0-9._-]{1,64}$/;
const SEVERITY = new Set(["critical", "high", "medium", "low"]);

export function validateChatRequest(
  body: unknown,
  cfg: ServerConfig
): { ok: true; value: ChatRequest } | { ok: false; failure: ValidationFailure } {
  const fail = (error: string): { ok: false; failure: ValidationFailure } => ({
    ok: false,
    failure: { code: "VALIDATION_ERROR", error },
  });

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail("Request body must be a JSON object.");
  }
  const b = body as Record<string, unknown>;

  if (typeof b.message !== "string") return fail("`message` is required and must be a string.");
  const message = b.message.trim();
  if (message.length === 0) return fail("`message` must not be empty.");
  if (message.length > cfg.maxMessageChars) {
    return fail(`\`message\` exceeds the ${cfg.maxMessageChars} character limit.`);
  }

  // Reject unexpected top-level keys rather than silently ignoring them.
  // `role` is deliberately NOT accepted: identity comes from the verified
  // bearer token, never from the request body.
  const allowed = new Set(["message", "context", "intent"]);
  const unexpected = Object.keys(b).filter((k) => !allowed.has(k));
  if (unexpected.length > 0) return fail(`Unexpected field(s): ${unexpected.join(", ")}.`);

  const out: ChatRequest = { message };

  if (b.intent !== undefined) {
    if (typeof b.intent !== "string" || !INTENTS.has(b.intent)) {
      return fail(`\`intent\` must be one of: ${[...INTENTS].join(", ")}.`);
    }
    out.intent = b.intent;
  }

  if (b.context !== undefined) {
    if (typeof b.context !== "object" || b.context === null || Array.isArray(b.context)) {
      return fail("`context` must be an object.");
    }
    const c = b.context as Record<string, unknown>;
    const ctxAllowed = new Set(["alertRef", "host", "techniqueId", "severity", "evidence"]);
    const ctxUnexpected = Object.keys(c).filter((k) => !ctxAllowed.has(k));
    if (ctxUnexpected.length > 0) return fail(`Unexpected context field(s): ${ctxUnexpected.join(", ")}.`);

    const ctx: NonNullable<ChatRequest["context"]> = {};
    if (c.alertRef !== undefined) {
      if (typeof c.alertRef !== "string" || !ALERT_REF.test(c.alertRef)) {
        return fail("`context.alertRef` must look like ALT-10492.");
      }
      ctx.alertRef = c.alertRef;
    }
    if (c.techniqueId !== undefined) {
      if (typeof c.techniqueId !== "string" || !TECHNIQUE.test(c.techniqueId)) {
        return fail("`context.techniqueId` must be an ATT&CK ID such as T1059.001.");
      }
      ctx.techniqueId = c.techniqueId;
    }
    if (c.host !== undefined) {
      if (typeof c.host !== "string" || !HOST.test(c.host)) return fail("`context.host` is malformed.");
      ctx.host = c.host;
    }
    if (c.severity !== undefined) {
      if (typeof c.severity !== "string" || !SEVERITY.has(c.severity)) {
        return fail("`context.severity` must be critical, high, medium or low.");
      }
      ctx.severity = c.severity;
    }
    if (c.evidence !== undefined) {
      if (!Array.isArray(c.evidence) || c.evidence.length > 40) {
        return fail("`context.evidence` must be an array of at most 40 items.");
      }
      const evidence: { label: string; value: string }[] = [];
      for (const item of c.evidence) {
        if (typeof item !== "object" || item === null) return fail("Malformed evidence item.");
        const e = item as Record<string, unknown>;
        if (typeof e.label !== "string" || typeof e.value !== "string") {
          return fail("Each evidence item needs string `label` and `value`.");
        }
        if (e.label.length > 120 || e.value.length > 600) return fail("Evidence item too large.");
        evidence.push({ label: e.label, value: e.value });
      }
      ctx.evidence = evidence;
    }
    out.context = ctx;
  }

  return { ok: true, value: out };
}

/** Fixed-window counter. Adequate for a single-process local deployment;
 *  a distributed deployment needs a shared store, which is out of scope. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  /** Hard ceiling on tracked keys. Without it, one key per spoofed identity
   *  turns the limiter itself into a memory-exhaustion vector. */
  constructor(private max: number, private windowMs: number, private maxKeys = 10_000) {}

  private sweep(now: number) {
    // Amortised: at most once per window, not on every request.
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [k, v] of this.hits) {
      if (now >= v.resetAt) this.hits.delete(k);
    }
    // If still oversized after eviction, drop oldest-expiring entries.
    if (this.hits.size > this.maxKeys) {
      const sorted = [...this.hits.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
      for (const [k] of sorted.slice(0, this.hits.size - this.maxKeys)) this.hits.delete(k);
    }
  }

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
    this.sweep(now);
    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      // Refuse to track a new key once at capacity: fail closed rather than grow.
      if (!entry && this.hits.size >= this.maxKeys) {
        return { allowed: false, retryAfterMs: this.windowMs };
      }
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (entry.count >= this.max) {
      return { allowed: false, retryAfterMs: entry.resetAt - now };
    }
    entry.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  /** Test/diagnostic only. */
  size(): number {
    return this.hits.size;
  }
}
