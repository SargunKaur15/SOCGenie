import { Panel } from "../ui/Panel";
import type { RiskFactor } from "../../mocks/investigation";

const BANDS = [
  { label: "Low", from: 0, to: 24, token: "--status-low" },
  { label: "Medium", from: 25, to: 49, token: "--status-medium" },
  { label: "High", from: 50, to: 74, token: "--status-high" },
  { label: "Critical", from: 75, to: 100, token: "--status-critical" },
];

function bandOf(score: number) {
  return BANDS.find((b) => score >= b.from && score <= b.to) ?? BANDS[0];
}

export function RiskOverview({ score, factors }: { score: number; factors: RiskFactor[] }) {
  const band = bandOf(score);

  return (
    <Panel eyebrow="Risk" title="Risk Overview">
      <div className="flex items-baseline gap-2">
        <span className="mono text-3xl font-semibold tabular text-text-primary">{score}</span>
        <span className="text-sm text-text-muted">/ 100</span>
        <span
          className="ml-auto text-xs font-semibold uppercase tracking-wide"
          style={{ color: `rgb(var(${band.token}))` }}
        >
          {band.label}
        </span>
      </div>

      {/* Horizontal meter with the four bands laid out proportionally */}
      <div className="mt-3">
        <div className="flex h-2 w-full overflow-hidden rounded-full">
          {BANDS.map((b) => (
            <div
              key={b.label}
              style={{
                width: `${b.to - b.from + 1}%`,
                backgroundColor: `rgb(var(${b.token}))`,
                opacity: b.label === band.label ? 1 : 0.22,
              }}
            />
          ))}
        </div>
        <div className="relative mt-1 h-3">
          <span
            className="absolute top-0 -translate-x-1/2 text-2xs text-text-muted"
            style={{ left: `${score}%` }}
          >
            ▲
          </span>
        </div>
        <div className="flex justify-between text-2xs text-text-muted">
          {BANDS.map((b) => (
            <span key={b.label}>{b.label}</span>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Contributing factors
        </p>
        <ul className="space-y-1.5">
          {factors.map((f) => (
            <li key={f.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${f.present ? "bg-accent" : "bg-text-muted/40"}`}
                  aria-hidden="true"
                />
                <span className={`text-2xs ${f.present ? "text-text-secondary" : "text-text-muted"}`}>
                  {f.label}
                </span>
              </span>
              <span className={`mono text-2xs tabular ${f.present ? "text-text-primary" : "text-text-muted"}`}>
                {f.present ? `+${f.weight}` : "—"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-border pt-2 text-2xs text-text-muted">
          Factors reflect the six-factor risk model. No single factor can reach CRITICAL alone.
        </p>
      </div>
    </Panel>
  );
}
