import { request, qs } from "./client";
import * as fx from "../data/fixtures";
import type { EventOut, Page } from "../types";

export const logsApi = {
  search: (params: { q?: string; host?: string; from?: string; to?: string; page?: number } = {}) =>
    request<Page<EventOut>>(`/api/logs/search${qs(params)}`, () => {
      let items = [...fx.events];
      if (params.q) {
        const q = params.q.toLowerCase();
        items = items.filter((e) => e.raw_line.toLowerCase().includes(q));
      }
      return { items, total: items.length, page: 1, size: 100 };
    }),
};
