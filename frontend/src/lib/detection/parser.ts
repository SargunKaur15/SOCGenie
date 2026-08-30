/* ---------------------------------------------------------------------------
   Log parser — CSV (header row), JSON Lines, and key=value.

   Format is DETECTED, not configured, because an analyst uploading a file
   should not have to declare what it is. Detection is by first non-empty line:
   `{` => JSONL, contains `=` without `,` => key=value, otherwise CSV.

   Unparseable lines are SKIPPED and counted, never guessed at. A line without a
   usable timestamp is dropped, because every rule is time-windowed and an
   invented timestamp would produce invented correlations.
--------------------------------------------------------------------------- */
import type { EventKind, NormalisedEvent, ParseResult, ParseWarning } from "./types";

/** Column aliases seen across common log exports. Lowercased on lookup. */
const ALIASES: Record<string, string[]> = {
  timestamp: ["timestamp", "time", "date", "datetime", "@timestamp", "eventtime", "ts"],
  host: ["host", "hostname", "computer", "computername", "device", "machine", "src_host"],
  user: ["user", "username", "account", "accountname", "subject_user", "target_user", "logon_account"],
  sourceIp: ["src_ip", "source_ip", "sourceip", "srcaddr", "client_ip", "ip_src", "source", "src"],
  destinationIp: ["dst_ip", "dest_ip", "destination_ip", "destip", "dstaddr", "ip_dst", "destination", "dst"],
  destinationPort: ["dst_port", "dest_port", "destination_port", "dstport", "port"],
  outcome: ["outcome", "result", "status", "event_outcome", "logon_result"],
  process: ["process", "process_name", "image", "new_process_name", "proc"],
  parentProcess: ["parent_process", "parent_process_name", "parent_image", "parentimage", "parent"],
  commandLine: ["command_line", "commandline", "cmdline", "process_command_line", "cmd"],
  bytesOut: ["bytes_out", "bytes_sent", "out_bytes", "sent_bytes", "bytes", "orig_bytes"],
  privilege: ["privilege", "privileges", "privilege_list", "token_elevation", "elevation"],
  eventType: ["event_type", "eventtype", "event", "action", "category", "event_id", "eventid"],
};

function lookup(row: Record<string, string>, key: keyof typeof ALIASES): string | null {
  for (const alias of ALIASES[key]) {
    const v = row[alias];
    if (v !== undefined && v !== "") return v;
  }
  return null;
}

/** Accepts epoch seconds, epoch millis, and anything Date can parse. */
function parseTimestamp(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{10}$/.test(trimmed)) return Number(trimmed) * 1000;
  if (/^\d{13}$/.test(trimmed)) return Number(trimmed);
  const t = Date.parse(trimmed);
  return Number.isFinite(t) ? t : null;
}

function classify(row: Record<string, string>, ev: Partial<NormalisedEvent>): EventKind {
  const type = (lookup(row, "eventType") ?? "").toLowerCase();
  const blob = `${type} ${ev.raw ?? ""}`.toLowerCase();

  if (ev.privilege || /privilege|elevation|admin group|4672|4728/.test(blob)) return "privilege";
  if (ev.process || ev.commandLine || /process|4688|exec/.test(blob)) return "process";
  if (ev.outcome !== null && ev.outcome !== undefined) return "auth";
  if (/logon|login|auth|4624|4625/.test(blob)) return "auth";
  if (ev.bytesOut !== null || ev.destinationIp || /conn|flow|network|traffic/.test(blob)) return "network";
  return "generic";
}

function normaliseOutcome(raw: string | null, line: string): "success" | "failure" | null {
  const v = `${raw ?? ""} ${line}`.toLowerCase();
  if (/\bfail|failure|denied|invalid|4625|unsuccessful\b/.test(v)) return "failure";
  if (/\bsuccess|succeeded|granted|accepted|4624\b/.test(v)) return "success";
  return null;
}

function toNumber(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function rowToEvent(row: Record<string, string>, raw: string, index: number): NormalisedEvent | null {
  const timestamp = parseTimestamp(lookup(row, "timestamp"));
  if (timestamp === null) return null;

  const known = new Set(Object.values(ALIASES).flat());
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!known.has(k) && v !== "") fields[k] = v;
  }

  const partial: Partial<NormalisedEvent> = {
    raw,
    host: lookup(row, "host"),
    user: lookup(row, "user"),
    sourceIp: lookup(row, "sourceIp"),
    destinationIp: lookup(row, "destinationIp"),
    destinationPort: toNumber(lookup(row, "destinationPort")),
    outcome: normaliseOutcome(lookup(row, "outcome"), raw),
    process: lookup(row, "process"),
    parentProcess: lookup(row, "parentProcess"),
    commandLine: lookup(row, "commandLine"),
    bytesOut: toNumber(lookup(row, "bytesOut")),
    privilege: lookup(row, "privilege"),
  };

  return {
    id: `EVT-${index}`,
    timestamp,
    raw,
    kind: classify(row, partial),
    host: partial.host ?? null,
    user: partial.user ?? null,
    sourceIp: partial.sourceIp ?? null,
    destinationIp: partial.destinationIp ?? null,
    destinationPort: partial.destinationPort ?? null,
    outcome: partial.outcome ?? null,
    process: partial.process ?? null,
    parentProcess: partial.parentProcess ?? null,
    commandLine: partial.commandLine ?? null,
    bytesOut: partial.bytesOut ?? null,
    privilege: partial.privilege ?? null,
    fields,
  };
}

/** Minimal RFC-4180 splitter: handles quoted fields and escaped quotes. */
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

function parseKeyValue(line: string): Record<string, string> {
  const row: Record<string, string> = {};
  // key="value with spaces" | key=value
  const re = /([A-Za-z0-9_.@-]+)\s*=\s*("([^"]*)"|[^\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    row[m[1].toLowerCase()] = (m[3] ?? m[2]).trim();
  }
  return row;
}

export function parseLogs(text: string): ParseResult {
  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map((l, i) => ({ line: l, no: i + 1 })).filter((l) => l.line.trim() !== "");
  const warnings: ParseWarning[] = [];
  const events: NormalisedEvent[] = [];

  if (lines.length === 0) {
    return { events, format: "unknown", totalLines: 0, parsed: 0, skipped: 0, warnings };
  }

  const first = lines[0].line.trim();
  const format: ParseResult["format"] = first.startsWith("{")
    ? "jsonl"
    : first.includes("=") && !first.includes(",")
      ? "keyvalue"
      : "csv";

  let header: string[] = [];
  let start = 0;
  if (format === "csv") {
    header = splitCsvLine(lines[0].line).map((h) => h.toLowerCase());
    start = 1;
  }

  for (let i = start; i < lines.length; i++) {
    const { line, no } = lines[i];
    let row: Record<string, string> | null = null;

    try {
      if (format === "jsonl") {
        const obj: unknown = JSON.parse(line);
        if (typeof obj !== "object" || obj === null || Array.isArray(obj)) throw new Error("not an object");
        row = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          row[k.toLowerCase()] = v === null || v === undefined ? "" : String(v);
        }
      } else if (format === "keyvalue") {
        row = parseKeyValue(line);
        if (Object.keys(row).length === 0) throw new Error("no key=value pairs");
      } else {
        const cells = splitCsvLine(line);
        row = {};
        header.forEach((h, idx) => { row![h] = cells[idx] ?? ""; });
      }
    } catch (err) {
      warnings.push({ line: no, reason: err instanceof Error ? err.message : "unparseable" });
      continue;
    }

    const event = rowToEvent(row, line, events.length + 1);
    if (!event) {
      // Dropped rather than guessed: every rule is time-windowed.
      warnings.push({ line: no, reason: "no usable timestamp" });
      continue;
    }
    events.push(event);
  }

  events.sort((a, b) => a.timestamp - b.timestamp);

  return {
    events,
    format,
    totalLines: lines.length,
    parsed: events.length,
    skipped: lines.length - start - events.length,
    warnings: warnings.slice(0, 50),
  };
}
