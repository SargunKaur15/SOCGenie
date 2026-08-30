/* ---------------------------------------------------------------------------
   Detection orchestration: raw text -> normalised events -> rule matches ->
   scored alerts in the existing SocAlert shape.

   Emitting SocAlert is what makes every downstream screen — Alerts,
   Investigation, MITRE mapping, risk overview and AI SOCGenie — work without a
   single change. The engine adapts to the app, not the reverse.
--------------------------------------------------------------------------- */
import type { SocAlert } from "../../mocks/alertStore";
import { parseLogs } from "./parser";
import { RULES, RULE_FUNCTIONS } from "./rules";
import { scoreMatch } from "./risk";
import type { DetectionRun, NormalisedEvent, RuleId, RuleMatch } from "./types";

export interface DetectionOutput {
  run: DetectionRun;
  alerts: SocAlert[];
  /** Per-alert scoring detail, keyed by alert ref, for the results panel. */
  breakdowns: Record<string, ReturnType<typeof scoreMatch>>;
}

/** Deterministic reference derived from the run, so re-running the same file
 *  produces the same identifiers rather than drifting counters. */
function alertRef(index: number, seed: number): string {
  return `ALT-${(seed % 900 + 100) * 100 + index}`;
}

/** Minutes between an event and the newest event in the file. Keeps relative
 *  ordering meaningful without pretending the log is live. */
function minutesAgo(timestamp: number, newest: number): number {
  return Math.max(0, Math.round((newest - timestamp) / 60000));
}

export function runDetection(text: string, enabledRules?: RuleId[]): DetectionOutput {
  const started = Date.now();
  const parse = parseLogs(text);
  const events: NormalisedEvent[] = parse.events;

  const active = RULES.filter((r) => r.enabled && (!enabledRules || enabledRules.includes(r.id)));
  const matches: RuleMatch[] = [];
  for (const rule of active) {
    matches.push(...RULE_FUNCTIONS[rule.id](events));
  }
  matches.sort((a, b) => a.firstSeen - b.firstSeen);

  const newest = events.length > 0 ? events[events.length - 1].timestamp : Date.now();
  const seed = events.length > 0 ? events[0].timestamp : started;

  const alerts: SocAlert[] = [];
  const breakdowns: DetectionOutput["breakdowns"] = {};

  matches.forEach((match, i) => {
    const breakdown = scoreMatch(match, matches, events);
    const ref = alertRef(i + 1, seed);
    breakdowns[ref] = breakdown;

    alerts.push({
      ref,
      title: match.title,
      severity: match.severity,
      riskScore: breakdown.total,
      status: "open",
      // "rule" is accurate: no model contributed. Claiming "combined" would
      // misrepresent how this alert was produced.
      detectionSource: "rule",
      minutesAgo: minutesAgo(match.lastSeen, newest),
      sourceIp: match.sourceIp,
      destinationIp: match.destinationIp,
      host: match.host,
      user: match.user,
      techniqueId: match.techniqueId,
      evidence: [
        ...match.evidence,
        { label: "Detection rule", value: `${match.ruleId} — ${match.ruleName}` },
        { label: "Events matched", value: String(match.eventIds.length) },
      ],
      notes: [],
      escalatedTo: null,
    });
  });

  return {
    run: {
      parse,
      matches,
      rulesEvaluated: active.map((r) => r.id),
      rulesFired: [...new Set(matches.map((m) => m.ruleId))],
      durationMs: Date.now() - started,
    },
    alerts,
    breakdowns,
  };
}
