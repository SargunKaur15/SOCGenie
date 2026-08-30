/* ---------------------------------------------------------------------------
   Assignment hooks — Phase 19.

   Every mutation invalidates the queries, so the dashboard re-reads SERVER
   state after a confirmed success. The UI is never updated optimistically:
   showing an assignment the server rejected is precisely the divergence this
   phase removes.
--------------------------------------------------------------------------- */
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentApi, AssignmentApiError } from "../lib/api/assignments";

export const assignmentKeys = {
  assignments: ["assignments"] as const,
  analysts: ["analysts"] as const,
  audit: ["assignment-audit"] as const,
};

export function useAssignments() {
  return useQuery({ queryKey: assignmentKeys.assignments, queryFn: assignmentApi.list });
}

export function useAnalysts() {
  return useQuery({ queryKey: assignmentKeys.analysts, queryFn: assignmentApi.analysts });
}

export function useAssignmentAudit(enabled: boolean) {
  return useQuery({ queryKey: assignmentKeys.audit, queryFn: assignmentApi.audit, enabled });
}

export interface MutationState {
  busy: boolean;
  error: string | null;
  success: string | null;
}

/** Wraps the mutations with busy/error/success state and a refetch on success. */
export function useAssignmentActions() {
  const qc = useQueryClient();
  const [state, setState] = useState<MutationState>({ busy: false, error: null, success: null });

  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>, done: (r: unknown) => string) => {
      setState({ busy: true, error: null, success: null });
      try {
        const result = await fn();
        // Refetch BEFORE reporting success, so the table the analyst sees is
        // server state and not an assumption.
        await Promise.all([
          qc.invalidateQueries({ queryKey: assignmentKeys.assignments }),
          qc.invalidateQueries({ queryKey: assignmentKeys.analysts }),
          qc.invalidateQueries({ queryKey: assignmentKeys.audit }),
        ]);
        setState({ busy: false, error: null, success: done(result) });
      } catch (err) {
        const message =
          err instanceof AssignmentApiError ? err.message : `${label} failed. Please retry.`;
        setState({ busy: false, error: message, success: null });
      }
    },
    [qc]
  );

  return {
    state,
    clear: () => setState({ busy: false, error: null, success: null }),
    assign: (ref: string, analyst: string) =>
      run("Assign", () => assignmentApi.assign(ref, analyst), () => `${ref} assigned to ${analyst}.`),
    unassign: (ref: string) =>
      run("Unassign", () => assignmentApi.unassign(ref), () => `${ref} is now unassigned.`),
    roundRobin: (ref: string) =>
      run("Round-robin", () => assignmentApi.roundRobin(ref), (r) => {
        const a = (r as { assignment?: { assignedTo?: string | null } }).assignment?.assignedTo;
        return a ? `${ref} allocated to ${a}.` : `${ref} allocated.`;
      }),
    addAnalyst: (name: string) =>
      run("Add analyst", () => assignmentApi.addAnalyst(name), () => `${name} added to the roster.`),
    removeAnalyst: (name: string) =>
      run("Remove analyst", () => assignmentApi.removeAnalyst(name), (r) => {
        const n = (r as { unassigned?: string[] }).unassigned?.length ?? 0;
        return n > 0
          ? `${name} removed. ${n} alert${n === 1 ? "" : "s"} returned to the unassigned queue.`
          : `${name} removed from the roster.`;
      }),
  };
}
