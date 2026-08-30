import { lazy, Suspense } from "react";
import { Panel } from "../components/ui/Panel";

/** Lazy so the Three.js bundle loads only when the MITRE page renders. */
const MitreMap3D = lazy(() =>
  import("../components/3d/MitreMap3D").then((m) => ({ default: m.MitreMap3D }))
);

import { Crosshair } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { useMitre } from "../hooks/queries";

/** Tactic column order follows the ATT&CK Enterprise kill-chain sequence. */
const TACTIC_ORDER = [
  "Initial Access", "Execution", "Persistence", "Privilege Escalation",
  "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
  "Command and Control", "Exfiltration", "Impact",
];

export function Mitre() {
  const query = useMitre();
  const techniques = query.data ?? [];
  const tactics = TACTIC_ORDER.filter((t) => techniques.some((m) => m.tactic === t));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Crosshair}
        title="MITRE ATT&CK"
        description={
          query.data
            ? `${techniques.length} curated techniques across ${tactics.length} tactics · Enterprise matrix`
            : "Loading technique catalogue…"
        }
      />
      <div className="flex-1 overflow-auto p-6">
        {/* Supplementary 3D layer. The existing technique list below is
            unchanged and remains the primary interface. */}
        {techniques.length > 0 && (
          <div className="mb-4">
            <Panel eyebrow="Coverage" title="Technique map">
              <Suspense
                fallback={<div className="h-[62vh] min-h-[480px] max-h-[680px] animate-pulse rounded-lg border border-border bg-bg-elevated" />}
              >
                <MitreMap3D techniques={techniques} tacticOrder={TACTIC_ORDER} />
              </Suspense>
            </Panel>
          </div>
        )}

        {query.isLoading ? (
          <div className="flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 flex-1 rounded-lg" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState message="Technique catalogue could not be loaded." onRetry={() => query.refetch()} />
        ) : techniques.length === 0 ? (
          <EmptyState icon={Crosshair} title="No techniques loaded" description="The curated ATT&CK dataset is not loaded." />
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {tactics.map((tactic) => (
                <div key={tactic} className="min-w-[190px] flex-1">
                  <div className="mb-2 border-b border-border pb-1.5">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-text-secondary">{tactic}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {techniques
                      .filter((m) => m.tactic === tactic)
                      .map((m) => {
                        const observed = (m.observed_count ?? 0) > 0;
                        return (
                          <div
                            key={m.technique_id}
                            title={m.description}
                            className={`rounded-md border p-2.5 transition-colors ${
                              observed
                                ? "border-status-high/40 bg-status-high/[0.07]"
                                : "border-border bg-bg-surface"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="mono text-2xs font-semibold text-accent">{m.technique_id}</span>
                              {observed && (
                                <span className="rounded-full bg-status-high/20 px-1.5 text-2xs font-semibold text-status-high">
                                  {m.observed_count}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-2xs leading-snug text-text-secondary">{m.name}</p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-2xs text-text-muted">
              Highlighted techniques have observed activity. Technique IDs and names follow the published MITRE
              ATT&CK Enterprise matrix — mapping is a deterministic lookup, never model-generated.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
