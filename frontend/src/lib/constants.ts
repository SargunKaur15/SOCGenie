import type { Severity, RiskBand, SecurityClass } from "./types";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

/** Tailwind class fragments keyed by severity. Colour is never the only signal —
 *  every consumer also renders SEVERITY_LABEL text. */
export const SEVERITY_CLASSES: Record<Severity, { text: string; bg: string; dot: string; border: string }> = {
  low: { text: "text-status-low", bg: "bg-status-low/10", dot: "bg-status-low", border: "border-status-low/30" },
  medium: { text: "text-status-medium", bg: "bg-status-medium/10", dot: "bg-status-medium", border: "border-status-medium/30" },
  high: { text: "text-status-high", bg: "bg-status-high/10", dot: "bg-status-high", border: "border-status-high/30" },
  critical: { text: "text-status-critical", bg: "bg-status-critical/10", dot: "bg-status-critical", border: "border-status-critical/30" },
};

/** PRD v2.0 §18 — risk bands. */
export function riskBand(score: number): RiskBand {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export const RISK_BAND_SEVERITY: Record<RiskBand, Severity> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

export const SECURITY_CLASSES: SecurityClass[] = [
  "BENIGN",
  "BRUTE_FORCE",
  "PORT_SCAN",
  "DOS",
  "DDOS",
  "WEB_ATTACK",
  "BOTNET",
];

/** The 22 features the classifier consumes (PRD v2.0 §7). Displayed in the
 *  Detection & ML screen; the authoritative order lives in ml/features/schema.py. */
export const FEATURE_REGISTRY = {
  raw: [
    "flow_duration", "fwd_packets", "bwd_packets", "fwd_bytes", "bwd_bytes",
    "flow_bytes_per_s", "flow_packets_per_s", "flow_iat_mean", "flow_iat_std",
    "fwd_iat_mean", "syn_flag_count", "ack_flag_count", "rst_flag_count",
    "psh_flag_count", "pkt_len_mean", "pkt_len_std", "down_up_ratio", "init_win_fwd",
  ],
  engineered: [
    "syn_to_ack_ratio", "bytes_per_packet_fwd", "pkt_rate_asymmetry", "is_short_flow",
  ],
} as const;

export const ALERT_STATUS_LABEL: Record<string, string> = {
  new: "New",
  investigating: "Investigating",
  escalated: "Escalated",
  resolved: "Resolved",
  false_positive: "False positive",
};

export const DETECTION_SOURCE_LABEL: Record<string, string> = {
  ml: "ML",
  rule: "Rule",
  combined: "Rule + ML",
  correlation: "Correlation",
};
