/* ---------------------------------------------------------------------------
   Backend session token.

   Held in MEMORY ONLY — deliberately not in localStorage or sessionStorage.
   A token in web storage is readable by any script that achieves execution on
   the page; a module-scoped variable is not. The cost is that a page reload
   requires signing in again, which is the correct trade for a credential.

   This is the ONLY thing the backend accepts as identity. The existing
   client-side session (lib/auth/session.ts) continues to drive UI state and is
   explicitly NOT treated as authentication.
--------------------------------------------------------------------------- */

let token: string | null = null;
let role: "admin" | "analyst" | null = null;

export function setApiToken(next: string, nextRole: "admin" | "analyst") {
  token = next;
  role = nextRole;
}

export function clearApiToken() {
  token = null;
  role = null;
}

export function hasApiToken(): boolean {
  return token !== null;
}

/** Server-asserted role. Differs from the UI role only if something is wrong. */
export function apiRole(): "admin" | "analyst" | null {
  return role;
}

/** Authorization header, or an empty object when unauthenticated. */
export function authHeader(): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}
