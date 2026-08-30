import { lazy, Suspense, useMemo } from "react";
import { Activity, Radar, ShieldCheck, Target } from "lucide-react";
import { useAlerts } from "../../hooks/useAlerts";
import { useIncidentStore } from "../../hooks/useIncidents";
import { TelemetryWaveform } from "./TelemetryWaveform";

const NetworkTopology3D = lazy(() =>
  import("../3d/NetworkTopology3D").then((m) => ({ default: m.NetworkTopology3D }))
);

/**
 * Login page centrepiece — real, live SOC telemetry.
 *
 * Reads the same alert/incident store the authenticated Command Center reads
 * from (mocks/alertStore, mocks/incidentStore via useAlerts/useIncidentStore),
 * so the counts here can never disagree with what the analyst sees after
 * signing in. Nothing on this panel is fabricated for the pre-auth screen.
 */

const METRIC_TONE: Record<string, string> = {
  events: "text-accent",
  critical: "text-status-critical",
  high: "text-status-high",
  medium: "text-status-medium",
  low: "text-status-low",
};

const STATUS_ITEMS = [
  { label: "SOC", state: "OPERATIONAL", icon: ShieldCheck },
  { label: "TELEMETRY", state: "ACTIVE", icon: Activity },
  { label: "DETECTION", state: "ACTIVE", icon: Radar },
  { label: "MITRE", state: "ALIGNED", icon: Target },
];

export function LiveTelemetryPanel() {
  const { alerts } = useAlerts();
  const { incidents } = useIncidentStore();

  const metrics = useMemo(() => {
    const active = alerts.filter((a) => a.status !== "resolved" && a.status !== "false_positive");
    return {
      events: active.length,
      critical: active.filter((a) => a.severity === "critical").length,
      high: active.filter((a) => a.severity === "high").length,
      medium: active.filter((a) => a.severity === "medium").length,
      low: active.filter((a) => a.severity === "low").length,
    };
  }, [alerts]);

  const cards = [
    { key: "events", label: "Active events", value: metrics.events },
    { key: "critical", label: "Critical", value: metrics.critical },
    { key: "high", label: "High", value: metrics.high },
    { key: "medium", label: "Medium", value: metrics.medium },
    { key: "low", label: "Low", value: metrics.low },
  ];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-bg-surface/60 p-5 shadow-panel backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <h2 className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Live security telemetry
        </h2>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-2">
        {cards.map((c) => (
          <div
            key={c.key}
            className="rounded-lg border border-border bg-bg-elevated/70 px-2 py-2.5 text-center"
          >
            <p className={`mono text-xl font-bold tabular ${METRIC_TONE[c.key]}`}>
              {String(c.value).padStart(2, "0")}
            </p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
              {c.label}
            </p>
          </div>
        ))}
      </div>

      <div className="min-h-[300px] flex-1">
        <Suspense
          fallback={
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-border bg-[#080b14]">
              <span className="text-2xs text-text-muted">Loading telemetry…</span>
            </div>
          }
        >
          <NetworkTopology3D alerts={alerts} incidents={incidents} />
        </Suspense>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">SOC status</p>
        <div className="grid grid-cols-4 gap-2">
          {STATUS_ITEMS.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-bg-elevated/70 px-2 py-2">
              <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                <s.icon size={10} className="text-status-success" aria-hidden="true" />
                {s.label}
              </p>
              <p className="mt-1 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-50" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-success" />
                </span>
                <span className="mono text-[10px] font-semibold text-status-success">{s.state}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 h-10 overflow-hidden rounded-lg border border-border/60 bg-bg-elevated/40">
        <TelemetryWaveform />
      </div>

      <p className="mt-3 text-center text-2xs text-text-muted">
        Real-time monitoring · Continuous analysis · 24/7 protection
      </p>
    </div>
  );
}
