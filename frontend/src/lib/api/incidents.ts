import { request, qs } from "./client";
import * as fx from "../data/fixtures";
import type { Incident, Page } from "../types";

export const incidentsApi = {
  list: (params: { status?: string; page?: number } = {}) =>
    request<Page<Incident>>(`/api/incidents${qs(params)}`, () => ({
      items: fx.incidents,
      total: fx.incidents.length,
      page: 1,
      size: 50,
    })),
};
