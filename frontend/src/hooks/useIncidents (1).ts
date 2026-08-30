import { useCallback, useEffect, useSyncExternalStore } from "react";
import { incidentStore, type IncidentWorkflowStatus } from "../mocks/incidentStore";
import { alertStore } from "../mocks/alertStore";

/**
 * Subscribes to the incident store.
 *
 * Named `useIncidentStore` deliberately: hooks/queries.ts already exports a
 * `useIncidents` TanStack query used by the Command Center, and shadowing it
 * would be a trap. This hook owns mutable workspace state; that one reads the
 * API contract.
 */
export function useIncidentStore() {
  const incidents = useSyncExternalStore(
    incidentStore.subscribe,
    incidentStore.getSnapshot,
    incidentStore.getSnapshot
  );

  // Materialise any alert escalated from the Alerts or Investigation workspace.
  useEffect(() => {
    incidentStore.sync();
    const unsubscribe = alertStore.subscribe(() => incidentStore.sync());
    // alertStore.subscribe returns () => boolean, because Set.delete reports
    // whether the entry existed. React's EffectCallback requires a cleanup
    // returning void, so the call is wrapped rather than returned directly.
    return () => {
      unsubscribe();
    };
  }, []);

  const setStatus = useCallback(
    (ref: string, status: IncidentWorkflowStatus, actor: string) =>
      incidentStore.setStatus(ref, status, actor),
    []
  );
  const assign = useCallback(
    (ref: string, analyst: string, actor: string) => incidentStore.assign(ref, analyst, actor),
    []
  );
  const addNote = useCallback(
    (ref: string, body: string, author: string) => incidentStore.addNote(ref, body, author),
    []
  );
  const editNote = useCallback(
    (ref: string, noteId: string, body: string, actor: string) =>
      incidentStore.editNote(ref, noteId, body, actor),
    []
  );
  const simulateIsolation = useCallback(
    (ref: string, actor: string) => incidentStore.simulateIsolation(ref, actor),
    []
  );
  const logReview = useCallback(
    (ref: string, actor: string, what: string) => incidentStore.logReview(ref, actor, what),
    []
  );
  const refresh = useCallback(() => incidentStore.refresh(), []);

  return { incidents, setStatus, assign, addNote, editNote, simulateIsolation, logReview, refresh };
}
