/* ---------------------------------------------------------------------------
   Detection engine contracts — Phase 12.

   Pure TypeScript, no React. Mirrors the lib/rag pattern so the Node server can
   import this module unchanged when detection moves server-side.

   Everything here is DETERMINISTIC. The same log file always produces the same
   alerts, which is what makes the engine testable and defensible.
--------------------------------------------------------------------------- */
import type { Severity } from "../types";

export type EventKind = "auth" | "process" | "privilege" | "network" | "generic";

/**
 * One log line after normalisation.
 *
 * Fields are nullable because real logs are inconsistent — a rule must be able
 * to tell "absent" from "empty", and inventing a default would fabricate
 * evidence. `raw` is retained so an analyst can always see the source line.
 */
export interface NormalisedEvent {
  id: string;
  /** Epoch milliseconds. Events with an unparseable timestamp are dropped. */
  timestamp: number;
  raw: string;
  kind: EventKind;
  host: string | null;
  user: string | null;
  sourceIp: string | null;
  destinationIp: string | null;
  destinationPort: number | null;
  outcome: "success" | "failure" | null;
  process: string | null;
  parentProcess: string | null;
  commandLine: string | null;
  bytesOut: number | null;
  privilege: string | null;
  /** Anything the mapper did not recognise, preserved verbatim. */
  fields: Record<string, string>;
}

export interface ParseWarning {
  line: number;
  reason: string;
}

export interface ParseResult {
  events: NormalisedEvent[];
  format: "jsonl" | "csv" | "keyvalue" | "unknown";
  totalLines: number;
  parsed: number;
  skipped: number;
  warnings: ParseWarning[];
}

export type RuleId = "R-001" | "R-002" | "R-003" | "R-004" | "R-005" | "R-006" | "R-007";

export interface RuleDefinition {
  id: RuleId;
  name: string;
  description: string;
  severity: Severity;
  techniqueId: string | null;
  enabled: boolean;
}

/** A rule firing. Carries the events that caused it, so nothing is unexplained. */
export interface RuleMatch {
  ruleId: RuleId;
  ruleName: string;
  severity: Severity;
  techniqueId: string | null;
  title: string;
  host: string;
  user: string | null;
  sourceIp: string;
  destinationIp: string | null;
  firstSeen: number;
  lastSeen: number;
  /** Real values read from the events. Never synthesised. */
  evidence: { label: string; value: string }[];
  /** Ids of the events that satisfied the condition. */
  eventIds: string[];
}

/**
 * ML enrichment for one detection, or null when no model contributed.
 *
 * Null is the normal Phase 13-A state: no model is trained, so every detection
 * carries null and scores exactly as it did in Phase 12.
 */
export interface MlEnrichment {
  modelVersion: string;
  schemaVersion: string;
  predictedClass: string;
  /** 0-1. ALWAYS 0 when predictedClass is BENIGN. */
  mlConfidence: number;
  /** 0-1, normalised against training percentiles, never the uploaded batch. */
  anomalyScore: number;
}

/** Per-factor breakdown, so a score can be reproduced by hand. */
export interface RiskBreakdown {
  ruleSeverity: number;
  /** 8 when the account name matches a privileged pattern, else 0. */
  privilegedAccount: number;
  anomaly: number;
  correlation: number;
  assetCriticality: number;
  threatIntel: number;
  /** Always 0 in Phase 12 — no model exists. Kept explicit rather than hidden. */
  mlConfidence: number;
  total: number;
  /** Ceiling actually reachable given which factors are available.
   *  75 without ML, 100 with a loaded model. */
  maxAttainable: number;
  /** True when a model contributed. False means rule-based scoring. */
  mlApplied: boolean;
  notes: string[];
}

export interface DetectionRun {
  parse: ParseResult;
  matches: RuleMatch[];
  /** Rules that were evaluated but produced nothing, for transparency. */
  rulesEvaluated: RuleId[];
  rulesFired: RuleId[];
  durationMs: number;
}
