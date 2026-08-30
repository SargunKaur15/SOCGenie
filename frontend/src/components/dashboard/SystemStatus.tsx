import { Panel } from "../ui/Panel";
import { useHealth } from "../../hooks/queries";
import { DEMO_MODE } from "../../lib/api";

type State = "active" | "pending" | "unavailable";

/**
 * SOC subsystem status.
 *
 * HONESTY CONTRACT — every row reports what is actually true in Phase 1.
 * There is no backend, no database, no log ingestion and no trained model, so
 * those rows read "Not connected" / "Not trained" rather than ONLINE. Green is
 * reserved for a subsystem that genuinely is running.
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
    {
      label: "Database",
      value: DEMO_MODE ? "Not connected" : (health?.db ?? "Unknown"),
      state: DEMO_MODE ? "pending" : health?.db === "connected" ? "active" : "unavailable",
    },
    { label: "Log Ingestion", value: "Not connected", state: "pending" },
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
      <p className="border-t border-border px-4 py-2.5 text-2xs text-text-muted">
        Subsystems not yet built report their real state rather than a placeholder.
      </p>
    </Panel>
  );
}
