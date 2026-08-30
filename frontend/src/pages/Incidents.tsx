import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Input";
import { IncidentKPIs } from "../components/incidents/IncidentKPIs";
import { IncidentFilters, DEFAULT_INCIDENT_QUERY, type IncidentQuery } from "../components/incidents/IncidentFilters";
import { IncidentTable } from "../components/incidents/IncidentTable";
import { IncidentDetail } from "../components/incidents/IncidentDetail";
import { useIncidentStore } from "../hooks/useIncidents";
import { useAlerts } from "../hooks/useAlerts";
import { useCurrentAnalystName } from "../hooks/useSession";
import { TIME_RANGES, type TimeRange } from "../mocks/dashboard";
import type { SocIncident, IncidentWorkflowStatus } from "../mocks/incidentStore";
import type { SocAlert } from "../mocks/alertStore";
import type { Alert, Severity } from "../lib/types";
import type { PageKey } from "../App";

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const ESCALATE: Record<Severity, Severity> = { low: "medium", medium: "high", high: "critical", critical: "critical" };

/**
 * Incident Management.
 *
 * List and detail are two views of one page rather than two PageKeys — that
 * keeps the existing navigation system untouched and lets "Back to Incidents"
 * restore the exact filter state the analyst left behind.
 */
export function Incidents({
  onInvestigate,
  onNavigate,
}: {
  onInvestigate: (alert: Alert) => void;
  onNavigate: (page: PageKey) => void;
}) {
  const { incidents, setStatus, assign, addNote, editNote, simulateIsolation, logReview, refresh } = useIncidentStore();
  const { alerts } = useAlerts();

  const [query, setQuery] = useState<IncidentQuery>(DEFAULT_INCIDENT_QUERY);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("24h");
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Identity comes from the session, so audit entries name the real user.
  const analyst = useCurrentAnalystName();

  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - updatedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [updatedAt]);

  const filtered = useMemo(() => {
    let out = incidents.filter((i: SocIncident) => {
      if (query.severity && i.severity !== query.severity) return false;
      if (query.status && i.status !== query.status) return false;
      if (query.analyst === "__unassigned" && i.assignedTo !== null) return false;
      if (query.analyst && query.analyst !== "__unassigned" && i.assignedTo !== query.analyst) return false;
      if (query.q) {
        const n = query.q.toLowerCase();
        return (
          i.ref.toLowerCase().includes(n) ||
          i.title.toLowerCase().includes(n) ||
          i.host.toLowerCase().includes(n) ||
          i.sourceIp.toLowerCase().includes(n) ||
          (i.assignedTo ?? "").toLowerCase().includes(n)
        );
      }
      return true;
    });

    out = [...out].sort((a: SocIncident, b: SocIncident) => {
      if (query.sort === "risk") return b.riskScore - a.riskScore;
      if (query.sort === "newest") return a.minutesAgo - b.minutesAgo;
      const d = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      return d !== 0 ? d : b.riskScore - a.riskScore;
    });
    return out;
  }, [incidents, query]);

  const open: SocIncident | null = openRef
    ? incidents.find((i: SocIncident) => i.ref === openRef) ?? null
    : null;
  const relatedAlerts = useMemo(
    () => (open ? alerts.filter((a: SocAlert) => open.alertRefs.includes(a.ref)) : []),
    [open, alerts]
  );
  const primaryAlert = relatedAlerts[0] ?? null;
  const filtersActive = JSON.stringify(query) !== JSON.stringify(DEFAULT_INCIDENT_QUERY);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => {
      refresh();
      setUpdatedAt(Date.now());
      setElapsed(0);
      setRefreshing(false);
    }, 420);
  }, [refresh]);

  /** Hands off to the existing Investigation Workspace. */
  const openAlert = useCallback(
    (a: SocAlert) => {
      onInvestigate({
        id: Number(a.ref.replace(/\D/g, "")) || 0,
        alert_ref: a.ref,
        title: a.title,
        severity: a.severity,
        risk_score: a.riskScore,
        confidence: null,
        status:
          a.status === "resolved" ? "resolved"
          : a.status === "false_positive" ? "false_positive"
          : a.status === "investigating" ? "investigating"
          : "new",
        classification: null,
        detection_source: a.detectionSource === "combined" ? "combined" : a.detectionSource,
        ml_available: a.detectionSource !== "rule",
        mitre_technique_id: a.techniqueId,
        host: a.host,
        user: a.user,
        src_ip: a.sourceIp,
        created_at: new Date(Date.now() - a.minutesAgo * 60_000).toISOString(),
      });
    },
    [onInvestigate]
  );

  if (open) {
    return (
      <IncidentDetail
        incident={open}
        relatedAlerts={relatedAlerts}
        primaryAlert={primaryAlert}
        analyst={analyst}
        lastUpdatedSec={elapsed}
        refreshing={refreshing}
        onBack={() => setOpenRef(null)}
        onRefresh={handleRefresh}
        onSetStatus={(s: IncidentWorkflowStatus) => setStatus(open.ref, s, analyst)}
        onEscalate={() => logReview(open.ref, analyst, `escalated severity to ${ESCALATE[open.severity].toUpperCase()}`)}
        onAssign={(a) => assign(open.ref, a, analyst)}
        onSimulateIsolation={() => simulateIsolation(open.ref, analyst)}
        onAddNote={(body) => addNote(open.ref, body, analyst)}
        onEditNote={(id, body) => editNote(open.ref, id, body, analyst)}
        onOpenAlert={openAlert}
        onOpenMitre={() => {
          logReview(open.ref, analyst, "reviewed the MITRE ATT&CK mapping");
          onNavigate("mitre");
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={ShieldAlert}
        title="Incident Management"
        description="Track, investigate and respond to security incidents across the SOC."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-2xs text-text-muted sm:inline">
              {incidents.length} incidents · updated {elapsed}s ago
            </span>
            <Select value={range} onChange={(e) => setRange(e.target.value as TimeRange)} aria-label="Time range">
              {TIME_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
          <IncidentKPIs incidents={incidents} />

          <div className="rounded-lg border border-border bg-bg-surface shadow-panel">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium text-text-primary">Active Incidents</h2>
            </div>
            <IncidentFilters
              query={query}
              onChange={setQuery}
              resultCount={filtered.length}
              totalCount={incidents.length}
            />
            <IncidentTable
              incidents={filtered}
              onOpen={(i: SocIncident) => setOpenRef(i.ref)}
              filtersActive={filtersActive}
              onClearFilters={() => setQuery(DEFAULT_INCIDENT_QUERY)}
            />
          </div>

          <p className="pb-2 text-center text-2xs text-text-muted">
            Simulated incidents. Workflow state is held in local application memory and resets on reload.
          </p>
        </div>
      </div>
    </div>
  );
}
