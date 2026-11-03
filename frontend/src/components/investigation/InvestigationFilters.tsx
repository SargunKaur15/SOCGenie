import { FilterBar, type EntityQuery } from "../shared/FilterBar";
import {
  INVESTIGATION_ANALYSTS,
  INVESTIGATION_STATUS_LABEL,
  INVESTIGATION_STATUS_ORDER,
  type InvestigationStatus,
} from "../../mocks/investigationStore";

export type InvestigationQuery = EntityQuery<InvestigationStatus>;

export const DEFAULT_INVESTIGATION_QUERY: InvestigationQuery = {
  q: "", severity: "", status: "", analyst: "", sort: "severity",
};

const STATUS_OPTIONS = INVESTIGATION_STATUS_ORDER.map((s) => ({ value: s, label: INVESTIGATION_STATUS_LABEL[s] }));

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
  return (
    <FilterBar
      query={query}
      onChange={onChange}
      defaultQuery={DEFAULT_INVESTIGATION_QUERY}
      resultCount={resultCount}
      totalCount={totalCount}
      searchPlaceholder="Search ID, alert, host, technique…"
      searchAriaLabel="Search investigations"
      statusOptions={STATUS_OPTIONS}
      analysts={INVESTIGATION_ANALYSTS}
    />
  );
}
