import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  incidentStore,
  type SocIncident,
  type IncidentWorkflowStatus,
} from "../mocks/incidentStore";
import { alertStore } from "../mocks/alertStore";

/**
 * Return shape is declared explicitly rather than inferred.
 *
 * If this module ever fails to resolve, consumers fall back to `any` and every
 * callback parameter downstream becomes an implicit any. An explicit interface
 * makes the contract visible at the call site and keeps the failure mode
 * obvious instead of cascading.
 */
export interface IncidentStoreApi {
  incidents: SocIncident[];
  setStatus: (ref: string, status: IncidentWorkflowStatus, actor: string) => void;
  assign: (ref: string, analyst: string, actor: string) => void;
  addNote: (ref: string, body: string, author: string) => void;
  editNote: (ref: string, noteId: string, body: string, actor: string) => void;
  simulateIsolation: (ref: string, actor: string) => void;
  logReview: (ref: string, actor: string, what: string) => void;
  refresh: () => void;
}

/**
 * Subscribes to the incident store.
 *
 * Named `useIncidentStore` deliberately: hooks/queries.ts already exports a
 * `useIncidents` TanStack query used by the Command Center, and shadowing it
 * would be a trap.
 */
export function useIncidentStore(): IncidentStoreApi {
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
