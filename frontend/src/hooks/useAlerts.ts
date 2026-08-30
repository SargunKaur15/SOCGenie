import { useCallback, useSyncExternalStore } from "react";
import { automationStore } from "../mocks/automationStore";
import { alertStore, type TriageStatus } from "../mocks/alertStore";

/**
 * Subscribes to the alert store.
 *
 * useSyncExternalStore rather than context: the store is a plain observable, so
 * Phase 4 can swap its mutators for API calls without any component knowing.
 */
export function useAlerts() {
  const alerts = useSyncExternalStore(alertStore.subscribe, alertStore.getSnapshot, alertStore.getSnapshot);

  const setStatus = useCallback((refs: string[], status: TriageStatus) => {
    alertStore.setStatus(refs, status);
  }, []);

  const addNote = useCallback((ref: string, body: string, author?: string) => {
    // Author must be threaded through: the store's default would otherwise
    // attribute every note to the seed analyst regardless of who is signed in.
    alertStore.addNote(ref, body, author);
  }, []);

  const editNote = useCallback((ref: string, noteId: string, body: string) => {
    alertStore.editNote(ref, noteId, body);
  }, []);

  const ingest = useCallback((incoming: Parameters<typeof alertStore.ingest>[0]) => alertStore.ingest(incoming), []);

  const escalate = useCallback((ref: string) => alertStore.escalate(ref), []);

  const refresh = useCallback(() => alertStore.refresh(), []);

  return { alerts, setStatus, addNote, editNote, escalate, refresh, ingest };
}

/**
 * Phase 15 automation state. Separate hook so nothing in the alert path
 * changes — this is additive and advisory.
 */
export function useAutomation() {
  const records = useSyncExternalStore(
    automationStore.subscribe,
    automationStore.getSnapshot,
    automationStore.getSnapshot
  );
  const audit = useSyncExternalStore(
    automationStore.subscribe,
    automationStore.getAuditSnapshot,
    automationStore.getAuditSnapshot
  );
  return { records, audit, store: automationStore };
}
