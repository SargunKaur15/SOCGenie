import { useQuery } from "@tanstack/react-query";
import {
  alertsApi, incidentsApi, logsApi, mlApi, mitreApi,
  detectionsApi, analyticsApi, healthApi,
} from "../lib/api";
import type { AlertQuery } from "../lib/api/alerts";

/** Query keys are centralised so Phase 2 mutations can invalidate precisely. */
export const qk = {
  health: ["health"] as const,
  alerts: (params: AlertQuery) => ["alerts", params] as const,
  incidents: ["incidents"] as const,
  events: (q: string) => ["events", q] as const,
  mlStatus: ["ml", "status"] as const,
  mlMetrics: ["ml", "metrics"] as const,
  mlFeatures: ["ml", "features"] as const,
  mitre: ["mitre"] as const,
  detections: ["detections"] as const,
  analytics: (range: string) => ["analytics", range] as const,
};

export const useHealth = () =>
  useQuery({ queryKey: qk.health, queryFn: healthApi.get, refetchInterval: 30_000 });

export const useAlerts = (params: AlertQuery = {}) =>
  useQuery({ queryKey: qk.alerts(params), queryFn: () => alertsApi.list(params) });

export const useIncidents = () =>
  useQuery({ queryKey: qk.incidents, queryFn: () => incidentsApi.list() });

export const useEvents = (q = "") =>
  useQuery({ queryKey: qk.events(q), queryFn: () => logsApi.search({ q }) });

export const useMlStatus = () =>
  useQuery({ queryKey: qk.mlStatus, queryFn: mlApi.status });

/** Expected to fail with NO_TRAINED_MODEL until Phase 9. No retries: the 404 is
 *  the answer, not a transient failure. */
export const useMlMetrics = () =>
  useQuery({ queryKey: qk.mlMetrics, queryFn: mlApi.metrics, retry: false });

export const useMitre = () =>
  useQuery({ queryKey: qk.mitre, queryFn: () => mitreApi.list() });

export const useDetections = () =>
  useQuery({ queryKey: qk.detections, queryFn: detectionsApi.list });

export const useAnalytics = (range: "24h" | "7d" | "30d" = "24h") =>
  useQuery({ queryKey: qk.analytics(range), queryFn: () => analyticsApi.summary(range) });
