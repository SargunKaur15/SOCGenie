import { Panel } from "../ui/Panel";
import { useHealth } from "../../hooks/queries";
import { DEMO_MODE } from "../../lib/api";

type State = "active" | "pending" | "unavailable";

/**
 * SOC subsystem status.
 *
 * Rule Engine, ML Detection Engine, API Service, and SOCGenie Assist report
 * real state (ML Detection Engine and API Service are computed from a live
 * /api/health check when one is reachable).
 *
 * Database and Log Ingestion are DISPLAY-ONLY for this portfolio build —
 * neither subsystem exists in the codebase (no DB integration, no ingestion
 * pipeline), and these two rows are hardcoded to "Connected" at the
 * requester's explicit direction, overriding the honesty-contract default
 * ("Not connected") that the rest of this component still follows.
 */
export function SystemStatus() {
  const { data: health, isLoading } = useHealth();

  const rows: { label: string; value: string; state: State }[] = [
    { label: "Rule Engine", value: "Active", state: "active" },
    {
      label: "ML Detection Engine",
      value: health?.ml_engine.loaded ? `Loaded v${health.ml_engine.version}` : "Not trained",
      state: health?.ml_engine.loaded ? "active" : "pending",
    },
    {
      label: "API Service",
      value: DEMO_MODE ? "Demo mode" : health?.status === "ok" ? "Reachable" : "Unreachable",
      state: DEMO_MODE ? "pending" : health?.status === "ok" ? "active" : "unavailable",
    },
    { label: "Database", value: "Connected", state: "active" },
    { label: "Log Ingestion", value: "Connected", state: "active" },
    {
      label: "SOCGenie Assist",
      value: health?.assist_provider === "llm" ? "External provider" : "Rule-based",
      state: "active",
    },
  ];

  const dot: Record<State, string> = {
    active: "bg-status-success",
    pending: "bg-text-muted",
    unavailable: "bg-status-medium",
  };
  const text: Record<State, string> = {
    active: "text-status-success",
    pending: "text-text-muted",
    unavailable: "text-status-medium",
  };

  return (
    <Panel eyebrow="Subsystems" title="SOC System Status" className="h-full" noPadding>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-xs text-text-secondary">{r.label}</span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                {r.state === "active" && (
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot[r.state]} opacity-60`} />
                )}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot[r.state]}`} />
              </span>
              <span className={`mono text-2xs font-semibold ${text[r.state]}`}>
                {isLoading ? "…" : r.value}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
