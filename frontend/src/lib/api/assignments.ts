/* ---------------------------------------------------------------------------
   Assignment API client — Phase 19.

   THE SERVER IS THE SOURCE OF TRUTH. This module holds no assignment state of
   its own: every mutation posts to the server and the caller refetches. A
   client-side cache that could diverge from the server would reintroduce
   exactly the problem this phase exists to fix.

   Fetched same-origin through the Vite proxy so it works regardless of
   VITE_API_BASE_URL, and it deliberately does NOT use the DEMO_MODE `request()`
   helper — that returns a fixture before issuing any HTTP call.
--------------------------------------------------------------------------- */
import { authHeader } from "../auth/apiToken";

export interface Analyst {
  id: string;
  name: string;
  active: boolean;
}

export interface Assignment {
  alertRef: string;
  /** null when unassigned. Never "". */
  assignedTo: string | null;
  assignedAt: string | null;
}

export interface WorkloadRow {
  analyst: Analyst;
  count: number;
  alerts: string[];
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  alertRef: string | null;
  previousAnalyst: string | null;
  newAnalyst: string | null;
}

export class AssignmentApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { "content-type": "application/json", ...authHeader() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new AssignmentApiError("Cannot reach the SOCGenie backend. Is the server running?", 0);
  }

  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok) {
    // Surface the server's own message. 403 in particular must read as an
    // authorisation refusal, not a generic failure.
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : res.status === 401
          ? "Not authenticated. Sign in again."
          : res.status === 403
            ? "Administrator role required."
            : `Request failed (HTTP ${res.status}).`;
    throw new AssignmentApiError(message, res.status, typeof payload?.code === "string" ? payload.code : undefined);
  }
  return payload as T;
}

export const assignmentApi = {
  list: () => call<{ assignments: Assignment[]; workload: WorkloadRow[] }>("/api/assignments", "GET"),
  analysts: () => call<{ analysts: Analyst[] }>("/api/analysts", "GET"),
  audit: () => call<{ audit: AuditEvent[] }>("/api/assignments/audit", "GET"),

  assign: (alertRef: string, analyst: string) =>
    call<{ assignment: Assignment }>("/api/assignments", "POST", { alertRef, analyst }),

  unassign: (alertRef: string) =>
    call<{ assignment: Assignment }>("/api/assignments", "DELETE", { alertRef }),

  roundRobin: (alertRef: string) =>
    call<{ assignment: Assignment }>("/api/assignments/round-robin", "POST", { alertRef }),

  addAnalyst: (name: string) => call<{ analyst: Analyst }>("/api/analysts", "POST", { name }),

  removeAnalyst: (name: string) => call<{ unassigned: string[] }>("/api/analysts", "DELETE", { name }),
};
