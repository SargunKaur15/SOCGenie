import { request, qs } from "./client";
import * as fx from "../data/fixtures";
import type { Alert, Page, Severity, AlertStatus } from "../types";

export interface AlertQuery {
  severity?: Severity | "";
  status?: AlertStatus | "";
  q?: string;
  sort?: "risk_desc" | "risk_asc" | "time_desc";
  page?: number;
  size?: number;
}

function applyFixtureQuery(params: AlertQuery): Page<Alert> {
  let items = [...fx.alerts];
  if (params.severity) items = items.filter((a) => a.severity === params.severity);
  if (params.status) items = items.filter((a) => a.status === params.status);
  if (params.q) {
    const q = params.q.toLowerCase();
    items = items.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.alert_ref.toLowerCase().includes(q) ||
        (a.host ?? "").toLowerCase().includes(q) ||
        (a.user ?? "").toLowerCase().includes(q)
    );
  }
  if (params.sort === "risk_asc") items.sort((a, b) => a.risk_score - b.risk_score);
  else if (params.sort === "time_desc") items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  else items.sort((a, b) => b.risk_score - a.risk_score);
  return { items, total: items.length, page: params.page ?? 1, size: params.size ?? 50 };
}

export const alertsApi = {
  list: (params: AlertQuery = {}) =>
    request<Page<Alert>>(`/api/alerts${qs(params as Record<string, string>)}`, () => applyFixtureQuery(params)),

  get: (ref: string) =>
    request<Alert>(`/api/alerts/${ref}`, () => {
      const found = fx.alerts.find((a) => a.alert_ref === ref);
      if (!found) throw new Error(`Alert ${ref} not found`);
      return found;
    }),
};
