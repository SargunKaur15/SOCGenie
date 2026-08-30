import { BarChart3 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { LiveMetrics } from "../components/analytics/LiveMetrics";

/**
 * Analytics — Phase 16.
 *
 * Every figure is computed from the live stores by LiveMetrics. The previous
 * Recharts panels rendered fixture data and were removed rather than left
 * alongside, so nothing on this page is simulated.
 *
 * The chart helpers, KPI card and Recharts imports went with them: keeping
 * unused chart scaffolding would suggest a charting capability the page no
 * longer uses.
 */
export function Analytics() {
  // No query: metrics are computed synchronously from the live stores, so
  // there is nothing to fetch, no loading state and no fetch error path.
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Live metrics computed from the current session"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
          {/* Phase 16 — every figure is computed from the live stores.
              The previous panels rendered fixture data and are removed rather
              than left alongside, so nothing on this page is simulated. */}
          <LiveMetrics />
        </div>
      </div>
    </div>
  );
}
