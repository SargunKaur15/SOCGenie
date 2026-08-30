import { request, qs } from "./client";
import * as fx from "../data/fixtures";
import type { MitreTechnique } from "../types";

export const mitreApi = {
  list: (params: { tactic?: string } = {}) =>
    request<MitreTechnique[]>(`/api/mitre${qs(params)}`, () =>
      params.tactic ? fx.mitreTechniques.filter((m) => m.tactic === params.tactic) : fx.mitreTechniques
    ),
};
