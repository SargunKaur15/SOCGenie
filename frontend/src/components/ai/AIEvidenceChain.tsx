import type { EvidenceChainItem, IocFinding, AnomalyFinding } from "../../lib/ai/types";

const IOC_TONE: Record<string, string> = {
  INDICATOR_MATCH: "text-status-critical",
  SUSPICIOUS: "text-status-high",
  UNKNOWN: "text-text-muted",
  TRUSTED: "text-status-success",
};

export function AIEvidenceChain({
  chain,
  iocs,
  anomalies,
}: {
  chain: EvidenceChainItem[];
  iocs: IocFinding[];
  anomalies: AnomalyFinding[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Evidence chain · {chain.length} items
        </p>
        <ol className="space-y-1.5">
          {chain.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-bg-elevated px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="mono text-2xs text-accent">{c.id}</span>
                <span className="text-2xs text-text-muted">{c.type} · {c.source}</span>
              </div>
              <p className="mono mt-1 break-all text-2xs text-text-primary">{c.summary}</p>
              <p className="mt-1 text-2xs text-text-muted">{c.relevance}</p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-2xs text-text-muted">
          Every item references data already present on this alert. No identifier here is generated.
        </p>
      </div>

      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Indicator analysis
        </p>
        <ul className="space-y-1.5">
          {iocs.map((i) => (
            <li key={`${i.type}-${i.indicator}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="mono text-2xs text-text-primary">{i.indicator}</span>
              <span className={`text-2xs font-semibold ${IOC_TONE[i.classification]}`}>
                {i.classification.replace("_", " ").toLowerCase()}
              </span>
              <span className="w-full text-2xs leading-relaxed text-text-muted">{i.rationale}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Anomaly analysis
        </p>
        <ul className="space-y-2">
          {anomalies.map((a) => (
            <li key={a.observed}>
              <p className="mono text-2xs text-text-primary">{a.observed}</p>
              <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">{a.interpretation}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
