import { Search, FilterX, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Input, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import type { Severity } from "../../lib/types";
import type { DetectionSource, TriageStatus } from "../../mocks/alertStore";

export interface AlertQuery {
  q: string;
  severity: Severity | "";
  status: TriageStatus | "";
  source: DetectionSource | "";
  technique: string;
  sort: "severity" | "risk" | "time";
}

export const DEFAULT_QUERY: AlertQuery = {
  q: "", severity: "", status: "", source: "", technique: "", sort: "severity",
};

export function AlertFilters({
  query,
  onChange,
  techniques,
  resultCount,
  totalCount,
}: {
  query: AlertQuery;
  onChange: (q: AlertQuery) => void;
  techniques: string[];
  resultCount: number;
  totalCount: number;
}) {
  // Below lg the filter row collapses behind a toggle so the table keeps its space.
  const [open, setOpen] = useState(false);
  const set = <K extends keyof AlertQuery>(k: K, v: AlertQuery[K]) => onChange({ ...query, [k]: v });
  const dirty = JSON.stringify(query) !== JSON.stringify(DEFAULT_QUERY);

  return (
    <div className="border-b border-border">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <Input
            icon={Search}
            value={query.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search ID, alert, host, IP, technique…"
            aria-label="Search alerts"
          />
        </div>

        <Button
          variant="ghost"
          icon={SlidersHorizontal}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="lg:hidden"
        >
          Filters
        </Button>

        <div className={`${open ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 lg:flex lg:w-auto`}>
          <Select value={query.severity} onChange={(e) => set("severity", e.target.value as Severity | "")} aria-label="Severity">
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>

          <Select value={query.status} onChange={(e) => set("status", e.target.value as TriageStatus | "")} aria-label="Status">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="contained">Contained</option>
            <option value="monitoring">Monitoring</option>
            <option value="resolved">Resolved</option>
            <option value="false_positive">False positive</option>
          </Select>

          <Select value={query.source} onChange={(e) => set("source", e.target.value as DetectionSource | "")} aria-label="Detection source">
            <option value="">All sources</option>
            <option value="rule">Rule</option>
            <option value="ml">ML</option>
            <option value="combined">Rule + ML</option>
          </Select>

          <Select value={query.technique} onChange={(e) => set("technique", e.target.value)} aria-label="MITRE technique">
            <option value="">All techniques</option>
            {techniques.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>

          <Select value={query.sort} onChange={(e) => set("sort", e.target.value as AlertQuery["sort"])} aria-label="Sort">
            <option value="severity">Sort: severity</option>
            <option value="risk">Sort: risk score</option>
            <option value="time">Sort: most recent</option>
          </Select>

          {dirty && (
            <Button variant="ghost" icon={FilterX} onClick={() => onChange(DEFAULT_QUERY)}>Clear</Button>
          )}
        </div>

        <span className="ml-auto shrink-0 text-2xs text-text-muted">
          {resultCount} of {totalCount}
        </span>
      </div>
    </div>
  );
}
