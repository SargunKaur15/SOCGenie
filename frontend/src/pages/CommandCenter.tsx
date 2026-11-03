import { lazy, Suspense } from "react";

/** Lazy so the Three.js bundle is fetched only when the dashboard renders,
 *  and never blocks first paint. */
const SocCore3D = lazy(() =>
  import("../components/3d/SocCore3D").then((m) => ({ default: m.SocCore3D }))
);
const ThreatRadar = lazy(() =>
  import("../components/3d/ThreatRadar").then((m) => ({ default: m.ThreatRadar }))
);

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { KPIGrid } from "../components/dashboard/KPIGrid";
import { SecurityTimeline } from "../components/dashboard/SecurityTimeline";
import { ThreatSeverity } from "../components/dashboard/ThreatSeverity";
import { MitreTechniques } from "../components/dashboard/MitreTechniques";
import { RecentAlerts } from "../components/dashboard/RecentAlerts";
import { SystemStatus } from "../components/dashboard/SystemStatus";
import { LiveSecurityFeed } from "../components/dashboard/LiveSecurityFeed";
import { KPIS, SEVERITY_BREAKDOWN, MITRE_TOP, buildTimeline, type TimeRange } from "../mocks/dashboard";
import { Panel } from "../components/ui/Panel";
import { useAlerts } from "../hooks/useAlerts";
import { useIncidentStore } from "../hooks/useIncidents";
import { useHealth } from "../hooks/queries";
import { AISocGenieButton, AISocGenieDrawer } from "../components/ai/AISocGenieDrawer";
import type { SocAlert } from "../mocks/alertStore";
import type { PageKey } from "../App";
import type { Alert } from "../lib/types";

/**
 * Security Operations Center — the authenticated landing workspace.
 *
 * All telemetry on this screen is SIMULATED (see src/mocks/dashboard.ts).
 * Mock data is kept out of these components so a Phase-2 API response can
 * replace the module without touching any UI file.
 */
export function CommandCenter({
  onInvestigate,
  onNavigate,
}: {
  onInvestigate: (alert: Alert) => void;
  onNavigate: (page: PageKey) => void;
}) {
  const { alerts } = useAlerts();
  const { incidents } = useIncidentStore();
  const { data: health } = useHealth();
  const mlLive = health?.ml_engine.loaded ?? false;
  const [aiOpen, setAiOpen] = useState(false);
  const [range, setRange] = useState<TimeRange>("24h");
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  const timeline = useMemo(() => buildTimeline(range, nonce), [range, nonce]);

  useEffect(() => {
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - updatedAt) / 1000)),
      1000
    );
    return () => window.clearInterval(id);
  }, [updatedAt]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    // Re-derives the simulated series; Phase 2 replaces this with a refetch.
    window.setTimeout(() => {
      setNonce((n) => n + 1);
      setUpdatedAt(Date.now());
      setElapsed(0);
      setRefreshing(false);
    }, 450);
  }, []);

  const handleRangeChange = useCallback((r: TimeRange) => {
    setRange(r);
    setUpdatedAt(Date.now());
    setElapsed(0);
  }, []);

  /** Routes a dashboard row into the existing Investigation Workspace rather
   *  than duplicating a detail view. */
  const openAlert = useCallback(
    (a: SocAlert) => {
      onInvestigate({
        id: Number(a.ref.replace(/\D/g, "")) || 0,
        alert_ref: a.ref,
        title: a.title,
        severity: a.severity,
        risk_score: a.riskScore,
        confidence: null,
        status: a.status === "resolved" ? "resolved" : a.status === "false_positive" ? "false_positive" : a.status === "investigating" ? "investigating" : "new",
        classification: null,
        detection_source: a.detectionSource === "combined" ? "combined" : a.detectionSource,
        ml_available: a.detectionSource !== "rule",
        mitre_technique_id: a.techniqueId,
        host: a.host,
        user: null,
        src_ip: a.sourceIp,
        created_at: new Date(Date.now() - a.minutesAgo * 60_000).toISOString(),
      });
    },
    [onInvestigate]
  );

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-5">
      <DashboardHeader
        range={range}
        onRangeChange={handleRangeChange}
        onRefresh={refresh}
        refreshing={refreshing}
        lastUpdatedSec={elapsed}
      />

      <KPIGrid kpis={KPIS} />

      <Panel
        eyebrow="Live correlation map"
        title="Security Operations Universe"
        className="ring-1 ring-accent-secondary/[0.06] dark:ring-white/[0.03]"
        actions={
          <span className="flex items-center gap-1.5 text-2xs font-medium text-status-success">
            <span className="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" aria-hidden="true" />
            Live
          </span>
        }
      >
        <Suspense
          fallback={<div className="h-[340px] animate-pulse rounded-lg border border-border bg-bg-elevated" />}
        >
          {/* Nodes are derived from the live alert and incident queues.
              onNavigate reuses the dashboard's existing routing; the optional
              ref is dropped because PageKey navigation takes a page only. */}
          <SocCore3D
            alerts={alerts}
            incidents={incidents}
            onNavigate={(page) => onNavigate(page as PageKey)}
          />
        </Suspense>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SecurityTimeline data={timeline} />
        </div>
        <ThreatSeverity slices={SEVERITY_BREAKDOWN} />
      </div>

      <Panel eyebrow="Detection sweep" title="Threat Radar">
        <Suspense
          fallback={<div className="h-[280px] animate-pulse rounded-lg border border-border bg-bg-elevated" />}
        >
          {/* Real alert severities and recency only — see ThreatRadar.tsx for
              the exact, honest mapping from data to position. */}
          <ThreatRadar alerts={alerts} onOpenAlert={openAlert} />
        </Suspense>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentAlerts alerts={alerts.slice(0, 10)} onOpenAlert={openAlert} />
        </div>
        <div className="flex flex-col gap-4">
          <MitreTechniques rows={MITRE_TOP} onSelect={() => onNavigate("mitre")} />
          <LiveSecurityFeed />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SystemStatus />
        <div className="rounded-lg border border-border bg-bg-surface p-4 shadow-panel">
          <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Detection pipeline
          </p>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            Alerts on this dashboard are produced by the deterministic rule engine.{" "}
            {mlLive
              ? `The machine learning engine is loaded (v${health?.ml_engine.version}) and available, but this workspace's alert feed is demonstration data and does not route through it yet — no classifications or confidence scores are shown here.`
              : "The machine learning model has been trained and evaluated offline (see Detection & ML for the real metrics), but live scoring is not running in this session, so no ML classifications or confidence scores are shown anywhere in this workspace."}
          </p>
          <button
            onClick={() => onNavigate("detection-ml")}
            className="mt-3 text-2xs font-medium text-accent hover:underline"
          >
            Open Detection &amp; ML →
          </button>
        </div>
      </div>

      <AISocGenieButton onClick={() => setAiOpen(true)} open={aiOpen} />
      <AISocGenieDrawer open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
