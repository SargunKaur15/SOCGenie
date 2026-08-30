/* ---------------------------------------------------------------------------
   CICFlowMeter CSV parser — Phase 13-C.

   SEPARATE from parser.ts by design. Phase 12 log ingestion is a verified
   baseline; this path is additive and cannot alter it. `parser.ts` is NOT
   modified — detection happens here and the caller chooses the path.

   Produces the 18 raw features the Phase 13-B model was trained on, using the
   verified CSE-CIC-IDS2018 column mappings. The 4 engineered features are
   deliberately NOT computed here: they are derived server-side in the Python
   service by the same code training used, so the two cannot diverge.

   Identifier columns (Src IP, Dst IP, Src Port, Dst Port, Timestamp) are read
   for DISPLAY only and never enter the feature vector.
--------------------------------------------------------------------------- */

/** Verified CSE-CIC-IDS2018 header -> internal feature name. Authoritative. */
export const FLOW_COLUMN_MAP: Record<string, string> = {
  "Flow Duration": "flow_duration",
  "Tot Fwd Pkts": "fwd_packets",
  "Tot Bwd Pkts": "bwd_packets",
  "TotLen Fwd Pkts": "fwd_bytes",
  "TotLen Bwd Pkts": "bwd_bytes",
  "Flow Byts/s": "flow_bytes_per_s",
  "Flow Pkts/s": "flow_packets_per_s",
  "Flow IAT Mean": "flow_iat_mean",
  "Flow IAT Std": "flow_iat_std",
  "Fwd IAT Mean": "fwd_iat_mean",
  "SYN Flag Cnt": "syn_flag_count",
  "ACK Flag Cnt": "ack_flag_count",
  "RST Flag Cnt": "rst_flag_count",
  "PSH Flag Cnt": "psh_flag_count",
  "Pkt Len Mean": "pkt_len_mean",
  "Pkt Len Std": "pkt_len_std",
  "Down/Up Ratio": "down_up_ratio",
  "Init Fwd Win Byts": "init_win_fwd",
};

/** The 18 raw features, in the order the model expects them. Engineered
 *  features are appended server-side; this array must not be reordered. */
export const RAW_FEATURE_ORDER: string[] = Object.values(FLOW_COLUMN_MAP);

/** Read for display only. NEVER placed in the feature vector — attacker
 *  addresses are fixed in the training capture, so a model that saw them would
 *  learn an address rather than a behaviour. */
export const IDENTIFIER_COLUMNS = ["Src IP", "Dst IP", "Src Port", "Dst Port", "Timestamp", "Protocol"] as const;

export interface FlowRecord {
  /** 1-based source row, so a finding is traceable to the CSV line. */
  row: number;
  features: Record<string, number>;
  /** Display context only. Not sent to the model. */
  context: { srcIp: string | null; dstIp: string | null; dstPort: string | null; timestamp: string | null };
  /** Ground-truth label when the CSV carries one. Never used as a feature. */
  label: string | null;
}

export interface FlowParseResult {
  isFlowCsv: boolean;
  flows: FlowRecord[];
  totalRows: number;
  parsed: number;
  skipped: number;
  warnings: { row: number; reason: string }[];
  /** Verified mapped columns found in the header. */
  matchedColumns: string[];
  missingColumns: string[];
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/** CICFlowMeter headers are whitespace-padded in some exports. */
const norm = (h: string) => h.replace(/\s+/g, " ").trim();

/**
 * Detects a CICFlowMeter CSV by header content.
 *
 * Requires ALL 18 mapped columns. A partial match is rejected rather than
 * scored on a reduced feature set — the model was fitted on 22 features and a
 * short vector would produce confident nonsense.
 */
export function detectFlowCsv(text: string): { isFlowCsv: boolean; matched: string[]; missing: string[] } {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== "");
  if (!firstLine || !firstLine.includes(",")) return { isFlowCsv: false, matched: [], missing: Object.keys(FLOW_COLUMN_MAP) };

  const header = new Set(splitCsvLine(firstLine).map(norm));
  const matched = Object.keys(FLOW_COLUMN_MAP).filter((c) => header.has(c));
  const missing = Object.keys(FLOW_COLUMN_MAP).filter((c) => !header.has(c));
  return { isFlowCsv: missing.length === 0, matched, missing };
}

function toFiniteNumber(raw: string): number | null {
  if (raw === "" || raw === undefined) return null;
  const cleaned = raw.replace(/,/g, "");
  const n = Number(cleaned);
  // NaN and Infinity are rejected, not substituted. Flow Byts/s is Infinity
  // whenever duration is zero; replacing that with a number would invent a
  // measurement the sensor never made.
  return Number.isFinite(n) ? n : null;
}

export function parseFlowCsv(text: string, maxRows = 500): FlowParseResult {
  const detection = detectFlowCsv(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (!detection.isFlowCsv) {
    return {
      isFlowCsv: false, flows: [], totalRows: Math.max(0, lines.length - 1),
      parsed: 0, skipped: 0, warnings: [],
      matchedColumns: detection.matched, missingColumns: detection.missing,
    };
  }

  const header = splitCsvLine(lines[0]).map(norm);
  const index: Record<string, number> = {};
  header.forEach((h, i) => { index[h] = i; });

  const flows: FlowRecord[] = [];
  const warnings: FlowParseResult["warnings"] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    if (flows.length >= maxRows) break;
    const cells = splitCsvLine(lines[i]);

    const labelRaw = index["Label"] !== undefined ? cells[index["Label"]] ?? "" : "";
    // Repeated CSV headers appear mid-file in concatenated exports.
    if (labelRaw.trim().toLowerCase() === "label") {
      warnings.push({ row: i + 1, reason: "repeated CSV header row" });
      skipped++;
      continue;
    }

    const features: Record<string, number> = {};
    let bad: string | null = null;
    for (const [column, feature] of Object.entries(FLOW_COLUMN_MAP)) {
      const value = toFiniteNumber(cells[index[column]] ?? "");
      if (value === null) { bad = column; break; }
      features[feature] = value;
    }
    if (bad !== null) {
      warnings.push({ row: i + 1, reason: `non-finite or missing value in "${bad}"` });
      skipped++;
      continue;
    }
    if (features.flow_duration < 0) {
      warnings.push({ row: i + 1, reason: "negative Flow Duration" });
      skipped++;
      continue;
    }

    const ctx = (name: string) => (index[name] !== undefined ? cells[index[name]] ?? null : null);
    flows.push({
      row: i + 1,
      features,
      context: { srcIp: ctx("Src IP"), dstIp: ctx("Dst IP"), dstPort: ctx("Dst Port"), timestamp: ctx("Timestamp") },
      label: labelRaw.trim() === "" ? null : labelRaw.trim(),
    });
  }

  return {
    isFlowCsv: true, flows, totalRows: lines.length - 1,
    parsed: flows.length, skipped,
    warnings: warnings.slice(0, 50),
    matchedColumns: detection.matched, missingColumns: detection.missing,
  };
}

/** Feature payload for the ML service. Identifiers are structurally excluded:
 *  only mapped feature keys can appear. */
export function toMlPayload(flows: FlowRecord[]): Record<string, number>[] {
  return flows.map((f) => {
    const out: Record<string, number> = {};
    for (const feature of RAW_FEATURE_ORDER) out[feature] = f.features[feature];
    return out;
  });
}

/* ---------------------------------------------------------------------------
   Phase 14 — ML predictions to SocAlert.

   Builds alerts in the EXISTING contract so every downstream screen (Alerts,
   Investigation, MITRE, AI SOCGenie) works with no change. The risk engine is
   reused via scoreMatch(); no second scoring path exists.
--------------------------------------------------------------------------- */

import type { SocAlert } from "../../mocks/alertStore";
import type { Severity } from "../types";
import type { MlEnrichment, RuleMatch } from "./types";
import { scoreMatch } from "./risk";

/** The six classes the trained model can emit. PORT_SCAN is deliberately
 *  absent: CSE-CIC-IDS2018 contains no port-scan class, so the model cannot
 *  produce it. A PORT_SCAN prediction would mean a swapped artifact. */
export const ML_CLASSES = ["BENIGN", "BRUTE_FORCE", "DOS", "DDOS", "BOTNET", "WEB_ATTACK"] as const;
export type MlClass = (typeof ML_CLASSES)[number];

/** Severity is the class's inherent seriousness. riskScore is computed
 *  separately by the existing seven-factor formula — the two stay distinct. */
const CLASS_SEVERITY: Record<Exclude<MlClass, "BENIGN">, Severity> = {
  DDOS: "high",
  DOS: "high",
  BOTNET: "high",
  BRUTE_FORCE: "medium",
  WEB_ATTACK: "medium",
};

/** ATT&CK ids from the existing curated dataset. No new technique data. */
const CLASS_TECHNIQUE: Record<Exclude<MlClass, "BENIGN">, string | null> = {
  DDOS: "T1498",
  DOS: "T1499",
  BOTNET: "T1071",
  BRUTE_FORCE: "T1110",
  WEB_ATTACK: "T1190",
};

const CLASS_TITLE: Record<Exclude<MlClass, "BENIGN">, string> = {
  DDOS: "Distributed denial-of-service traffic classified",
  DOS: "Denial-of-service traffic classified",
  BOTNET: "Botnet command-and-control traffic classified",
  BRUTE_FORCE: "Credential brute-force traffic classified",
  WEB_ATTACK: "Web application attack traffic classified",
};

export interface MlPredictionInput {
  index: number;
  label: string;
  mlConfidence: number;
  anomalyScore: number;
  isBenign: boolean;
}

export class MlLabelError extends Error {}

export interface FlowAlertResult {
  alerts: SocAlert[];
  /** Flows the model judged benign. Counted, never alerted on. */
  benign: number;
  /** Predictions whose index did not map to a parsed flow. */
  unmatched: number;
  /** Alerts suppressed because an identical finding already existed. */
  duplicates: number;
  breakdowns: Record<string, ReturnType<typeof scoreMatch>>;
}

/** Deterministic reference derived from the run, so re-running the same file
 *  yields the same identifiers rather than drifting counters. */
function flowAlertRef(index: number, seed: number): string {
  return `MLA-${(seed % 900 + 100) * 100 + index}`;
}

/**
 * Converts ML predictions into alerts.
 *
 * BENIGN produces NO alert. A benign classification is not a detection, and
 * alerting on it would flood the queue. Its mlConfidence is already 0 by the
 * Phase 13 rule, and its anomalyScore is deliberately not used to manufacture
 * risk.
 *
 * An unrecognised label RAISES rather than being coerced. A label outside the
 * six trained classes means the artifact is not the one this code expects, and
 * quietly mapping it to something plausible would hide that.
 */
export function flowsToAlerts(
  flows: FlowRecord[],
  predictions: MlPredictionInput[],
  modelVersion: string,
  schemaVersion: string,
  /** Rule alerts from the same run, used only for genuine entity overlap. */
  existingRuleAlerts: SocAlert[] = []
): FlowAlertResult {
  const alerts: SocAlert[] = [];
  const breakdowns: FlowAlertResult["breakdowns"] = {};
  const seen = new Set<string>();
  let benign = 0;
  let unmatched = 0;
  let duplicates = 0;

  const seed = flows.length > 0 ? flows[0].row * 7919 : 1;

  for (const p of predictions) {
    if (!(ML_CLASSES as readonly string[]).includes(p.label)) {
      throw new MlLabelError(
        `ML returned "${p.label}", which is not one of the six trained classes ` +
          `(${ML_CLASSES.join(", ")}). Refusing to classify — check that the loaded ` +
          `artifact matches ${schemaVersion}.`
      );
    }
    if (p.label === "BENIGN") { benign++; continue; }

    // Index maps positionally into the parsed flows, which is the order they
    // were sent in. A miss means the service returned a different count.
    const flow = flows[p.index];
    if (!flow) { unmatched++; continue; }

    const cls = p.label as Exclude<MlClass, "BENIGN">;
    const host = flow.context.srcIp ?? "unknown-host";
    const dst = flow.context.dstIp;

    // One alert per (source, destination, class) per run.
    const key = `${host}|${dst ?? "-"}|${cls}`;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);

    const ml: MlEnrichment = {
      modelVersion, schemaVersion, predictedClass: cls,
      mlConfidence: p.mlConfidence, anomalyScore: p.anomalyScore,
    };

    // Correlate ONLY on genuine entity overlap with a rule detection.
    const correlated = existingRuleAlerts.find(
      (a) => a.sourceIp === host || (dst !== null && a.destinationIp === dst)
    );

    const match: RuleMatch = {
      ruleId: "R-006", ruleName: `ML classification: ${cls}`,
      severity: CLASS_SEVERITY[cls], techniqueId: CLASS_TECHNIQUE[cls],
      title: CLASS_TITLE[cls], host, user: null,
      sourceIp: host, destinationIp: dst,
      firstSeen: Date.now(), lastSeen: Date.now(),
      evidence: [], eventIds: [],
    };
    const breakdown = scoreMatch(match, [match], [], ml);
    const ref = flowAlertRef(alerts.length + 1, seed);
    breakdowns[ref] = breakdown;

    const evidence: { label: string; value: string }[] = [
      { label: "ML classification", value: cls },
      { label: "Model confidence", value: `${(p.mlConfidence * 100).toFixed(2)}%` },
      { label: "Anomaly score", value: p.anomalyScore.toFixed(4) },
      { label: "Source CSV row", value: String(flow.row) },
      { label: "Model version", value: modelVersion },
      { label: "Feature schema", value: schemaVersion },
      { label: "Flow", value: `${host}${dst ? ` → ${dst}` : ""}${flow.context.dstPort ? `:${flow.context.dstPort}` : ""}` },
    ];
    if (flow.label) evidence.push({ label: "CSV ground-truth label", value: flow.label });
    if (correlated) {
      evidence.push({ label: "Correlated rule alert", value: `${correlated.ref} — ${correlated.title}` });
    }

    alerts.push({
      ref,
      title: `${CLASS_TITLE[cls]} on ${host}`,
      severity: CLASS_SEVERITY[cls],
      riskScore: breakdown.total,
      status: "open",
      // "combined" only where a rule alert genuinely shares an entity.
      detectionSource: correlated ? "combined" : "ml",
      minutesAgo: 0,
      sourceIp: host,
      destinationIp: dst,
      host,
      user: null,
      techniqueId: CLASS_TECHNIQUE[cls],
      evidence,
      notes: [],
      escalatedTo: null,
    });
  }

  return { alerts, benign, unmatched, duplicates, breakdowns };
}
