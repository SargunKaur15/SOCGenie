import { useState } from "react";
import { Panel } from "../ui/Panel";
import type { SeveritySlice } from "../../mocks/dashboard";

const TOKEN: Record<string, string> = {
  critical: "--status-critical",
  high: "--status-high",
  medium: "--status-medium",
  low: "--status-low",
};

/** Donut drawn with stroke-dasharray so it needs no chart library and stays
 *  crisp at any size. */
export function ThreatSeverity({ slices }: { slices: SeveritySlice[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((s, d) => s + d.count, 0);

  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = slices.map((s) => {
    const pct = s.count / total;
    const arc = { ...s, pct, dash: pct * C, offset };
    offset += pct * C;
    return arc;
  });

  const active = arcs.find((a) => a.severity === hover);

  return (
    <Panel eyebrow="Distribution" title="Threat Severity" className="h-full">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <svg viewBox="0 0 140 140" className="h-[140px] w-[140px] -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="rgb(var(--bg-elevated))" strokeWidth="16" />
            {arcs.map((a) => (
              <circle
                key={a.severity}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={`rgb(var(${TOKEN[a.severity]}))`}
                strokeWidth={hover === a.severity ? 19 : 16}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={-a.offset}
                opacity={hover && hover !== a.severity ? 0.35 : 1}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHover(a.severity)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="mono text-xl font-semibold tabular text-text-primary">
              {active ? active.count : total}
            </span>
            <span className="text-2xs text-text-muted">
              {active ? `${(active.pct * 100).toFixed(1)}%` : "total"}
            </span>
          </div>
        </div>

        <ul className="w-full flex-1 space-y-1.5">
          {arcs.map((a) => (
            <li
              key={a.severity}
              onMouseEnter={() => setHover(a.severity)}
              onMouseLeave={() => setHover(null)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors ${
                hover === a.severity ? "bg-bg-elevated" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: `rgb(var(${TOKEN[a.severity]}))` }}
                  aria-hidden="true"
                />
                <span className="text-xs text-text-secondary">{a.label}</span>
              </span>
              <span className="flex items-baseline gap-2">
                <span className="mono text-xs font-semibold tabular text-text-primary">{a.count}</span>
                <span className="mono text-2xs tabular text-text-muted">{(a.pct * 100).toFixed(1)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
