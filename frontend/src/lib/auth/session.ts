/* ---------------------------------------------------------------------------
   Session store — MOCK AUTHENTICATION, Phase 1.

   The application previously had no user state at all: the login form called
   onLogin() with no arguments and the top bar rendered a hardcoded name. The
   selected role could not reach the dashboard because nothing carried it.

   This module is the missing piece. It owns the signed-in user and is the sole
   source of identity for the whole app.

   NOT REAL AUTHENTICATION. No password is verified and no token is issued.
   Role is derived from the submitted address so that typing an address by hand
   behaves identically to clicking a demo card. Phase 2 replaces signIn() with
   a call to POST /api/auth/login and reads the role from the returned claims —
   no consumer changes, because they all read through useSession().
--------------------------------------------------------------------------- */

export type UserRole = "analyst" | "admin";

export interface SocUser {
  name: string;
  email: string;
  role: UserRole;
  /** Display string for the role, e.g. "SOC Admin". */
  roleLabel: string;
  initials: string;
}

/** Demo identities. Kept here so no component invents a name. */
const PROFILES: Record<UserRole, Omit<SocUser, "email">> = {
  analyst: { name: "A. Sharma", role: "analyst", roleLabel: "SOC Analyst", initials: "AS" },
  admin: { name: "M. Raghavan", role: "admin", roleLabel: "SOC Admin", initials: "MR" },
};

const STORAGE_KEY = "socgenie.session";

/** Local-part decides the role: admin@… is an admin, anything else an analyst. */
export function roleFromEmail(email: string): UserRole {
  const local = email.trim().toLowerCase().split("@")[0];
  return local === "admin" || local.endsWith(".admin") || local.startsWith("admin.")
    ? "admin"
    : "analyst";
}

export function userFromEmail(email: string): SocUser {
  const role = roleFromEmail(email);
  return { ...PROFILES[role], email: email.trim().toLowerCase() || `${role}@socgenie.demo` };
}

function restore(): SocUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: unknown };
    return typeof parsed.email === "string" ? userFromEmail(parsed.email) : null;
  } catch {
    return null; // storage unavailable or corrupt — treat as signed out
  }
}

let current: SocUser | null = restore();
let snapshot = current;
const listeners = new Set<() => void>();

function emit() {
  snapshot = current;
  listeners.forEach((l) => l());
}

export const sessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): SocUser | null {
    return snapshot;
  },

  signIn(email: string): SocUser {
    current = userFromEmail(email);
    try {
      // sessionStorage, not localStorage: a session should not outlive the tab.
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email: current.email }));
    } catch {
      /* non-fatal — the session simply will not survive a reload */
    }
    if (import.meta.env.DEV) {
      // Trace so a broken chain is visible in the console rather than showing
      // a silently wrong identity.
      console.debug("[socgenie/session] signIn ->", current.email, current.role);
    }
    emit();
    return current;
  },

  signOut() {
    current = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
    emit();
  },
};
