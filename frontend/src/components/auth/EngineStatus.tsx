import { useHealth } from "../../hooks/queries";

/**
 * Detection engine status.
 *
 * Green is used only for a genuinely active subsystem. The ML state was a
 * hardcoded "NOT TRAINED" literal through Phase 12; it now reflects the real
 * backend, and still shows amber whenever no model is loaded.
 */
export function EngineStatus() {
  const { data: health } = useHealth();
  const mlLoaded = health?.ml_engine.loaded === true;

  const engines = [
    { label: "Rule Engine", state: "ACTIVE", tone: "success" as const, live: true },
    mlLoaded
      ? { label: "ML Engine", state: "LOADED", tone: "success" as const, live: true }
      : { label: "ML Engine", state: "NOT TRAINED", tone: "warning" as const, live: false },
  ];

  const dot = { success: "bg-status-success", warning: "bg-status-medium" };
  const text = { success: "text-status-success", warning: "text-status-medium" };

  return (
    <div className="grid grid-cols-2 gap-2">
      {engines.map((e) => (
        <div key={e.label} className="rounded-lg border border-border bg-bg-elevated px-3 py-2.5">
          <p className="text-2xs uppercase tracking-wide text-text-muted">{e.label}</p>
          <p className="mt-1.5 flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              {e.live && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot[e.tone]} opacity-60`} />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot[e.tone]}`} />
            </span>
            <span className={`mono text-[11px] font-semibold tracking-wide ${text[e.tone]}`}>{e.state}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
