import { ChevronRight } from "lucide-react";
import { Panel } from "../ui/Panel";
import { SeverityBadge } from "../ui/SeverityBadge";
import { mitreTechniques } from "../../lib/data/fixtures";
import type { Severity } from "../../lib/types";

export interface TechniqueRelevance {
  /** Why this technique is relevant to the current detection. */
  rationale: string;
  /** Mapping confidence 0-1. Deterministic lookup confidence, not a model score. */
  confidence: number;
}

export function MitreMapping({
  techniqueIds,
  primaryId,
  severity,
  onOpenMatrix,
  relevance,
}: {
  techniqueIds: string[];
  primaryId: string | null;
  severity: Severity;
  onOpenMatrix: () => void;
  /** Optional. When omitted the panel renders exactly as before, so callers
   *  that do not supply it (IncidentDetail) are unaffected. */
  relevance?: Record<string, TechniqueRelevance>;
}) {
  const rows = techniqueIds
    .map((id) => mitreTechniques.find((t) => t.technique_id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <Panel
      eyebrow="Adversary behaviour"
      title="MITRE ATT&CK Mapping"
      noPadding
      actions={
        <button onClick={onOpenMatrix} className="text-2xs font-medium text-accent hover:underline">
          Open matrix
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-2xs text-text-muted">
          No confident ATT&amp;CK mapping for this detection.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((t, i) => (
            <li key={t.technique_id}>
              <button
                onClick={onOpenMatrix}
                className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-elevated/60"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="mono text-2xs font-semibold text-accent">{t.technique_id}</span>
                    <span className="truncate text-xs text-text-primary">{t.name}</span>
                    {t.technique_id === primaryId && (
                      <span className="rounded border border-accent/30 bg-accent/10 px-1.5 text-2xs text-accent">
                        primary
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-2xs text-text-muted">{t.tactic}</p>
                  {relevance?.[t.technique_id] && (
                    <p className="mt-1.5 text-2xs leading-relaxed text-text-secondary">
                      <span className="font-medium text-text-muted">Why relevant. </span>
                      {relevance[t.technique_id].rationale}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Event counts are simulated; only the primary technique carries
                      the alert's own severity. */}
                  <span className="mono text-2xs tabular text-text-secondary">
                    {t.technique_id === primaryId ? 1 : 0} events
                  </span>
                  {relevance?.[t.technique_id] && (
                    <span className="mono rounded border border-border px-1.5 py-0.5 text-2xs tabular text-text-secondary">
                      {Math.round(relevance[t.technique_id].confidence * 100)}%
                    </span>
                  )}
                  {t.technique_id === primaryId && <SeverityBadge severity={severity} />}
                  <ChevronRight size={13} className="text-text-muted group-hover:text-accent" aria-hidden="true" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-border px-4 py-2.5 text-2xs text-text-muted">
        Mapping is a deterministic lookup against the curated ATT&amp;CK dataset — never model-generated.
      </p>
    </Panel>
  );
}
