import type { AttackStoryStep, GraphEdge, GraphNode, AffectedAssets } from "../../lib/ai/types";

const KIND_TONE: Record<GraphNode["kind"], string> = {
  user: "fill-status-medium",
  host: "fill-accent",
  process: "fill-status-high",
  ip: "fill-status-low",
  alert: "fill-status-critical",
  technique: "fill-status-success",
};

/** Simple layered layout — nodes are placed by kind, so the graph reads
 *  left-to-right as identity → asset → activity → outcome. */
const COLUMN: Record<GraphNode["kind"], number> = {
  user: 0, ip: 0, host: 1, process: 2, alert: 3, technique: 4,
};

export function AIAttackStory({
  story,
  chain,
  graph,
  assets,
  rootCause,
}: {
  story: AttackStoryStep[];
  chain: string[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  assets: AffectedAssets;
  rootCause: string;
}) {
  const W = 640;
  const H = 240;
  const cols = 5;
  const byCol = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) {
    const c = COLUMN[n.kind];
    byCol.set(c, [...(byCol.get(c) ?? []), n]);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [c, nodes] of byCol) {
    nodes.forEach((n, i) => {
      pos.set(n.id, {
        x: 60 + (c * (W - 120)) / (cols - 1),
        y: H / 2 + (i - (nodes.length - 1) / 2) * 58,
      });
    });
  }

  return (
    <div className="space-y-4">
      {chain.length > 0 && (
        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Attack chain</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {chain.map((t, i) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-2xs text-accent">{t}</span>
                {i < chain.length - 1 && <span className="text-text-muted" aria-hidden="true">→</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Entity relationships</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-bg-elevated">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full min-w-[560px]" role="img" aria-label="Entity relationship graph">
            {graph.edges.map((e, i) => {
              const a = pos.get(e.from);
              const b = pos.get(e.to);
              if (!a || !b) return null;
              return (
                <g key={i}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgb(var(--border-default))" strokeWidth="1" />
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 4}
                    textAnchor="middle"
                    fontSize="7"
                    fill="rgb(var(--text-muted))"
                  >
                    {e.label}
                  </text>
                </g>
              );
            })}
            {graph.nodes.map((n) => {
              const p = pos.get(n.id);
              if (!p) return null;
              return (
                <g key={n.id}>
                  <circle cx={p.x} cy={p.y} r="6" className={KIND_TONE[n.kind]} opacity="0.85" />
                  <text x={p.x} y={p.y + 18} textAnchor="middle" fontSize="8" fill="rgb(var(--text-secondary))">
                    {n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label}
                  </text>
                  <text x={p.x} y={p.y - 11} textAnchor="middle" fontSize="6.5" fill="rgb(var(--text-muted))">
                    {n.kind}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Attack story</p>
        <ol className="space-y-1.5">
          {story.map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mono shrink-0 text-2xs tabular text-text-muted">{s.time}</span>
              <span className={`text-2xs leading-relaxed ${s.important ? "text-text-primary" : "text-text-secondary"}`}>
                {s.event}
                {s.tactic && <span className="ml-1.5 text-accent">({s.tactic})</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">Confirmed affected</p>
          <ul className="space-y-1">
            {assets.confirmed.map((a) => (
              <li key={a.asset} className="text-2xs text-text-secondary">
                <span className="font-medium text-text-primary">{a.asset}</span> — {a.reason}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">Potentially affected</p>
          <ul className="space-y-1">
            {assets.potential.length === 0 ? (
              <li className="text-2xs text-text-muted">None identified.</li>
            ) : (
              assets.potential.map((a) => (
                <li key={a.asset} className="text-2xs text-text-secondary">
                  <span className="font-medium text-text-primary">{a.asset}</span> — {a.reason}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg-elevated px-3 py-2.5">
        <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">Probable root cause</p>
        <p className="mt-1 text-2xs leading-relaxed text-text-secondary">{rootCause}</p>
      </div>
    </div>
  );
}
