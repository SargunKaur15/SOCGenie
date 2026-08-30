import { useState } from "react";
import { Search, FilterX, SlidersHorizontal } from "lucide-react";
import { Input, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import {
  INVESTIGATION_ANALYSTS,
  INVESTIGATION_STATUS_LABEL,
  INVESTIGATION_STATUS_ORDER,
  type InvestigationStatus,
} from "../../mocks/investigationStore";
import type { Severity } from "../../lib/types";

export interface InvestigationQuery {
  q: string;
  severity: Severity | "";
  status: InvestigationStatus | "";
  analyst: string;
  sort: "severity" | "risk" | "newest";
}

export const DEFAULT_INVESTIGATION_QUERY: InvestigationQuery = {
  q: "", severity: "", status: "", analyst: "", sort: "severity",
};

export function InvestigationFilters({
  query,
  onChange,
  resultCount,
  totalCount,
}: {
  query: InvestigationQuery;
  onChange: (q: InvestigationQuery) => void;
  resultCount: number;
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof InvestigationQuery>(k: K, v: InvestigationQuery[K]) =>
    onChange({ ...query, [k]: v });
  const dirty = JSON.stringify(query) !== JSON.stringify(DEFAULT_INVESTIGATION_QUERY);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <div className="min-w-0 flex-1 sm:max-w-xs">
        <Input
          icon={Search}
          value={query.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search ID, alert, host, technique…"
          aria-label="Search investigations"
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

        <Select value={query.status} onChange={(e) => set("status", e.target.value as InvestigationStatus | "")} aria-label="Status">
          <option value="">All statuses</option>
          {INVESTIGATION_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{INVESTIGATION_STATUS_LABEL[s]}</option>
          ))}
        </Select>

        <Select value={query.analyst} onChange={(e) => set("analyst", e.target.value)} aria-label="Assigned analyst">
          <option value="">All analysts</option>
          <option value="__unassigned">Unassigned</option>
          {INVESTIGATION_ANALYSTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>

        <Select value={query.sort} onChange={(e) => set("sort", e.target.value as InvestigationQuery["sort"])} aria-label="Sort">
          <option value="severity">Sort: severity</option>
          <option value="risk">Sort: risk score</option>
          <option value="newest">Sort: newest</option>
        </Select>

        {dirty && <Button variant="ghost" icon={FilterX} onClick={() => onChange(DEFAULT_INVESTIGATION_QUERY)}>Clear</Button>}
      </div>

      <span className="ml-auto shrink-0 text-2xs text-text-muted">{resultCount} of {totalCount}</span>
    </div>
  );
}
