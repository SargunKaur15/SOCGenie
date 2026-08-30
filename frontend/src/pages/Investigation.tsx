import { lazy, Suspense } from "react";

/** Lazy so the Three.js bundle loads only when an investigation is open. */
const AttackPath3D = lazy(() =>
  import("../components/3d/AttackPath3D").then((m) => ({ default: m.AttackPath3D }))
);

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { InvestigationHeader } from "../components/investigation/InvestigationHeader";
import { InvestigationSummary } from "../components/investigation/InvestigationSummary";
import { InvestigationStatusWorkflow } from "../components/investigation/InvestigationStatusWorkflow";
import { RiskOverview } from "../components/investigation/RiskOverview";
import { InvestigationTimeline } from "../components/investigation/InvestigationTimeline";
import { EvidencePanel } from "../components/investigation/EvidencePanel";
import { NetworkActivity } from "../components/investigation/NetworkActivity";
import { MitreMapping, type TechniqueRelevance } from "../components/investigation/MitreMapping";
import { InvestigationNotes } from "../components/investigation/InvestigationNotes";
import { ResponseActions } from "../components/investigation/ResponseActions";
import { InvestigationActivity } from "../components/investigation/InvestigationActivity";
import { AIInvestigationPanel } from "../components/ai/AIInvestigationPanel";
import { InvestigationList } from "../components/investigation/InvestigationList";
import {
  InvestigationFilters,
  DEFAULT_INVESTIGATION_QUERY,
  type InvestigationQuery,
} from "../components/investigation/InvestigationFilters";
// Reused from Phase 5 rather than duplicated.
import { RelatedAlerts } from "../components/incidents/RelatedAlerts";
import { useAlerts } from "../hooks/useAlerts";
import { useInvestigations } from "../hooks/useInvestigations";
import { useCurrentAnalystName, useSession } from "../hooks/useSession";
import { normaliseAssignee, assigneeLabel } from "../lib/data/roster";
import { useInvestigationAi, useAnalystDecisions } from "../hooks/useAiSocGenie";
import { buildInvestigationContext } from "../lib/ai/context";
import { providerStatus } from "../lib/ai/provider";
import type { AnalystDecision } from "../mocks/decisionStore";
import {
  buildTimeline, buildRiskFactors, buildNetworkFlows, buildTechniqueIds,
} from "../mocks/investigation";
import { INVESTIGATION_STATUS_LABEL, type InvestigationStatus, type InvestigationView } from "../mocks/investigationStore";
import type { SocAlert } from "../mocks/alertStore";
import type { Severity } from "../lib/types";
import type { PageKey } from "../App";

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/** Deterministic mapping rationale. Confidence describes how strongly the
 *  observed evidence implies the technique — it is a lookup weight, not a
 *  model output, and no model is consulted. */
const RELEVANCE: Record<string, TechniqueRelevance> = {
  "T1059.001": { rationale: "Encoded PowerShell invoked by an unusual parent process.", confidence: 0.94 },
  "T1071.001": { rationale: "Outbound HTTPS at a regular interval to a single destination.", confidence: 0.78 },
  "T1041": { rationale: "Outbound volume far above the host's rolling baseline.", confidence: 0.72 },
  "T1110": { rationale: "High-volume authentication failures against one account.", confidence: 0.91 },
  "T1078": { rationale: "Successful authentication immediately after a failure burst.", confidence: 0.83 },
  "T1068": { rationale: "Elevated token acquired shortly after a non-admin session start.", confidence: 0.76 },
  "T1003": { rationale: "Process handle opened against a credential store.", confidence: 0.88 },
  "T1046": { rationale: "Sequential connection attempts across many ports and hosts.", confidence: 0.86 },
  "T1566.001": { rationale: "Macro-bearing attachment delivered to a targeted recipient.", confidence: 0.69 },
  "T1053.005": { rationale: "Scheduled task registered by a standard user account.", confidence: 0.64 },
};

/**
 * Investigation Workspace.
 *
 * Two views of one page: a list of investigations, and the full workspace for
 * the selected one. Opening from an alert elsewhere in the app still lands
 * directly in the workspace, so the existing navigation is unchanged.
 *
 * Lifecycle state lives in the investigation overlay store; alert data stays
 * owned by alertStore. There is one source of truth for each.
 */
export function Investigation({
  alertRef,
  onBack,
  onNavigate,
}: {
  alertRef: string | null;
  onBack: () => void;
  onNavigate: (page: PageKey) => void;
}) {
  const { alerts, addNote, editNote, escalate, refresh: refreshAlerts } = useAlerts();
  const { investigations, setStatus, assign, log, refresh: refreshInvestigations } = useInvestigations();

  /** Set when the actor opens one from the list; the prop wins on arrival. */
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [cameFromList, setCameFromList] = useState(false);
  const [query, setQuery] = useState<InvestigationQuery>(DEFAULT_INVESTIGATION_QUERY);
  const ai = useInvestigationAi();
  const { forAlert: decisions, record: recordDecision } = useAnalystDecisions(alertRef ?? selectedRef);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  const activeRef = alertRef ?? selectedRef;
  const view = activeRef ? investigations.find((v) => v.alertRef === activeRef) ?? null : null;
  const alert = view?.alert ?? null;
  // Phase 19 ROOT-CAUSE FIX. This previously read:
  //     const actor = view?.assignedTo ?? sessionAnalyst;
  // which displayed the SIGNED-IN USER as the assignee whenever an
  // investigation was unassigned. Logged in as SOC Admin, that rendered
  // "M. Raghavan" as the investigator — the admin is management, never an
  // assignee. The assignee is now ONLY what the record actually holds.
  const sessionAnalyst = useCurrentAnalystName();
  const isAdmin = useSession()?.role === "admin";
  const assignedAnalyst = normaliseAssignee(view?.assignedTo ?? null);
  /** "A. Sharma (You)" / "J. Mehta" / "Unassigned" — from the record only. */
  const assigneeText = assigneeLabel(assignedAnalyst, sessionAnalyst);
  /** Actor for audit/notes — who is acting, NOT who the work belongs to. */
  const actor = sessionAnalyst;

  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - updatedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [updatedAt]);

  useEffect(() => {
    if (!activeRef) return;
    setUpdatedAt(Date.now());
    setElapsed(0);
  }, [activeRef]);

  const filtered = useMemo<InvestigationView[]>(() => {
    let out = investigations.filter((v: InvestigationView) => {
      if (query.severity && v.alert.severity !== query.severity) return false;
      if (query.status && v.status !== query.status) return false;
      if (query.analyst === "__unassigned" && v.assignedTo !== null) return false;
      if (query.analyst && query.analyst !== "__unassigned" && v.assignedTo !== query.analyst) return false;
      if (query.q) {
        const n = query.q.toLowerCase();
        return (
          v.investigationId.toLowerCase().includes(n) ||
          v.alertRef.toLowerCase().includes(n) ||
          v.alert.title.toLowerCase().includes(n) ||
          v.alert.host.toLowerCase().includes(n) ||
          (v.alert.techniqueId ?? "").toLowerCase().includes(n)
        );
      }
      return true;
    });

    out = [...out].sort((a: InvestigationView, b: InvestigationView) => {
      if (query.sort === "risk") return b.alert.riskScore - a.alert.riskScore;
      if (query.sort === "newest") return a.openedMinutesAgo - b.openedMinutesAgo;
      const d = SEVERITY_RANK[b.alert.severity] - SEVERITY_RANK[a.alert.severity];
      return d !== 0 ? d : b.alert.riskScore - a.alert.riskScore;
    });
    return out;
  }, [investigations, query]);

  const timeline = useMemo(() => (alert ? buildTimeline(alert) : []), [alert, updatedAt]);
  const riskFactors = useMemo(() => (alert ? buildRiskFactors(alert) : []), [alert]);
  const flows = useMemo(() => (alert ? buildNetworkFlows(alert) : []), [alert, updatedAt]);
  const techniqueIds = useMemo(() => (alert ? buildTechniqueIds(alert) : []), [alert]);

  /** Alerts sharing an entity with this one — the correlation the actor cares about. */
  const relatedAlerts = useMemo<SocAlert[]>(() => {
    if (!alert) return [];
    return alerts.filter(
      (a: SocAlert) =>
        a.ref !== alert.ref &&
        (a.host === alert.host || a.sourceIp === alert.sourceIp || (a.user !== null && a.user === alert.user))
    );
  }, [alerts, alert]);

  const filtersActive = JSON.stringify(query) !== JSON.stringify(DEFAULT_INVESTIGATION_QUERY);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => {
      refreshAlerts();
      refreshInvestigations();
      setUpdatedAt(Date.now());
      setElapsed(0);
      setRefreshing(false);
    }, 420);
  }, [refreshAlerts, refreshInvestigations]);

  /** Hands off to this same workspace for a different alert. */
  const openAlert = useCallback((a: SocAlert) => {
    setSelectedRef(a.ref);
    setCameFromList(true);
  }, []);


  // ── List view ────────────────────────────────────────────────────────────
  if (!view) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader
          icon={Search}
          title="Investigations"
          description="Review, triage and work security investigations across the environment."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden text-2xs text-text-muted sm:inline">
                {investigations.length} investigations · updated {elapsed}s ago
              </span>
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
                Refresh
              </Button>
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
            <div className="rounded-lg border border-border bg-bg-surface shadow-panel">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium text-text-primary">Active Investigations</h2>
              </div>
              <InvestigationFilters
                query={query}
                onChange={setQuery}
                resultCount={filtered.length}
                totalCount={investigations.length}
              />
              <InvestigationList
                investigations={filtered}
                onOpen={(v: InvestigationView) => {
                  setSelectedRef(v.alertRef);
                  setCameFromList(true);
                }}
                filtersActive={filtersActive}
                onClearFilters={() => setQuery(DEFAULT_INVESTIGATION_QUERY)}
              />
            </div>

            <p className="pb-2 text-center text-2xs text-text-muted">
              Simulated investigations derived from the alert store. Lifecycle state is held in
              local application memory and resets on reload.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Workspace view ───────────────────────────────────────────────────────
  const status: InvestigationStatus = view.status;

  return (
    <div className="flex h-full flex-col">
      <InvestigationHeader
        alert={view.alert}
        investigationId={view.investigationId}
        actor={actor}
        lastUpdatedSec={elapsed}
        refreshing={refreshing}
        onBack={() => {
          if (cameFromList || !alertRef) {
            setSelectedRef(null);
            setCameFromList(false);
          } else {
            onBack();
          }
        }}
        onRefresh={handleRefresh}
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
          <InvestigationSummary alert={view.alert} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <InvestigationStatusWorkflow
                status={status}
                onChange={(s: InvestigationStatus) => setStatus(view.alertRef, s, actor)}
              />
              <InvestigationTimeline events={timeline} />
              <EvidencePanel alert={view.alert} />
              <RelatedAlerts alerts={relatedAlerts} onOpenAlert={openAlert} />
              <NetworkActivity flows={flows} />
              <MitreMapping
                techniqueIds={techniqueIds}
                primaryId={view.alert.techniqueId}
                severity={view.alert.severity}
                relevance={RELEVANCE}
                onOpenMatrix={() => {
                  log(view.alertRef, actor, "reviewed the MITRE ATT&CK mapping");
                  onNavigate("mitre");
                }}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              {/* Attack path — built from evidence this alert already carries.
                  Rendered above the AI panel so the analyst sees the chain
                  before the interpretation of it. */}
              <Panel eyebrow="Relationships" title="Attack path">
                <Suspense
                  fallback={<div className="h-[320px] animate-pulse rounded-lg border border-border bg-bg-elevated" />}
                >
                  <AttackPath3D alert={alert} />
                </Suspense>
              </Panel>

              <AIInvestigationPanel
                state={ai.state}
                providerLabel={providerStatus().label}
                decisions={decisions}
                onAnalyze={() => ai.analyze(buildInvestigationContext(view, relatedAlerts))}
                onRecordDecision={(decision: AnalystDecision, reason: string) => {
                  if (ai.state.status !== "ready") return;
                  const a = ai.state.result;
                  recordDecision({
                    alertRef: view.alertRef,
                    analyst: actor,
                    decision,
                    reason,
                    aiVerdict: a.assessment.verdict,
                    aiConfidence: a.assessment.confidence,
                    aiRiskScore: a.scorecard.riskScore,
                    aiThreatLikelihood: a.scorecard.threatLikelihood,
                    features: {
                      severity: view.alert.severity,
                      detectionSource: view.alert.detectionSource,
                      techniqueId: view.alert.techniqueId,
                      evidenceCount: view.alert.evidence.length,
                      relatedAlertCount: relatedAlerts.length,
                    },
                  });
                  log(view.alertRef, actor, `recorded an actor decision: ${decision.replace(/_/g, " ").toLowerCase()}`);
                }}
                onAddToNotes={(summary: string) => {
                  addNote(view.alertRef, `[AI SOCGenie summary] ${summary}`, actor);
                  log(view.alertRef, actor, "added the automated summary to investigation notes");
                }}
              />
              <RiskOverview score={view.alert.riskScore} factors={riskFactors} />
              <ResponseActions
                alert={view.alert}
                assignedTo={assignedAnalyst}
                status={status}
                onSetStatus={(s: InvestigationStatus) => setStatus(view.alertRef, s, actor)}
                onEscalate={() => {
                  const ref = escalate(view.alertRef);
                  log(view.alertRef, actor, `escalated to incident ${ref}`);
                }}
                onAssign={(name: string) => assign(view.alertRef, name, actor)}
                onReopen={() => {
                  setStatus(view.alertRef, "investigating", actor);
                  log(view.alertRef, actor, "reopened the investigation");
                }}
              />
              <InvestigationNotes
                notes={view.alert.notes}
                actor={actor}
                onAdd={(body: string) => {
                  addNote(view.alertRef, body, actor);
                  log(view.alertRef, actor, "added an investigation note");
                }}
                onEdit={(id: string, body: string) => {
                  editNote(view.alertRef, id, body);
                  log(view.alertRef, actor, "edited an investigation note");
                }}
              />
              <InvestigationActivity entries={view.activity} />
            </div>
          </div>

          <p className="pb-2 text-center text-2xs text-text-muted">
            Simulated investigation data · status {INVESTIGATION_STATUS_LABEL[status]} · lifecycle,
            notes and activity are held in local application memory and reset on reload.
          </p>
        </div>
      </div>
    </div>
  );
}
