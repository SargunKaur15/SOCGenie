import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Flame, ShieldAlert, Radar, MonitorSmartphone, Activity, TrendingUp, TrendingDown } from "lucide-react";
import type { Kpi } from "../../mocks/dashboard";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

const ICONS: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  high: Flame,
  incidents: ShieldAlert,
  threats: Radar,
  endpoints: MonitorSmartphone,
  health: Activity,
};

const TONE: Record<Kpi["tone"], string> = {
  critical: "text-status-critical",
  high: "text-status-high",
  medium: "text-status-medium",
  info: "text-accent",
  success: "text-status-success",
};

const TONE_BG: Record<Kpi["tone"], string> = {
  critical: "bg-status-critical/10 border-status-critical/25",
  high: "bg-status-high/10 border-status-high/25",
  medium: "bg-status-medium/10 border-status-medium/25",
  info: "bg-accent/10 border-accent/25",
  success: "bg-status-success/10 border-status-success/25",
};

/** Counts to the target value on mount and whenever it changes. */
function useCountUp(target: number, decimals: number) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    const from = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / 650, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, reduced]);

  return value.toFixed(decimals);
}

function KPICard({ kpi }: { kpi: Kpi }) {
  const Icon = ICONS[kpi.id] ?? Activity;
  const decimals = kpi.suffix === "%" ? 1 : 0;
  const shown = useCountUp(kpi.value, decimals);
  const rising = kpi.trendPct >= 0;
  // A rise is good or bad depending on what the metric measures.
  const bad = rising === kpi.riseIsBad;
  const Trend = rising ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-lg border border-border bg-bg-surface p-4 shadow-panel transition-colors hover:border-accent/30">
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">{kpi.label}</p>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${TONE_BG[kpi.tone]}`}>
          <Icon size={14} strokeWidth={1.9} className={TONE[kpi.tone]} aria-hidden="true" />
        </span>
      </div>

      <p className="mono mt-3 text-2xl font-semibold tabular text-text-primary">
        {shown}
        {kpi.suffix && <span className="text-lg text-text-secondary">{kpi.suffix}</span>}
      </p>

      <p className="mt-1.5 flex items-center gap-1 text-2xs">
        <Trend size={12} className={bad ? "text-status-high" : "text-status-success"} aria-hidden="true" />
        <span className={bad ? "text-status-high" : "text-status-success"}>
          {Math.abs(kpi.trendPct).toFixed(1)}%
        </span>
        <span className="text-text-muted">vs previous period</span>
      </p>
    </div>
  );
}

export function KPIGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KPICard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  );
}
