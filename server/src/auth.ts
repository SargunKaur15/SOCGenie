/* ---------------------------------------------------------------------------
   Server-side authentication — HMAC-signed bearer tokens.

   WHAT THIS ACTUALLY ACHIEVES, stated plainly:

     - The ROLE is signed by the server and cannot be forged or edited by the
       browser. This is the security property that matters: previously a client
       could have claimed any role.
     - Tokens expire and tampering is rejected by signature verification.

   WHAT IT DOES NOT ACHIEVE:

     - The demo credential is a shared, non-secret password that already
       appears in the login UI. This authenticates a ROLE CHOICE, not a person.
       It is deliberately NOT presented as identity assurance.
     - A real deployment needs an identity provider issuing per-user
       credentials. That is out of scope and is recorded as a limitation, not
       papered over.

   Node's crypto only — no dependency.
--------------------------------------------------------------------------- */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ServerConfig } from "./config";

export type Role = "admin" | "analyst";

export interface TokenClaims {
  sub: string;
  role: Role;
  /** Seconds since epoch. */
  exp: number;
  /** Random, so two tokens for the same user differ. */
  jti: string;
}

const b64url = (buf: Buffer) => buf.toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

function sign(payload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payload).digest());
}

/** Constant-time comparison; length mismatch short-circuits safely. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function issueToken(sub: string, role: Role, cfg: ServerConfig): string {
  const claims: TokenClaims = {
    sub,
    role,
    exp: Math.floor(Date.now() / 1000) + cfg.tokenTtlSeconds,
    jti: randomBytes(9).toString("base64url"),
  };
  const payload = b64url(Buffer.from(JSON.stringify(claims)));
  return `${payload}.${sign(payload, cfg.authSecret)}`;
}

export type VerifyResult =
  | { ok: true; claims: TokenClaims }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

export function verifyToken(token: string, cfg: ServerConfig): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payload, signature] = parts;

  // Signature FIRST — never parse attacker-controlled JSON before verifying.
  if (!safeEqual(signature, sign(payload, cfg.authSecret))) {
    return { ok: false, reason: "bad-signature" };
  }

  let claims: TokenClaims;
  try {
    const parsed: unknown = JSON.parse(fromB64url(payload).toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return { ok: false, reason: "malformed" };
    const c = parsed as Record<string, unknown>;
    if (typeof c.sub !== "string" || typeof c.exp !== "number") return { ok: false, reason: "malformed" };
    if (c.role !== "admin" && c.role !== "analyst") return { ok: false, reason: "malformed" };
    claims = { sub: c.sub, role: c.role, exp: c.exp, jti: String(c.jti ?? "") };
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (claims.exp * 1000 < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, claims };
}

/** Role derived SERVER-SIDE from the address. The client cannot influence it. */
export function roleForEmail(email: string): Role {
  const local = email.trim().toLowerCase().split("@")[0];
  return local === "admin" ? "admin" : "analyst";
}

export interface CredentialCheck {
  ok: boolean;
  role: Role;
}

/**
 * Verifies the demo credential in constant time.
 *
 * When no password is configured the server refuses ALL logins rather than
 * defaulting to open. Failing closed is the only defensible default for an
 * endpoint that spends an API key.
 */
export function checkCredentials(email: string, password: string, cfg: ServerConfig): CredentialCheck {
  const role = roleForEmail(email);
  const expected = role === "admin" ? cfg.demoAdminPassword : cfg.demoAnalystPassword;
  if (!expected) return { ok: false, role };
  return { ok: safeEqual(password, expected), role };
}

export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}
