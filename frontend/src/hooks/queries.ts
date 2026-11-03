import { useQuery } from "@tanstack/react-query";
import { logsApi, mlApi, mitreApi, detectionsApi, healthApi } from "../lib/api";

/**
 * useMlMetrics (queryFn: mlApi.metrics) was removed here — DetectionML.tsx,
 * its only consumer, now reads real training/evaluation metrics from
 * useMlStatus()'s own `metrics` field instead (populated from
 * model_card.json via server/src/mlProvider.ts). mlApi.metrics() itself
 * unconditionally threw NO_TRAINED_MODEL in this build regardless of whether
 * a model existed, because /api/ml/metrics is not a route the Node server
 * implements — DEMO_MODE's request() helper never even tried the network
 * call. Left in lib/api/ml.ts for now since removing it is a separate,
 * broader change than this fix.
 */

/**
 * Read-mostly, fixture/API-backed queries. Alerts, incidents, and analytics
 * are deliberately NOT here — those are mutable session state, owned by the
 * observable stores in src/mocks/* and read via hooks/useAlerts.ts and
 * hooks/useIncidents.ts. This file previously also exported a useAlerts, a
 * useIncidents, and a useAnalytics of its own, each wrapping a static
 * fixture snapshot through TanStack Query. All three had zero real
 * consumers except one accidental one (AppShell imported this useAlerts by
 * mistake, which is why the sidebar's alert badge never updated — see
 * AppShell.tsx). Removed rather than left as an unused trap for the next
 * person reaching for "useAlerts" and getting the wrong one.
 */

/** Query keys are centralised so Phase 2 mutations can invalidate precisely. */
export const qk = {
  health: ["health"] as const,
  events: (q: string) => ["events", q] as const,
  mlStatus: ["ml", "status"] as const,
  mlFeatures: ["ml", "features"] as const,
  mitre: ["mitre"] as const,
  detections: ["detections"] as const,
};

export const useHealth = () =>
  useQuery({ queryKey: qk.health, queryFn: healthApi.get, refetchInterval: 30_000 });

export const useEvents = (q = "") =>
  useQuery({ queryKey: qk.events(q), queryFn: () => logsApi.search({ q }) });

export const useMlStatus = () =>
  useQuery({ queryKey: qk.mlStatus, queryFn: mlApi.status });

export const useMitre = () =>
  useQuery({ queryKey: qk.mitre, queryFn: () => mitreApi.list() });

export const useDetections = () =>
  useQuery({ queryKey: qk.detections, queryFn: detectionsApi.list });
