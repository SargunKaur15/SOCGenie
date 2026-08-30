/* ---------------------------------------------------------------------------
   Curated local knowledge base — Phase 8.

   Hand-authored. Nothing was downloaded, scraped or generated. Technique
   documents restate publicly documented ATT&CK behaviour; procedure documents
   are SOC methodology written for this project.

   THIS IS NOT LIVE THREAT INTELLIGENCE. It contains no indicators, no actor
   attribution, no CVEs and no reputation data, because none of those can be
   sourced honestly without a feed.
--------------------------------------------------------------------------- */
import type { KnowledgeDocument } from "./types";

const ATTACK_URL = (id: string) =>
  `https://attack.mitre.org/techniques/${id.replace(".", "/")}/`;

export const KNOWLEDGE_BASE: KnowledgeDocument[] = [
  // ── ATT&CK technique documents ────────────────────────────────────────────
  {
    id: "KB-MITRE-T1059.001",
    title: "T1059.001 — Command and Scripting Interpreter: PowerShell",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1059.001"],
    severity: "critical",
    tags: ["powershell", "encoded", "script", "execution", "living off the land", "lolbin"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1059.001"),
    content:
      "PowerShell is a native administration shell, which makes it attractive to adversaries: it is signed, present by default and rarely blocked. Abuse commonly appears as encoded or obfuscated command lines (-enc, -e, -EncodedCommand), download cradles, or execution policy bypass flags. The single strongest discriminator is the parent process — PowerShell launched by a productivity application or browser is anomalous, while launch from a management console or scheduler usually is not. Script block logging captures the decoded command and is the primary evidence source; without it the command line argument is the only record.",
  },
  {
    id: "KB-MITRE-T1110",
    title: "T1110 — Brute Force",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1110"],
    severity: "high",
    tags: ["brute force", "password", "authentication", "failed login", "spraying", "credential"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1110"),
    content:
      "Brute force covers guessing credentials through repeated attempts. Variants differ materially: many passwords against one account is classic brute forcing; one password against many accounts is spraying and evades lockout policy. The decisive question is always whether any attempt succeeded — failures alone are noise, a success converts the finding into an active compromise. Service accounts are disproportionately targeted because their passwords rotate rarely and lockout is often disabled to protect availability.",
  },
  {
    id: "KB-MITRE-T1046",
    title: "T1046 — Network Service Discovery",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1046"],
    severity: "medium",
    tags: ["scan", "port scan", "discovery", "reconnaissance", "sweep", "enumeration"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1046"),
    content:
      "Network service discovery enumerates reachable hosts and listening services to plan lateral movement. The observable signature is one source contacting many ports across many destinations in a short window, often with a high SYN-to-ACK ratio. The dominant benign explanation is a sanctioned vulnerability scanner, so the first check is always whether the source is a managed asset on the scanning allowlist. Scanning that crosses network segments additionally indicates a segmentation control gap, which is a finding in its own right.",
  },
  {
    id: "KB-MITRE-T1068",
    title: "T1068 — Exploitation for Privilege Escalation",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1068"],
    severity: "critical",
    tags: ["privilege escalation", "token", "elevation", "exploit", "sedebugprivilege"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1068"),
    content:
      "Privilege escalation through exploitation converts limited access into administrative control, typically by abusing a vulnerable service or driver. Because escalation is a mid-chain activity, its presence implies an earlier access event that has not yet been identified — finding that initial access matters more than the escalation itself. Evidence collection must precede remediation: rebuilding the host destroys the artefacts needed to establish how access was obtained.",
  },
  {
    id: "KB-MITRE-T1003",
    title: "T1003 — OS Credential Dumping",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1003"],
    severity: "critical",
    tags: ["credential dumping", "lsass", "memory", "hash", "credential access"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1003"),
    content:
      "Credential dumping extracts authentication material from operating system memory or credential stores, yielding reusable secrets. Legitimate access to these stores comes from a small, known set of security tooling, so an unexpected process opening a handle against them is a strong signal. Whether the access succeeded or was denied changes the response substantially. Obtained credentials are typically used within minutes, so authentication review for accounts resident on the host is time-critical.",
  },
  {
    id: "KB-MITRE-T1071.001",
    title: "T1071.001 — Application Layer Protocol: Web Protocols",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1071.001"],
    severity: "high",
    tags: ["beacon", "c2", "command and control", "https", "interval", "web protocols"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1071.001"),
    content:
      "Command-and-control over HTTP or HTTPS blends with ordinary web traffic. The detectable property is regularity rather than content: low variance in connection interval combined with consistent request size suggests automated check-in. The majority of regular beacons in any estate are legitimate software update checkers, so identifying the owning process and comparing the interval against known update services resolves most of these findings quickly.",
  },
  {
    id: "KB-MITRE-T1041",
    title: "T1041 — Exfiltration Over C2 Channel",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1041"],
    severity: "high",
    tags: ["exfiltration", "egress", "data transfer", "outbound", "volume", "baseline"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1041"),
    content:
      "Exfiltration over an existing command-and-control channel avoids opening a second path. Detection is usually volumetric: outbound bytes materially exceeding a host's established baseline. Volume alone is not proof — backup agents, sync clients and software updates produce identical spikes — so the destination's identity and the owning process are what separate exfiltration from routine transfer. Severity depends on the sensitivity of data the host holds, not on the byte count.",
  },
  {
    id: "KB-MITRE-T1566.001",
    title: "T1566.001 — Phishing: Spearphishing Attachment",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1566.001"],
    severity: "high",
    tags: ["phishing", "attachment", "macro", "email", "initial access"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1566.001"),
    content:
      "Spearphishing with an attachment targets specific recipients with a file carrying active content, commonly a macro. Delivery and execution are entirely different outcomes: a quarantined or unopened attachment is a near miss, not an incident. Confirming whether the file was opened, and whether the recipient host shows a document process spawning a child, is therefore the first question. Campaigns rarely target a single mailbox, so identifying other recipients bounds the exposure.",
  },
  {
    id: "KB-MITRE-T1053.005",
    title: "T1053.005 — Scheduled Task/Job: Scheduled Task",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1053.005"],
    severity: "medium",
    tags: ["scheduled task", "persistence", "autorun", "schtasks"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1053.005"),
    content:
      "Scheduled tasks provide durable persistence that survives reboot. Task creation by a standard user account is the anomalous case, since software installers that legitimately register tasks normally run with elevated rights. The binary the task executes determines whether this is persistence or routine maintenance. Capture the task definition before removal, because deleting it first destroys the evidence needed to close the investigation.",
  },
  {
    id: "KB-MITRE-T1078",
    title: "T1078 — Valid Accounts",
    source: "MITRE ATT&CK",
    category: "technique",
    techniqueIds: ["T1078"],
    severity: "high",
    tags: ["valid accounts", "credential reuse", "successful login", "compromise"],
    updatedAt: "2026-05-01",
    url: ATTACK_URL("T1078"),
    content:
      "Use of valid accounts is difficult to detect because the activity is authorised by definition. Detection relies on deviation: unusual source geography, device, or hour relative to the account's own history. A successful authentication shortly after a burst of failures for the same account is the strongest available indicator that the credential is known to someone other than its owner. Post-authentication activity determines blast radius.",
  },

  // ── SOC procedure documents ───────────────────────────────────────────────
  {
    id: "KB-SOC-PROC-001",
    title: "PowerShell Investigation Procedure",
    source: "SOCGenie Knowledge Base",
    category: "investigation",
    techniqueIds: ["T1059.001"],
    severity: null,
    tags: ["powershell", "procedure", "investigation", "process ancestry", "decode"],
    updatedAt: "2026-05-01",
    url: null,
    content:
      "1. Decode the command-line argument in an isolated environment; never execute it. 2. Establish process ancestry — record the full parent chain, not just the immediate parent. 3. Check whether script block logging captured the decoded block. 4. Review outbound connections in the sixty seconds following execution; execution followed by egress indicates the payload retrieved or sent something. 5. Determine whether the account routinely runs administrative scripts. 6. Search the estate for the same command pattern to distinguish a one-off from a deployment.",
  },
  {
    id: "KB-SOC-PROC-002",
    title: "Alert Triage Methodology",
    source: "SOC Procedure",
    category: "triage",
    techniqueIds: [],
    severity: null,
    tags: ["triage", "priority", "queue", "methodology", "tier 1"],
    updatedAt: "2026-05-01",
    url: null,
    content:
      "Triage answers one question: does this warrant deeper investigation now. Work the queue by composite risk rather than raw severity, since severity alone ignores asset criticality and correlation. For each alert establish: what fired the detection, which entities are involved, whether other alerts share those entities, and whether a benign explanation fits the evidence. Entity repetition across alerts is the strongest available signal that separate detections describe one sequence. Record the outcome and the reason, because an untraceable triage decision cannot be reviewed.",
  },
  {
    id: "KB-SOC-PROC-003",
    title: "Evidence Handling and Preservation",
    source: "SOC Procedure",
    category: "evidence",
    techniqueIds: [],
    severity: null,
    tags: ["evidence", "preservation", "chain of custody", "forensics", "collection order"],
    updatedAt: "2026-05-01",
    url: null,
    content:
      "Collect evidence before remediation. Rebuilding or cleaning a host destroys the artefacts required to establish root cause, and a closed investigation without root cause tends to reopen. Collect in order of volatility: memory and running process state first, then network flow records, then disk artefacts, then logs held centrally. Note that flow records typically age out faster than an investigation completes, so capture them early. Record who collected what and when; an audit trail that cannot identify the analyst is not an audit trail.",
  },
  {
    id: "KB-SOC-PROC-004",
    title: "False Positive Investigation Guidance",
    source: "SOC Procedure",
    category: "false-positive",
    techniqueIds: [],
    severity: null,
    tags: ["false positive", "benign", "tuning", "verification", "baseline"],
    updatedAt: "2026-05-01",
    url: null,
    content:
      "A false positive must be argued, not assumed. Establish the benign explanation explicitly and test it against the evidence rather than closing on absence of harm. Common benign causes: scheduled jobs running at fixed hours, sanctioned scanners, backup and sync agents producing volume spikes, service accounts behaving automatically, and administrative tooling that resembles attacker tooling because attackers use the same tools. Where a rule produces repeated false positives, the finding is a tuning defect and should be recorded as such rather than closed silently. Never record a definite verdict when supporting and contradicting indicators are balanced — mark it uncertain and state what evidence would resolve it.",
  },
  {
    id: "KB-SOC-PROC-005",
    title: "Containment Decision Guidance",
    source: "SOC Procedure",
    category: "containment",
    techniqueIds: [],
    severity: null,
    tags: ["containment", "isolation", "response", "approval", "blast radius"],
    updatedAt: "2026-05-01",
    url: null,
    content:
      "Containment trades availability for risk reduction and therefore requires an explicit decision by an accountable analyst — never automation. Before isolating, confirm evidence has been collected, since isolation can terminate the session state you need. Weigh blast radius: a single workstation is a cheap isolation, a domain controller or gateway is not. Where full isolation is disproportionate, consider narrower controls such as blocking a specific destination or revoking a session. Record the decision, the justification and the expected reversal condition.",
  },
  {
    id: "KB-SOC-PROC-006",
    title: "Escalation Criteria",
    source: "SOC Procedure",
    category: "escalation",
    techniqueIds: [],
    severity: null,
    tags: ["escalation", "incident", "handoff", "criteria", "severity"],
    updatedAt: "2026-05-01",
    url: null,
    content:
      "Escalate when any of the following hold: credential access or privilege escalation is evidenced; multiple hosts share indicators; a critical asset is implicated; the activity continues after an initial containment attempt; or the evidence is insufficient to close and further work exceeds the current tier's remit. Escalation is not a failure state — a correctly escalated uncertain finding is better than an incorrectly closed one. Include what has been established, what remains unknown, and the specific question the next analyst should answer.",
  },
  {
    id: "KB-SOC-PROC-007",
    title: "Authentication Anomaly Investigation",
    source: "SOCGenie Knowledge Base",
    category: "investigation",
    techniqueIds: ["T1110", "T1078"],
    severity: null,
    tags: ["authentication", "failed login", "brute force", "procedure", "lockout"],
    updatedAt: "2026-05-01",
    url: null,
    content:
      "1. Determine whether any attempt succeeded — this single fact drives everything downstream. 2. Characterise the pattern: many passwords against one account, or one password against many accounts. 3. Establish whether the source address is internal, external or anonymised. 4. Identify whether the targeted account is privileged or a service account. 5. If a success occurred, enumerate what the session accessed afterwards. 6. Verify that lockout policy is actually enforced for the account, since its absence is usually the enabling condition.",
  },
  {
    id: "KB-SOC-PROC-008",
    title: "Network Scanning Investigation",
    source: "SOCGenie Knowledge Base",
    category: "investigation",
    techniqueIds: ["T1046"],
    severity: null,
    tags: ["scan", "procedure", "asset inventory", "segmentation", "allowlist"],
    updatedAt: "2026-05-01",
    url: null,
    content:
      "1. Check the source against the asset inventory and the scanning allowlist; sanctioned scanners produce this pattern by design. 2. If unmanaged, treat the device itself as the finding. 3. Identify which services responded, since that defines what the source learned. 4. Determine whether connection attempts followed the scan, which indicates intent beyond discovery. 5. Review whether the scan crossed network segments, which indicates a segmentation gap independent of the scanner's intent.",
  },
];

/** Cheap integrity check used by tests: no document may claim an ATT&CK ID
 *  that the curated technique dataset does not contain. */
export function knowledgeBaseTechniqueIds(): string[] {
  return [...new Set(KNOWLEDGE_BASE.flatMap((d) => d.techniqueIds))];
}
