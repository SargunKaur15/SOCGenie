import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, RefreshCw, Search, CheckCircle2, X } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Input";
import { AlertSummary } from "../components/alerts/AlertSummary";
import { AlertFilters, DEFAULT_QUERY, type AlertQuery } from "../components/alerts/AlertFilters";
import { AlertTable } from "../components/alerts/AlertTable";
import { AlertDetail } from "../components/alerts/AlertDetail";
import { useAlerts } from "../hooks/useAlerts";
import { TIME_RANGES, type TimeRange } from "../mocks/dashboard";
import type { SocAlert, TriageStatus } from "../mocks/alertStore";
import type { Alert, Severity } from "../lib/types";

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * Security Alerts workspace.
 *
 * Master-detail: table on the left, triage panel on the right. All state lives
 * in the alert store (src/mocks/alertStore.ts) so status changes, notes and
 * escalations are reflected everywhere immediately — including the dashboard.
 */
export function Alerts({ onInvestigate }: { onInvestigate: (alert: Alert) => void }) {
  const { alerts, setStatus, addNote, escalate, refresh } = useAlerts();

  const [query, setQuery] = useState<AlertQuery>(DEFAULT_QUERY);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [range, setRange] = useState<TimeRange>("24h");
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - updatedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [updatedAt]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const techniques = useMemo(
    () => Array.from(new Set(alerts.map((a) => a.techniqueId).filter(Boolean) as string[])).sort(),
    [alerts]
  );

  const filtered = useMemo(() => {
    let out = alerts.filter((a) => {
      if (query.severity && a.severity !== query.severity) return false;
      if (query.status && a.status !== query.status) return false;
      if (query.source && a.detectionSource !== query.source) return false;
      if (query.technique && a.techniqueId !== query.technique) return false;
      if (query.q) {
        const n = query.q.toLowerCase();
        return (
          a.ref.toLowerCase().includes(n) ||
          a.title.toLowerCase().includes(n) ||
          a.sourceIp.toLowerCase().includes(n) ||
          a.host.toLowerCase().includes(n) ||
          (a.techniqueId ?? "").toLowerCase().includes(n)
        );
      }
      return true;
    });

    out = [...out].sort((a, b) => {
      if (query.sort === "risk") return b.riskScore - a.riskScore;
      if (query.sort === "time") return a.minutesAgo - b.minutesAgo;
      const d = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      return d !== 0 ? d : b.riskScore - a.riskScore;
    });
    return out;
  }, [alerts, query]);

  const selected = selectedRef ? alerts.find((a) => a.ref === selectedRef) ?? null : null;
  const filtersActive = JSON.stringify(query) !== JSON.stringify(DEFAULT_QUERY);

  /** Summary cards act as one-click filters on either severity or status. */
  const applySummaryFilter = useCallback((key: string) => {
    setQuery((q) => {
      if (["critical", "high", "medium", "low"].includes(key)) {
        return { ...q, severity: q.severity === key ? "" : (key as Severity), status: "" };
      }
      return { ...q, status: q.status === key ? "" : (key as TriageStatus), severity: "" };
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => {
      refresh();
      setUpdatedAt(Date.now());
      setElapsed(0);
      setRefreshing(false);
    }, 420);
  }, [refresh]);

  const toggleCheck = useCallback((ref: string) => {
    setChecked((prev) => (prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref]));
  }, []);

  const toggleAll = useCallback(() => {
    setChecked((prev) => (filtered.every((a) => prev.includes(a.ref)) ? [] : filtered.map((a) => a.ref)));
  }, [filtered]);

  const bulkStatus = useCallback(
    (status: TriageStatus, label: string) => {
      setStatus(checked, status);
      setToast(`${checked.length} alert${checked.length === 1 ? "" : "s"} marked ${label}.`);
      setChecked([]);
    },
    [checked, setStatus]
  );

  /** Hands off to the existing Investigation Workspace — no duplicate view. */
  const openInvestigation = useCallback(
    (a: SocAlert) => {
      onInvestigate({
        id: Number(a.ref.replace(/\D/g, "")) || 0,
        alert_ref: a.ref,
        title: a.title,
        severity: a.severity,
        risk_score: a.riskScore,
        confidence: null,
        status: a.status === "false_positive" ? "false_positive" : a.status === "resolved" ? "resolved" : a.status === "investigating" ? "investigating" : "new",
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

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Bell}
        title="Security Alerts"
        description="Review, prioritize and triage security detections across the environment."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-2xs text-text-muted sm:inline">Last updated {elapsed}s ago</span>
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
          <AlertSummary
            alerts={alerts}
            activeFilter={query.severity || query.status || null}
            onSelect={applySummaryFilter}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)]">
            <div className="min-w-0 rounded-lg border border-border bg-bg-surface shadow-panel">
              {checked.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/[0.06] px-4 py-2.5">
                  <span className="text-2xs font-medium text-text-primary">
                    {checked.length} selected
                  </span>
                  <Button icon={Search} onClick={() => bulkStatus("investigating", "investigating")}>
                    Mark investigating
                  </Button>
                  <Button icon={CheckCircle2} onClick={() => bulkStatus("resolved", "resolved")}>
                    Mark resolved
                  </Button>
                  <Button variant="ghost" icon={X} onClick={() => setChecked([])}>Clear</Button>
                </div>
              )}

              <AlertFilters
                query={query}
                onChange={setQuery}
                techniques={techniques}
                resultCount={filtered.length}
                totalCount={alerts.length}
              />

              <AlertTable
                alerts={filtered}
                selectedRef={selectedRef}
                checked={checked}
                onToggleCheck={toggleCheck}
                onToggleAll={toggleAll}
                onOpen={(a) => setSelectedRef(a.ref)}
                filtersActive={filtersActive}
                onClearFilters={() => setQuery(DEFAULT_QUERY)}
              />
            </div>

            <div className="min-w-0 xl:sticky xl:top-5 xl:max-h-[calc(100vh-8rem)]">
              <AlertDetail
                alert={selected}
                onClose={() => setSelectedRef(null)}
                onSetStatus={(s) => {
                  if (!selected) return;
                  setStatus([selected.ref], s);
                  setToast(`${selected.ref} marked ${s.replace("_", " ")}.`);
                }}
                onEscalate={() => {
                  if (!selected) return;
                  const ref = escalate(selected.ref);
                  setToast(`${selected.ref} escalated to ${ref}.`);
                }}
                onAddNote={(body) => selected && addNote(selected.ref, body)}
                onOpenInvestigation={() => selected && openInvestigation(selected)}
              />
            </div>
          </div>

          <p className="pb-2 text-center text-2xs text-text-muted">
            Simulated detections. Triage state is held in local application memory and resets on reload.
          </p>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-xs text-text-primary shadow-panel"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
