import { request, qs } from "./client";
import * as fx from "../data/fixtures";
import type { AnalyticsSummary } from "../types";

export const analyticsApi = {
  summary: (range: "24h" | "7d" | "30d" = "24h") =>
    request<AnalyticsSummary>(`/api/analytics${qs({ range })}`, () => fx.analytics),
};
