import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  investigationStore,
  type InvestigationStatus,
  type InvestigationView,
} from "../mocks/investigationStore";
import { alertStore, type SocAlert } from "../mocks/alertStore";

export interface InvestigationStoreApi {
  investigations: InvestigationView[];
  setStatus: (alertRef: string, status: InvestigationStatus, actor: string) => void;
  assign: (alertRef: string, analyst: string, actor: string) => void;
  log: (alertRef: string, actor: string, action: string) => void;
  refresh: () => void;
}

/**
 * Joins the investigation overlay to its alert.
 *
 * Alerts stay owned by alertStore; this hook only pairs each record with the
 * alert it belongs to, so there is exactly one source of truth for alert data.
 */
export function useInvestigations(): InvestigationStoreApi {
  const records = useSyncExternalStore(
    investigationStore.subscribe,
    investigationStore.getSnapshot,
    investigationStore.getSnapshot
  );
  const alerts = useSyncExternalStore(
    alertStore.subscribe,
    alertStore.getSnapshot,
    alertStore.getSnapshot
  );

  useEffect(() => {
    investigationStore.sync();
    const unsubscribe = alertStore.subscribe(() => investigationStore.sync());
    // alertStore.subscribe returns () => boolean (Set.delete), and React's
    // EffectCallback requires a void cleanup, so the call is wrapped.
    return () => {
      unsubscribe();
    };
  }, []);

  const investigations = useMemo<InvestigationView[]>(() => {
    const byRef = new Map<string, SocAlert>(alerts.map((a: SocAlert) => [a.ref, a]));
    return records
      .map((r) => {
        const alert = byRef.get(r.alertRef);
        return alert ? { ...r, alert } : null;
      })
      .filter((v): v is InvestigationView => v !== null);
  }, [records, alerts]);

  const setStatus = useCallback(
    (alertRef: string, status: InvestigationStatus, actor: string) =>
      investigationStore.setStatus(alertRef, status, actor),
    []
  );
  const assign = useCallback(
    (alertRef: string, analyst: string, actor: string) =>
      investigationStore.assign(alertRef, analyst, actor),
    []
  );
  const log = useCallback(
    (alertRef: string, actor: string, action: string) =>
      investigationStore.log(alertRef, actor, action),
    []
  );
  const refresh = useCallback(() => investigationStore.refresh(), []);

  return { investigations, setStatus, assign, log, refresh };
}
