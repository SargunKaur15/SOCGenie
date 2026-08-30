import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";
import type { TimelinePoint } from "../../mocks/dashboard";

/** Recharts cannot read Tailwind classes, so charts consume the CSS variables
 *  directly — this keeps both themes correct with no colour props. */
const v = (name: string) => `rgb(var(${name}))`;

const SERIES = [
  { key: "critical", label: "Critical", token: "--status-critical" },
  { key: "high", label: "High", token: "--status-high" },
  { key: "medium", label: "Medium", token: "--status-medium" },
  { key: "low", label: "Low", token: "--status-low" },
] as const;

const axis = { stroke: v("--text-muted"), fontSize: 10, tickLine: false, axisLine: false } as const;

export function SecurityTimeline({ data }: { data: TimelinePoint[] }) {
  const total = data.reduce((s, d) => s + d.critical + d.high + d.medium + d.low, 0);

  return (
    <Panel
      eyebrow="Detection volume"
      title="Security Events Timeline"
      actions={<Badge>{total.toLocaleString()} events</Badge>}
    >
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={v(s.token)} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={v(s.token)} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke={v("--border-default")} vertical={false} />
            <XAxis dataKey="bucket" {...axis} />
            <YAxis width={44} allowDecimals={false} {...axis} />
            <Tooltip
              contentStyle={{
                backgroundColor: v("--bg-elevated"),
                border: `1px solid ${v("--border-default")}`,
                borderRadius: 6,
                fontSize: 11,
                color: v("--text-primary"),
              }}
              cursor={{ stroke: v("--border-default") }}
            />
            <Legend
              iconType="plainline"
              wrapperStyle={{ fontSize: 11, color: v("--text-secondary"), paddingTop: 6 }}
            />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stackId="1"
                stroke={v(s.token)}
                strokeWidth={1.5}
                fill={`url(#grad-${s.key})`}
                isAnimationActive
                animationDuration={450}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 border-t border-border pt-2 text-2xs text-text-muted">
        Answers: is alert pressure rising, and which severities are driving it?
      </p>
    </Panel>
  );
}
