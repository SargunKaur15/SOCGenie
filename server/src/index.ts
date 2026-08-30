/* ---------------------------------------------------------------------------
   SOCGenie backend AI proxy — Phase 11 hardened.

   Endpoints
     GET  /api/health          liveness, unauthenticated
     GET  /api/ai/status       non-secret provider status, unauthenticated
     POST /api/auth/login      issues a signed bearer token
     POST /api/ai/chat         AUTHENTICATED  grounded, redacted, guarded
     GET  /api/admin/config    AUTHENTICATED + ADMIN ONLY

   Every response carries security headers. Origin is enforced against an
   allow-list; the API is credentialed, so "*" is never used.
--------------------------------------------------------------------------- */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadConfig, publicStatus, isProviderConfigured } from "./config";
import { RateLimiter, validateChatRequest, type ErrorCode } from "./validate";
import { handleChat } from "./handler";
import { mlStatus, scoreFlows } from "./mlProvider";
import { checkCredentials, extractBearer, issueToken, verifyToken, type TokenClaims } from "./auth";
import { SECURITY_HEADERS, checkJsonShape, checkOrigin, isJsonContentType } from "./security";

const cfg = loadConfig();
const generalLimiter = new RateLimiter(cfg.rateLimitMax, cfg.rateLimitWindowMs);
/** Separate, stricter budget: LLM calls cost money and upstream quota. */
const aiLimiter = new RateLimiter(cfg.aiRateLimitMax, cfg.rateLimitWindowMs);
const loginLimiter = new RateLimiter(10, cfg.rateLimitWindowMs);

const MAX_BODY_BYTES = 64 * 1024;

function send(res: ServerResponse, status: number, payload: unknown, extra: Record<string, string> = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    ...extra,
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(
  res: ServerResponse,
  status: number,
  code: ErrorCode,
  error: string,
  fallback = true,
  extra: Record<string, string> = {}
) {
  // Fixed strings only. No stack, no provider body, no internal detail.
  send(res, status, { error, code, fallback }, extra);
}

function readBody(req: IncomingMessage): Promise<{ ok: true; text: string } | { ok: false }> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        resolve({ ok: false });
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve({ ok: true, text: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", () => resolve({ ok: true, text: "" }));
  });
}

/** Parses and structurally bounds a JSON body. */
function parseJson(text: string): { ok: true; value: unknown } | { ok: false; reason: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Malformed JSON" };
  }
  const shape = checkJsonShape(value);
  return shape.ok ? { ok: true, value } : { ok: false, reason: shape.reason };
}

/** Authenticated identity, or null. Derived ONLY from a verified signature. */
function authenticate(req: IncomingMessage): TokenClaims | null {
  const header = (req.headers as Record<string, string | undefined>)["authorization"];
  const token = extractBearer(header);
  if (!token) return null;
  const result = verifyToken(token, cfg);
  return result.ok ? result.claims : null;
}

/** Rate-limit key: authenticated subject where available, else socket address. */
function limitKey(req: IncomingMessage, claims: TokenClaims | null): string {
  return claims ? `sub:${claims.sub}` : `ip:${req.socket.remoteAddress ?? "unknown"}`;
}

const server = createServer(async (req, res) => {
  const url = (req.url ?? "/").split("?")[0];
  const headers = req.headers as Record<string, string | undefined>;

  // ── Origin policy ───────────────────────────────────────────────────────
  const origin = checkOrigin(headers["origin"], cfg);
  if (!origin.allowed) {
    return sendError(res, 403, "UNAUTHORIZED", "Origin not allowed", false);
  }
  const corsHeaders: Record<string, string> = origin.allowOrigin
    ? {
        "access-control-allow-origin": origin.allowOrigin,
        "access-control-allow-headers": "content-type, authorization",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-credentials": "true",
        vary: "Origin",
      }
    : {};

  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...SECURITY_HEADERS, ...corsHeaders });
    return res.end();
  }

  // ── Unauthenticated endpoints ───────────────────────────────────────────
  if (url === "/api/health" && req.method === "GET") {
    // Returns the frontend HealthStatus shape with the REAL ML engine state.
    // Previously this returned {status:"ok"} only, so every surface driven by
    // useHealth() fell back to the fixture and reported "Not trained" even with
    // a model loaded.
    // publicStatus() is the server's own provider view — providerStatus() is a
    // frontend module and does not exist here.
    const ml = await mlStatus();
    const ai = publicStatus(cfg);
    return send(res, 200, {
      status: "ok",
      db: "unavailable",
      ml_engine: {
        loaded: ml.available,
        version: ml.available ? ml.modelVersion : null,
      },
      assist_provider: ai.configured ? "llm" : "rule_based",
    }, corsHeaders);
  }

  if (url === "/api/ai/status" && req.method === "GET") {
    return send(res, 200, publicStatus(cfg), corsHeaders);
  }

  // ── Login ───────────────────────────────────────────────────────────────
  if (url === "/api/auth/login") {
    if (req.method !== "POST") return sendError(res, 405, "VALIDATION_ERROR", "Method not allowed", false, corsHeaders);
    if (!isJsonContentType(headers["content-type"])) {
      return sendError(res, 415, "VALIDATION_ERROR", "Content-Type must be application/json", false, corsHeaders);
    }

    const rl = loginLimiter.check(`ip:${req.socket.remoteAddress ?? "unknown"}`);
    if (!rl.allowed) {
      return sendError(res, 429, "RATE_LIMITED", "Too many requests", false, {
        ...corsHeaders,
        "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)),
      });
    }

    const body = await readBody(req);
    if (!body.ok) return sendError(res, 413, "VALIDATION_ERROR", "Request body too large", false, corsHeaders);
    const parsed = parseJson(body.text);
    if (!parsed.ok) return sendError(res, 400, "VALIDATION_ERROR", parsed.reason, false, corsHeaders);

    const b = parsed.value as Record<string, unknown>;
    if (typeof b.email !== "string" || typeof b.password !== "string" ||
        b.email.length > 254 || b.password.length > 200) {
      return sendError(res, 400, "VALIDATION_ERROR", "email and password are required", false, corsHeaders);
    }

    const check = checkCredentials(b.email, b.password, cfg);
    if (!check.ok) {
      // Identical response for unknown account and wrong password.
      console.warn(`[socgenie/auth] failed login attempt for role ${check.role}`);
      return sendError(res, 401, "UNAUTHORIZED", "Invalid credentials", false, corsHeaders);
    }

    const token = issueToken(b.email.trim().toLowerCase(), check.role, cfg);
    return send(res, 200, { token, role: check.role, expiresIn: cfg.tokenTtlSeconds }, corsHeaders);
  }

  // ── Everything below requires authentication ────────────────────────────
  const claims = authenticate(req);

  if (url === "/api/admin/config") {
    if (!claims) return sendError(res, 401, "UNAUTHORIZED", "Authentication required", false, corsHeaders);
    // Authorisation is enforced HERE, server-side. Hiding a button is not
    // authorisation, and the role comes from a signed token the client
    // cannot edit.
    if (claims.role !== "admin") {
      return sendError(res, 403, "UNAUTHORIZED", "Insufficient privileges", false, corsHeaders);
    }
    if (req.method !== "GET") return sendError(res, 405, "VALIDATION_ERROR", "Method not allowed", false, corsHeaders);
    return send(res, 200, {
      // Non-secret configuration only. No key, no secret, no origin list.
      provider: publicStatus(cfg),
      limits: {
        maxMessageChars: cfg.maxMessageChars,
        providerTimeoutMs: cfg.providerTimeoutMs,
        rateLimitMax: cfg.rateLimitMax,
        aiRateLimitMax: cfg.aiRateLimitMax,
      },
    }, corsHeaders);
  }

  // ── ML: status is read-only metadata; scoring requires authentication ────
  if (url === "/api/ml/status") {
    if (req.method !== "GET") return sendError(res, 405, "VALIDATION_ERROR", "Method not allowed", true, corsHeaders);
    const status = await mlStatus();
    // Shaped as the existing frontend MlStatus contract, plus ML-specific
    // fields. Never a filesystem path, never a model file name.
    return send(res, 200, {
      model_name: "SOCGenie Attack Classifier",
      version: status.available ? status.modelVersion : null,
      status: status.available ? "active" : "not_trained",
      algorithm: "RandomForestClassifier (scikit-learn)",
      anomaly_algorithm: "IsolationForest (scikit-learn)",
      trained_at: null,
      dataset_name: status.available ? "CSE-CIC-IDS2018" : null,
      dataset_hash: null,
      feature_count: 22,
      sklearn_version: null,
      available: status.available,
      reason: status.available ? null : status.reason,
      schema_version: status.available ? status.schemaVersion : null,
      // Real figures from model_card.json. Absent when no model is loaded.
      metrics: status.available ? status.metrics ?? null : null,
    }, corsHeaders);
  }

  if (url === "/api/ml/score") {
    if (req.method !== "POST") return sendError(res, 405, "VALIDATION_ERROR", "Method not allowed", true, corsHeaders);
    if (!claims) return sendError(res, 401, "UNAUTHORIZED", "Authentication required", true, corsHeaders);
    if (!isJsonContentType(headers["content-type"])) {
      return sendError(res, 415, "VALIDATION_ERROR", "Content-Type must be application/json", true, corsHeaders);
    }
    if (!generalLimiter.check(limitKey(req, claims)).allowed) {
      return sendError(res, 429, "RATE_LIMITED", "Too many requests", true, corsHeaders);
    }

    const body = await readBody(req);
    if (!body.ok) return sendError(res, 413, "VALIDATION_ERROR", "Request body too large", true, corsHeaders);
    const parsed = parseJson(body.text);
    if (!parsed.ok) return sendError(res, 400, "VALIDATION_ERROR", parsed.reason, true, corsHeaders);

    const payload = parsed.value as { flows?: unknown };
    if (!Array.isArray(payload.flows) || payload.flows.length === 0 || payload.flows.length > 500) {
      return sendError(res, 400, "VALIDATION_ERROR", "`flows` must be an array of 1-500 objects", true, corsHeaders);
    }

    try {
      const result = await scoreFlows(payload.flows as Record<string, number>[], cfg);
      // ML unavailable is a 200 with available:false, NOT an error. Log
      // ingestion must never break because a model is offline.
      return send(res, 200, result, corsHeaders);
    } catch {
      return send(res, 200, { available: false, reason: "ML scoring failed." }, corsHeaders);
    }
  }

  if (url === "/api/ai/chat") {
    if (req.method !== "POST") return sendError(res, 405, "VALIDATION_ERROR", "Method not allowed", true, corsHeaders);
    if (!claims) return sendError(res, 401, "UNAUTHORIZED", "Authentication required", true, corsHeaders);
    if (!isJsonContentType(headers["content-type"])) {
      return sendError(res, 415, "VALIDATION_ERROR", "Content-Type must be application/json", true, corsHeaders);
    }

    const key = limitKey(req, claims);
    if (!generalLimiter.check(key).allowed) {
      return sendError(res, 429, "RATE_LIMITED", "Too many requests", true, {
        ...corsHeaders, "retry-after": String(Math.ceil(cfg.rateLimitWindowMs / 1000)),
      });
    }
    const ai = aiLimiter.check(key);
    if (!ai.allowed) {
      return sendError(res, 429, "RATE_LIMITED", "AI request budget exceeded", true, {
        ...corsHeaders, "retry-after": String(Math.ceil(ai.retryAfterMs / 1000)),
      });
    }

    const body = await readBody(req);
    if (!body.ok) return sendError(res, 413, "VALIDATION_ERROR", "Request body too large", true, corsHeaders);
    const parsed = parseJson(body.text);
    if (!parsed.ok) return sendError(res, 400, "VALIDATION_ERROR", parsed.reason, true, corsHeaders);

    const validated = validateChatRequest(parsed.value, cfg);
    if (!validated.ok) {
      return sendError(res, 400, validated.failure.code, validated.failure.error, true, corsHeaders);
    }

    try {
      const outcome = await handleChat(validated.value, cfg);
      if (!outcome.ok) {
        const status = outcome.code === "PROVIDER_TIMEOUT" ? 504 : 503;
        return sendError(res, status, outcome.code, outcome.error, true, corsHeaders);
      }
      return send(res, 200, outcome, corsHeaders);
    } catch (err) {
      // Message only — never the stack, never the provider body.
      console.error("[socgenie/ai] unhandled:", err instanceof Error ? err.message : "unknown");
      return sendError(res, 500, "INTERNAL_ERROR", "Internal error", true, corsHeaders);
    }
  }

  return sendError(res, 404, "VALIDATION_ERROR", "Not found", false, corsHeaders);
});

server.listen(cfg.port, () => {
  const status = publicStatus(cfg);
  console.log(`[socgenie/ai] proxy listening on :${cfg.port}`);
  console.log(`[socgenie/ai] provider: ${status.provider}  configured: ${status.configured}  mode: ${status.mode}`);
  console.log(`[socgenie/auth] authentication enabled: ${status.authEnabled}`);
  if (!status.authEnabled) {
    console.log("[socgenie/auth] NO demo password configured — all logins are refused (fail closed).");
  }
  console.log(`[socgenie/auth] allowed origins: ${cfg.allowedOrigins.join(", ")}`);
  if (!isProviderConfigured(cfg)) {
    console.log("[socgenie/ai] no API key present — clients will use the deterministic fallback");
  }
});
