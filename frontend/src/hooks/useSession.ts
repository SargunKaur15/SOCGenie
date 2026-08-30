import { useSyncExternalStore } from "react";
import { sessionStore, type SocUser } from "../lib/auth/session";

/**
 * The signed-in user, or null when signed out.
 *
 * Single source of identity: no component should hardcode an analyst name.
 */
export function useSession(): SocUser | null {
  return useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getSnapshot
  );
}

/**
 * Convenience for surfaces that render only while signed in.
 *
 * The fallback is deliberately NOT a real analyst name: defaulting to
 * "A. Sharma" would silently record an admin's actions against the analyst if
 * the session were ever missing. An obviously wrong value surfaces the fault.
 */
export function useCurrentAnalystName(fallback = "Unknown analyst"): string {
  return useSession()?.name ?? fallback;
}
