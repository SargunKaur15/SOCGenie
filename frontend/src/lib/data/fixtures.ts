/* ---------------------------------------------------------------------------
   PHASE 1 FIXTURES — SIMULATED DATA
   All hosts, users, IPs and identifiers below are synthetic and correspond to
   no real system. They exist so the interface can be built and reviewed before
   the backend (Phase 2) and the ML engine (Phases 7-11) exist.

   These are replaced wholesale when VITE_API_BASE_URL is set. Nothing here is
   presented to the user as a model output.
--------------------------------------------------------------------------- */
import type {
  Alert, Incident, DetectionRule, MitreTechnique, EventOut,
  MlStatus, MlMetrics, HealthStatus, AnalyticsSummary,
} from "../types";

const t = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

export const health: HealthStatus = {
  status: "ok",
  db: "connected",
  ml_engine: { loaded: false, version: null },
  assist_provider: "rule_based",
};

export const alerts: Alert[] = [
  {
    id: 1, alert_ref: "ALT-10492", title: "Suspicious PowerShell execution",
    severity: "critical", risk_score: 84, confidence: null, status: "new",
    classification: null, detection_source: "rule", ml_available: false,
    mitre_technique_id: "T1059.001", host: "WS-07", user: "svc_backup",
    src_ip: "10.20.4.18", created_at: t(3),
  },
  {
    id: 2, alert_ref: "ALT-10491", title: "Repeated authentication failures",
    severity: "high", risk_score: 71, confidence: null, status: "investigating",
    classification: null, detection_source: "rule", ml_available: false,
    mitre_technique_id: "T1110", host: "AUTH-GATEWAY-02", user: "svc_backup",
    src_ip: "185.220.101.4", created_at: t(8),
  },
  {
    id: 3, alert_ref: "ALT-10488", title: "Port scan across internal subnet",
    severity: "medium", risk_score: 58, confidence: 0.94, status: "new",
    classification: "PORT_SCAN", detection_source: "combined", ml_available: true,
    mitre_technique_id: "T1046", host: "10.20.4.0/24", user: null,
    src_ip: "10.20.4.101", created_at: t(21),
  },
  {
    id: 4, alert_ref: "ALT-10485", title: "Privilege escalation indicator",
    severity: "critical", risk_score: 45, confidence: null, status: "escalated",
    classification: null, detection_source: "rule", ml_available: false,
    mitre_technique_id: "T1068", host: "WS-07", user: "svc_backup",
    src_ip: null, created_at: t(34),
  },
  {
    id: 5, alert_ref: "ALT-10481", title: "Anomalous outbound transfer volume",
    severity: "high", risk_score: 62, confidence: null, status: "new",
    classification: null, detection_source: "rule", ml_available: false,
    mitre_technique_id: "T1041", host: "WS-07", user: null,
    src_ip: "10.20.4.18", created_at: t(47),
  },
  {
    id: 6, alert_ref: "ALT-10477", title: "Beaconing interval regularity detected",
    severity: "medium", risk_score: 39, confidence: null, status: "new",
    classification: null, detection_source: "rule", ml_available: false,
    mitre_technique_id: "T1071", host: "WS-22", user: null,
    src_ip: "10.20.5.9", created_at: t(64),
  },
  {
    id: 7, alert_ref: "ALT-10470", title: "Scheduled backup flagged as high volume",
    severity: "low", risk_score: 22, confidence: null, status: "false_positive",
    classification: null, detection_source: "rule", ml_available: false,
    mitre_technique_id: "T1041", host: "BACKUP-01", user: "svc_backup",
    src_ip: "10.20.1.30", created_at: t(180),
  },
];

export const incidents: Incident[] = [
  {
    id: 1, incident_ref: "INC-2291",
    title: "Credential compromise with privilege escalation and code execution",
    severity: "critical", status: "open", correlation_score: 1.0, risk_score: 84,
    affected_assets: ["AUTH-GATEWAY-02", "WS-07"],
    technique_chain: ["T1110", "T1078", "T1068", "T1059.001", "T1041"],
    alert_count: 4, created_at: t(3),
  },
];

export const detectionRules: DetectionRule[] = [
  { id: "R-001", name: "Authentication Failure Burst", description: "5 or more authentication failures for a single account within 120 seconds.", severity: "medium", mitre_technique_id: "T1110", enabled: true, match_count: 14, last_triggered: t(8) },
  { id: "R-002", name: "Failure-Then-Success", description: "10 or more failures followed by a success for the same account within 300 seconds.", severity: "high", mitre_technique_id: "T1078", enabled: true, match_count: 3, last_triggered: t(6) },
  { id: "R-003", name: "Suspicious PowerShell", description: "PowerShell invoked with encoded/obfuscation flags, or spawned by an Office or browser process.", severity: "critical", mitre_technique_id: "T1059.001", enabled: true, match_count: 2, last_triggered: t(3) },
  { id: "R-004", name: "Privilege Escalation Indicator", description: "Token elevation or admin-group addition within 300 seconds of a non-admin session start.", severity: "critical", mitre_technique_id: "T1068", enabled: true, match_count: 1, last_triggered: t(34) },
  { id: "R-005", name: "Anomalous Outbound Volume", description: "Outbound bytes exceed five times the host rolling baseline to an external destination.", severity: "high", mitre_technique_id: "T1041", enabled: true, match_count: 5, last_triggered: t(47) },
  { id: "R-006", name: "Threat Intelligence Match", description: "Source or destination address matches a curated indicator with confidence 70 or above.", severity: "high", mitre_technique_id: "T1071", enabled: true, match_count: 9, last_triggered: t(8) },
  { id: "R-007", name: "Beaconing Regularity", description: "Six or more connections to one destination with inter-arrival std/mean below 0.15 over 30 minutes.", severity: "medium", mitre_technique_id: "T1071", enabled: false, match_count: 1, last_triggered: t(64) },
];

export const mitreTechniques: MitreTechnique[] = [
  { technique_id: "T1110", name: "Brute Force", tactic: "Credential Access", description: "Adversaries use repeated authentication attempts to guess or crack account credentials.", mitigation: "Enforce account lockout thresholds and multi-factor authentication; monitor high-volume authentication failures.", url: "https://attack.mitre.org/techniques/T1110/", observed_count: 1 },
  { technique_id: "T1078", name: "Valid Accounts", tactic: "Defense Evasion", description: "Adversaries use compromised credentials to bypass access controls and blend in with normal activity.", mitigation: "Enforce least privilege, rotate credentials, and alert on anomalous account usage.", url: "https://attack.mitre.org/techniques/T1078/", observed_count: 0 },
  { technique_id: "T1059.001", name: "Command and Scripting Interpreter: PowerShell", tactic: "Execution", description: "Adversaries abuse PowerShell to execute commands, download payloads, or move laterally.", mitigation: "Enable script block logging, use constrained language mode, and restrict execution policy.", url: "https://attack.mitre.org/techniques/T1059/001/", observed_count: 1 },
  { technique_id: "T1068", name: "Exploitation for Privilege Escalation", tactic: "Privilege Escalation", description: "Adversaries exploit software vulnerabilities to elevate privileges on a system.", mitigation: "Apply patches promptly and deploy exploit-protection tooling.", url: "https://attack.mitre.org/techniques/T1068/", observed_count: 1 },
  { technique_id: "T1046", name: "Network Service Discovery", tactic: "Discovery", description: "Adversaries scan for open ports and services to identify exploitable targets.", mitigation: "Deploy network intrusion detection and alert on high port-touch rates.", url: "https://attack.mitre.org/techniques/T1046/", observed_count: 1 },
  { technique_id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access", description: "Adversaries exploit weaknesses in internet-facing applications to gain initial access.", mitigation: "Patch external applications, deploy a web application firewall, and segment DMZ hosts.", url: "https://attack.mitre.org/techniques/T1190/", observed_count: 0 },
  { technique_id: "T1071", name: "Application Layer Protocol", tactic: "Command and Control", description: "Adversaries use common application-layer protocols to blend command-and-control traffic with legitimate traffic.", mitigation: "Baseline expected protocol usage and inspect egress where policy permits.", url: "https://attack.mitre.org/techniques/T1071/", observed_count: 1 },
  { technique_id: "T1041", name: "Exfiltration Over C2 Channel", tactic: "Exfiltration", description: "Adversaries steal data by exfiltrating it over an existing command-and-control channel.", mitigation: "Monitor egress volume and destinations; deploy data loss prevention and segmentation.", url: "https://attack.mitre.org/techniques/T1041/", observed_count: 2 },
  { technique_id: "T1499", name: "Endpoint Denial of Service", tactic: "Impact", description: "Adversaries exhaust endpoint resources to degrade or block availability of a service.", mitigation: "Apply rate limiting, resource quotas, and upstream filtering.", url: "https://attack.mitre.org/techniques/T1499/", observed_count: 0 },
  { technique_id: "T1498", name: "Network Denial of Service", tactic: "Impact", description: "Adversaries exhaust network bandwidth to degrade availability for targeted systems.", mitigation: "Use upstream scrubbing services and provision bandwidth headroom.", url: "https://attack.mitre.org/techniques/T1498/", observed_count: 0 },
  { technique_id: "T1003", name: "OS Credential Dumping", tactic: "Credential Access", description: "Adversaries dump credential material from operating system memory or credential stores to obtain account logins and reusable secrets.", mitigation: "Restrict debug privileges, enable LSA protection and credential guard, and alert on process handles opened against LSASS.", url: "https://attack.mitre.org/techniques/T1003/", observed_count: 0 },
  { technique_id: "T1053.005", name: "Scheduled Task/Job: Scheduled Task", tactic: "Persistence", description: "Adversaries create or modify Windows scheduled tasks to execute code at a defined time or trigger, commonly for persistence.", mitigation: "Restrict task creation to privileged accounts and audit task registration events.", url: "https://attack.mitre.org/techniques/T1053/005/", observed_count: 0 },
  { technique_id: "T1071.001", name: "Application Layer Protocol: Web Protocols", tactic: "Command and Control", description: "Adversaries tunnel command-and-control traffic over HTTP or HTTPS so it blends with ordinary web activity.", mitigation: "Baseline expected outbound destinations, inspect TLS where policy permits, and alert on regular-interval beaconing.", url: "https://attack.mitre.org/techniques/T1071/001/", observed_count: 0 },
  { technique_id: "T1566.001", name: "Phishing: Spearphishing Attachment", tactic: "Initial Access", description: "Adversaries send targeted messages carrying a malicious attachment to obtain execution on a victim system.", mitigation: "Filter attachments at the gateway, detonate in a sandbox, disable macros by policy and train users to report.", url: "https://attack.mitre.org/techniques/T1566/001/", observed_count: 0 },
];

export const events: EventOut[] = [
  { id: 1, timestamp: t(3), source_type: "process", host: "WS-07", user: "svc_backup", src_ip: "10.20.4.18", dst_ip: null, action: "process.create", outcome: "success", raw_line: "host=WS-07 evt=process.create parent=OUTLOOK.EXE image=powershell.exe flags=-enc" },
  { id: 2, timestamp: t(4), source_type: "auth", host: "AUTH-GATEWAY-02", user: "svc_backup", src_ip: "185.220.101.4", dst_ip: "10.20.1.10", action: "auth", outcome: "failure", raw_line: "host=AUTH-GATEWAY-02 evt=auth.failure user=svc_backup src=185.220.101.4 reason=bad_password" },
  { id: 3, timestamp: t(4), source_type: "auth", host: "AUTH-GATEWAY-02", user: "svc_backup", src_ip: "185.220.101.4", dst_ip: "10.20.1.10", action: "auth", outcome: "failure", raw_line: "host=AUTH-GATEWAY-02 evt=auth.failure user=svc_backup src=185.220.101.4 reason=bad_password" },
  { id: 4, timestamp: t(6), source_type: "auth", host: "AUTH-GATEWAY-02", user: "svc_backup", src_ip: "185.220.101.4", dst_ip: "10.20.1.10", action: "auth", outcome: "success", raw_line: "host=AUTH-GATEWAY-02 evt=auth.success user=svc_backup src=185.220.101.4" },
  { id: 5, timestamp: t(21), source_type: "network", host: "10.20.4.101", user: null, src_ip: "10.20.4.101", dst_ip: "10.20.4.55", action: "net.connect", outcome: "reset", raw_line: "src=10.20.4.101 dst=10.20.4.55 dport=445 flags=SYN state=RST" },
  { id: 6, timestamp: t(47), source_type: "network", host: "WS-07", user: null, src_ip: "10.20.4.18", dst_ip: "45.83.91.12", action: "net.flow", outcome: "success", raw_line: "src=10.20.4.18 dst=45.83.91.12 dport=443 bytes_sent=94210330 duration=612" },
];

/** ML has not been trained in Phase 1. These report an UNTRAINED state rather
 *  than placeholder numbers — SOCGenie never displays an estimated metric. */
export const mlStatus: MlStatus = {
  model_name: "SOCGenie Attack Classifier",
  version: null,
  status: "not_trained",
  algorithm: "RandomForestClassifier (scikit-learn)",
  anomaly_algorithm: "IsolationForest (scikit-learn)",
  trained_at: null,
  dataset_name: "CIC-IDS2017 (not yet processed)",
  dataset_hash: null,
  feature_count: 22,
  sklearn_version: null,
};

export const mlMetrics: MlMetrics = {
  accuracy: null, macro_f1: null, precision: null, recall: null,
  per_class: [], confusion_matrix: null, fpr: null,
  alerts_per_day_estimate: null, anomaly: null,
};

export const analytics: AnalyticsSummary = {
  kpis: { total_alerts: 7, open_incidents: 1, fp_rate: 0.143, mttd_seconds: null, mttr_seconds: null },
  detection_volume: [
    { bucket: "09:00", detections: 4, incidents: 0 },
    { bucket: "10:00", detections: 7, incidents: 0 },
    { bucket: "11:00", detections: 5, incidents: 0 },
    { bucket: "12:00", detections: 9, incidents: 1 },
    { bucket: "13:00", detections: 6, incidents: 0 },
    { bucket: "14:00", detections: 12, incidents: 1 },
  ],
  severity_distribution: [
    { name: "Low", value: 1 }, { name: "Medium", value: 2 },
    { name: "High", value: 2 }, { name: "Critical", value: 2 },
  ],
  mitre_distribution: [
    { name: "T1041", value: 2 }, { name: "T1110", value: 1 }, { name: "T1071", value: 1 },
    { name: "T1046", value: 1 }, { name: "T1068", value: 1 }, { name: "T1059.001", value: 1 },
  ],
  risk_band_distribution: [
    { name: "LOW", value: 1 }, { name: "MEDIUM", value: 2 },
    { name: "HIGH", value: 3 }, { name: "CRITICAL", value: 1 },
  ],
};

export const SIMULATION_SCENARIOS = [
  { name: "Brute Force", key: "brute_force", description: "34 authentication failures from one source against one account over 90 seconds.", expected_detection: "R-001, R-002", technique: "T1110 → T1078" },
  { name: "Port Scan", key: "port_scan", description: "200 SYN-heavy flows across 45 ports and 12 hosts.", expected_detection: "ML classifier (PORT_SCAN)", technique: "T1046" },
  { name: "Suspicious PowerShell", key: "powershell", description: "Office process spawns an encoded PowerShell command, followed by outbound egress.", expected_detection: "R-003", technique: "T1059.001" },
  { name: "Privilege Escalation", key: "priv_esc", description: "Token elevation shortly after a non-admin session start.", expected_detection: "R-004", technique: "T1068" },
  { name: "Multi-stage Attack", key: "multi_stage", description: "All of the above chained over 12 minutes, ending in a 94 MB outbound transfer.", expected_detection: "R-001…R-005 + correlation", technique: "T1110 → T1078 → T1068 → T1059.001 → T1041" },
] as const;
