import { useState } from "react";
import { Search, FilterX, SlidersHorizontal } from "lucide-react";
import { Input, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import type { Severity } from "../../lib/types";

export interface EntityQuery<TStatus extends string> {
  q: string;
  severity: Severity | "";
  status: TStatus | "";
  analyst: string;
  sort: "newest" | "severity" | "risk";
}

/** Shared filter bar for incidents and investigations (Phase C
 *  consolidation) — search, severity, status, analyst, sort, and a clear
 *  button, all wired the same way in both domains. The status option list
 *  and analyst roster are genuinely different per domain, so those stay as
 *  data passed in. */
export function FilterBar<TStatus extends string>({
  query,
  onChange,
  defaultQuery,
  resultCount,
  totalCount,
  searchPlaceholder,
  searchAriaLabel,
  statusOptions,
  analysts,
}: {
  query: EntityQuery<TStatus>;
  onChange: (q: EntityQuery<TStatus>) => void;
  defaultQuery: EntityQuery<TStatus>;
  resultCount: number;
  totalCount: number;
  searchPlaceholder: string;
  searchAriaLabel: string;
  statusOptions: { value: TStatus; label: string }[];
  analysts: string[];
}) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof EntityQuery<TStatus>>(k: K, v: EntityQuery<TStatus>[K]) =>
    onChange({ ...query, [k]: v });
  const dirty = JSON.stringify(query) !== JSON.stringify(defaultQuery);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <div className="min-w-0 flex-1 sm:max-w-xs">
        <Input
          icon={Search}
          value={query.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
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

        <Select value={query.status} onChange={(e) => set("status", e.target.value as TStatus | "")} aria-label="Status">
          <option value="">All statuses</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>

        <Select value={query.analyst} onChange={(e) => set("analyst", e.target.value)} aria-label="Assigned analyst">
          <option value="">All analysts</option>
          <option value="__unassigned">Unassigned</option>
          {analysts.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>

        <Select value={query.sort} onChange={(e) => set("sort", e.target.value as EntityQuery<TStatus>["sort"])} aria-label="Sort">
          <option value="severity">Sort: severity</option>
          <option value="risk">Sort: risk score</option>
          <option value="newest">Sort: newest</option>
        </Select>

        {dirty && <Button variant="ghost" icon={FilterX} onClick={() => onChange(defaultQuery)}>Clear</Button>}
      </div>

      <span className="ml-auto shrink-0 text-2xs text-text-muted">{resultCount} of {totalCount}</span>
    </div>
  );
}
