import { FilterBar, type EntityQuery } from "../shared/FilterBar";
import { INCIDENT_ANALYSTS, type IncidentWorkflowStatus } from "../../mocks/incidentStore";

export type IncidentQuery = EntityQuery<IncidentWorkflowStatus>;

export const DEFAULT_INCIDENT_QUERY: IncidentQuery = {
  q: "", severity: "", status: "", analyst: "", sort: "severity",
};

const STATUS_OPTIONS: { value: IncidentWorkflowStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "investigating", label: "Investigating" },
  { value: "contained", label: "Contained" },
  { value: "resolved", label: "Resolved" },
];

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
  return (
    <FilterBar
      query={query}
      onChange={onChange}
      defaultQuery={DEFAULT_INCIDENT_QUERY}
      resultCount={resultCount}
      totalCount={totalCount}
      searchPlaceholder="Search incident, ID, host, IP…"
      searchAriaLabel="Search incidents"
      statusOptions={STATUS_OPTIONS}
      analysts={INCIDENT_ANALYSTS}
    />
  );
}
