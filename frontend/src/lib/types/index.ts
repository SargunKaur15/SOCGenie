/**
 * SOCGenie frontend types.
 * These mirror the Pydantic schemas the FastAPI backend will expose in Phase 2+.
 * Contract source of truth: Implementation Blueprint §5 and §6.
 */

export type Severity = "low" | "medium" | "high" | "critical";
export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStatus = "new" | "investigating" | "escalated" | "resolved" | "false_positive";
export type IncidentStatus = "open" | "contained" | "resolved" | "closed";
export type DetectionSource = "ml" | "rule" | "combined" | "correlation";
export type Role = "analyst" | "admin";

/** The 7 classes the network classifier predicts (PRD v2.0 §10). */
export type SecurityClass =
  | "BENIGN"
  | "BRUTE_FORCE"
  | "PORT_SCAN"
  | "DOS"
  | "DDOS"
  | "WEB_ATTACK"
  | "BOTNET";

export interface RiskContributor {
  factor: string;
  points: number;
  basis: string;
}

export interface RiskScore {
  score: number;
  band: RiskBand;
  contributors: RiskContributor[];
}

export interface MitreTechnique {
  technique_id: string;
  name: string;
  tactic: string;
  description: string;
  mitigation: string;
  url: string;
  observed_count?: number;
}

export interface Alert {
  id: number;
  alert_ref: string;
  title: string;
  severity: Severity;
  risk_score: number;
  confidence: number | null;
  status: AlertStatus;
  classification: SecurityClass | null;
  detection_source: DetectionSource;
  ml_available: boolean;
  mitre_technique_id: string | null;
  host: string | null;
  user: string | null;
  src_ip: string | null;
  created_at: string;
}

export interface Incident {
  id: number;
  incident_ref: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  correlation_score: number;
  risk_score: number;
  affected_assets: string[];
  technique_chain: string[];
  alert_count: number;
  created_at: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  mitre_technique_id: string;
  enabled: boolean;
  match_count: number;
  last_triggered: string | null;
}

export interface EventOut {
  id: number;
  timestamp: string;
  source_type: string;
  host: string | null;
  user: string | null;
  src_ip: string | null;
  dst_ip: string | null;
  action: string | null;
  outcome: string | null;
  raw_line: string;
}

/** ML engine contract — Blueprint §5. */
export interface FeatureImportance {
  feature: string;
  importance: number;
  rank?: number;
}

export interface MlStatus {
  model_name: string;
  version: string | null;
  status: "active" | "not_trained" | "training";
  algorithm: string;
  anomaly_algorithm: string;
  trained_at: string | null;
  dataset_name: string | null;
  dataset_hash: string | null;
  feature_count: number;
  sklearn_version: string | null;
  /** Phase 13-C. Optional so the Phase 1 fixture remains valid. */
  available?: boolean;
  reason?: string | null;
  schema_version?: string | null;
  /** Phase 16. Real trained metrics; null when no model is loaded. */
  metrics?: {
    classes: string[];
    dataset: string | null;
    trainedAt: string | null;
    featureCount: number | null;
    macroF1: number | null;
    accuracy: number | null;
    benignHoldoutFpr: number | null;
    checksumsVerified: boolean;
  } | null;
}

export interface PerClassMetric {
  label: SecurityClass;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface MlMetrics {
  accuracy: number | null;
  macro_f1: number | null;
  precision: number | null;
  recall: number | null;
  per_class: PerClassMetric[];
  confusion_matrix: { labels: string[]; matrix: number[][] } | null;
  fpr: number | null;
  alerts_per_day_estimate: number | null;
  anomaly: {
    roc_auc: number | null;
    pr_auc: number | null;
    threshold: number | null;
    precision_at_100: number | null;
  } | null;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  db: "connected" | "unavailable";
  ml_engine: { loaded: boolean; version: string | null };
  assist_provider: "rule_based" | "llm";
}

export interface AnalyticsSummary {
  kpis: {
    total_alerts: number;
    open_incidents: number;
    fp_rate: number | null;
    mttd_seconds: number | null;
    mttr_seconds: number | null;
  };
  detection_volume: { bucket: string; detections: number; incidents: number }[];
  severity_distribution: { name: string; value: number }[];
  mitre_distribution: { name: string; value: number }[];
  risk_band_distribution: { name: string; value: number }[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
