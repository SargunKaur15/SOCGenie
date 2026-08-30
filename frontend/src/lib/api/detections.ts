import { request } from "./client";
import * as fx from "../data/fixtures";
import type { DetectionRule } from "../types";

export const detectionsApi = {
  list: () => request<DetectionRule[]>("/api/detections", () => fx.detectionRules),
};
