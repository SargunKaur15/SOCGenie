/* ---------------------------------------------------------------------------
   Deterministic investigation playbooks — Phase 15.

   Pure module: no React, no I/O, no randomness. The same alert always selects
   the same playbook and produces the same actions, which is what makes an
   automation decision defensible to an analyst.

   NOTHING HERE EXECUTES. Actions are recommendations. High-impact ones carry
   `impact: "high"` and must pass through analyst approval, which still ends at
   APPROVED — NOT EXECUTED because SOCGenie has no execution backend.
--------------------------------------------------------------------------- */
import type { SocAlert } from "../../mocks/alertStore";

export type ActionImpact = "low" | "high";

export type ActionKind =
  | "collect_evidence"
  | "inspect_related"
  | "enrich"
  | "create_task"
  | "notify"
  | "contain";

export interface PlaybookAction {
  id: string;
  kind: ActionKind;
  title: string;
  /** Why this action, in terms an analyst can check against the alert. */
  rationale: string;
  /** "high" actions can block, disable, isolate or delete. Always gated. */
  impact: ActionImpact;
}

export interface Playbook {
  id: string;
  version: string;
  name: string;
  /** What made this playbook match. Shown in the UI. */
  appliesTo: string;
  actions: PlaybookAction[];
}

const CONTAIN_NOTE =
  "Requires analyst approval. SOCGenie has no execution backend, so approval records the decision without performing the action.";

/** Actions every investigation starts with, regardless of technique. */
const BASE_ACTIONS: PlaybookAction[] = [
  {
    id: "collect-evidence",
    kind: "collect_evidence",
    title: "Preserve the alert evidence before any remediation",
    rationale: "Rebuilding or cleaning first destroys the artefacts needed to establish root cause.",
    impact: "low",
  },
  {
    id: "inspect-related",
    kind: "inspect_related",
    title: "Review alerts sharing this host, account or address",
    rationale: "Entity repetition is the strongest available signal that separate detections describe one sequence.",
    impact: "low",
  },
];

export const PLAYBOOKS: Playbook[] = [
  {
    id: "PB-BRUTE-FORCE",
    version: "1.0.0",
    name: "Credential attack investigation",
    appliesTo: "T1110 / T1078, or an ML BRUTE_FORCE classification",
    actions: [
      ...BASE_ACTIONS,
      {
        id: "bf-check-success",
        kind: "enrich",
        title: "Determine whether any authentication attempt succeeded",
        rationale: "Failures alone are noise; a success converts this into an active compromise.",
        impact: "low",
      },
      {
        id: "bf-account-type",
        kind: "enrich",
        title: "Establish whether the targeted account is privileged or a service account",
        rationale: "Service account passwords rotate rarely and lockout is often disabled for availability.",
        impact: "low",
      },
      {
        id: "bf-disable-account",
        kind: "contain",
        title: "Disable the targeted account pending review",
        rationale: `Stops further attempts if the credential is known to an attacker. ${CONTAIN_NOTE}`,
        impact: "high",
      },
    ],
  },
  {
    id: "PB-EXECUTION",
    version: "1.0.0",
    name: "Suspicious execution investigation",
    appliesTo: "T1059.001 / T1068 / T1003 — process, script or privilege activity",
    actions: [
      ...BASE_ACTIONS,
      {
        id: "ex-ancestry",
        kind: "enrich",
        title: "Record the full process ancestry, not just the immediate parent",
        rationale: "The parent chain is the strongest discriminator between administrative use and abuse.",
        impact: "low",
      },
      {
        id: "ex-egress",
        kind: "enrich",
        title: "Review outbound connections in the 60 seconds after execution",
        rationale: "Execution followed by egress indicates the payload retrieved or sent something.",
        impact: "low",
      },
      {
        id: "ex-isolate",
        kind: "contain",
        title: "Isolate the endpoint pending review",
        rationale: `Limits lateral movement from a host showing execution abuse. ${CONTAIN_NOTE}`,
        impact: "high",
      },
    ],
  },
  {
    id: "PB-NETWORK-FLOOD",
    version: "1.0.0",
    name: "Denial-of-service investigation",
    appliesTo: "T1498 / T1499, or an ML DOS / DDOS classification",
    actions: [
      ...BASE_ACTIONS,
      {
        id: "dos-volume",
        kind: "enrich",
        title: "Characterise the traffic volume against the host baseline",
        rationale: "Distinguishes an attack from a legitimate demand spike.",
        impact: "low",
      },
      {
        id: "dos-block-source",
        kind: "contain",
        title: "Block the source address at the perimeter",
        rationale: `Reduces load if the source is confirmed hostile and not a shared egress. ${CONTAIN_NOTE}`,
        impact: "high",
      },
    ],
  },
  {
    id: "PB-C2",
    version: "1.0.0",
    name: "Command-and-control investigation",
    appliesTo: "T1071 / T1041, or an ML BOTNET classification",
    actions: [
      ...BASE_ACTIONS,
      {
        id: "c2-interval",
        kind: "enrich",
        title: "Identify the process owning the connection and compare its interval to known updaters",
        rationale: "Most regular beacons in any estate are legitimate software update checks.",
        impact: "low",
      },
      {
        id: "c2-block-dest",
        kind: "contain",
        title: "Block the destination address",
        rationale: `Severs the channel if the destination is confirmed hostile. ${CONTAIN_NOTE}`,
        impact: "high",
      },
    ],
  },
  {
    id: "PB-WEB-ATTACK",
    version: "1.0.0",
    name: "Web application attack investigation",
    appliesTo: "T1190, or an ML WEB_ATTACK classification",
    actions: [
      ...BASE_ACTIONS,
      {
        id: "web-payload",
        kind: "enrich",
        title: "Review the request payload and the application's response status",
        rationale: "A blocked or 4xx request is an attempt; a 2xx with an unexpected body may be a success.",
        impact: "low",
      },
    ],
  },
  {
    id: "PB-GENERIC",
    version: "1.0.0",
    name: "General triage",
    appliesTo: "Any alert with no more specific playbook",
    actions: [
      ...BASE_ACTIONS,
      {
        id: "gen-benign",
        kind: "enrich",
        title: "State the benign explanation explicitly and test it against the evidence",
        rationale: "A false positive must be argued, not assumed from absence of harm.",
        impact: "low",
      },
    ],
  },
];

/** ATT&CK technique -> playbook. Exact ids only; no prefix matching. */
const TECHNIQUE_PLAYBOOK: Record<string, string> = {
  T1110: "PB-BRUTE-FORCE",
  T1078: "PB-BRUTE-FORCE",
  "T1059.001": "PB-EXECUTION",
  T1068: "PB-EXECUTION",
  T1003: "PB-EXECUTION",
  T1053: "PB-EXECUTION",
  "T1053.005": "PB-EXECUTION",
  T1498: "PB-NETWORK-FLOOD",
  T1499: "PB-NETWORK-FLOOD",
  T1071: "PB-C2",
  "T1071.001": "PB-C2",
  T1041: "PB-C2",
  T1190: "PB-WEB-ATTACK",
};

/** ML class -> playbook, for the six trained classes. BENIGN never reaches
 *  here: Phase 14 raises no alert for it. */
const ML_CLASS_PLAYBOOK: Record<string, string> = {
  BRUTE_FORCE: "PB-BRUTE-FORCE",
  DOS: "PB-NETWORK-FLOOD",
  DDOS: "PB-NETWORK-FLOOD",
  BOTNET: "PB-C2",
  WEB_ATTACK: "PB-WEB-ATTACK",
};

export interface PlaybookSelection {
  playbook: Playbook;
  /** Human-readable basis for the choice, for the audit trail. */
  reason: string;
}

/** Reads the ML class from evidence written by Phase 14, if present. */
export function mlClassOf(alert: SocAlert): string | null {
  return alert.evidence.find((e) => e.label === "ML classification")?.value ?? null;
}

/**
 * Selects a playbook deterministically.
 *
 * Technique first (it is the most specific signal SOCGenie has), then the ML
 * class, then the generic fallback. Never random, never partial-matched.
 */
export function selectPlaybook(alert: SocAlert): PlaybookSelection {
  const byTechnique = alert.techniqueId ? TECHNIQUE_PLAYBOOK[alert.techniqueId] : undefined;
  if (byTechnique) {
    return {
      playbook: PLAYBOOKS.find((p) => p.id === byTechnique)!,
      reason: `Selected on MITRE technique ${alert.techniqueId}.`,
    };
  }

  const mlClass = mlClassOf(alert);
  const byClass = mlClass ? ML_CLASS_PLAYBOOK[mlClass] : undefined;
  if (byClass) {
    return {
      playbook: PLAYBOOKS.find((p) => p.id === byClass)!,
      reason: `Selected on ML classification ${mlClass}.`,
    };
  }

  return {
    playbook: PLAYBOOKS.find((p) => p.id === "PB-GENERIC")!,
    reason: alert.techniqueId
      ? `No playbook maps technique ${alert.techniqueId}; using general triage.`
      : "No technique mapped and no ML classification; using general triage.",
  };
}

export function playbookById(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}
