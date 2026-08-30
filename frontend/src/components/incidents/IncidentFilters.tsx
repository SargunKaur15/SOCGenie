import { useState } from "react";
import { Search, FilterX, SlidersHorizontal } from "lucide-react";
import { Input, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import { INCIDENT_ANALYSTS, type IncidentWorkflowStatus } from "../../mocks/incidentStore";
import type { Severity } from "../../lib/types";

export interface IncidentQuery {
  q: string;
  severity: Severity | "";
  status: IncidentWorkflowStatus | "";
  analyst: string;
  sort: "newest" | "severity" | "risk";
}

export const DEFAULT_INCIDENT_QUERY: IncidentQuery = {
  q: "", severity: "", status: "", analyst: "", sort: "severity",
};

export function IncidentFilters({
  query,
  onChange,
  resultCount,
  totalCount,
}: {
  query: IncidentQuery;
  onChange: (q: IncidentQuery) => void;
  resultCount: number;
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof IncidentQuery>(k: K, v: IncidentQuery[K]) => onChange({ ...query, [k]: v });
  const dirty = JSON.stringify(query) !== JSON.stringify(DEFAULT_INCIDENT_QUERY);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <div className="min-w-0 flex-1 sm:max-w-xs">
        <Input
          icon={Search}
          value={query.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search incident, ID, host, IP…"
          aria-label="Search incidents"
        />
      </div>

      <Button variant="ghost" icon={SlidersHorizontal} onClick={() => setOpen((o) => !o)} aria-expanded={open} className="lg:hidden">
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

        <Select value={query.status} onChange={(e) => set("status", e.target.value as IncidentWorkflowStatus | "")} aria-label="Status">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="investigating">Investigating</option>
          <option value="contained">Contained</option>
          <option value="resolved">Resolved</option>
        </Select>

        <Select value={query.analyst} onChange={(e) => set("analyst", e.target.value)} aria-label="Assigned analyst">
          <option value="">All analysts</option>
          <option value="__unassigned">Unassigned</option>
          {INCIDENT_ANALYSTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>

        <Select value={query.sort} onChange={(e) => set("sort", e.target.value as IncidentQuery["sort"])} aria-label="Sort">
          <option value="severity">Sort: severity</option>
          <option value="risk">Sort: risk score</option>
          <option value="newest">Sort: newest</option>
        </Select>

        {dirty && <Button variant="ghost" icon={FilterX} onClick={() => onChange(DEFAULT_INCIDENT_QUERY)}>Clear</Button>}
      </div>

      <span className="ml-auto shrink-0 text-2xs text-text-muted">{resultCount} of {totalCount}</span>
    </div>
  );
}
