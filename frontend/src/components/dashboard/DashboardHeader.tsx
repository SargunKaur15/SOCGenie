import { RefreshCw } from "lucide-react";
import { Select } from "../ui/Input";
import { Button } from "../ui/Button";
import { TIME_RANGES, type TimeRange } from "../../mocks/dashboard";

export function DashboardHeader({
  range,
  onRangeChange,
  onRefresh,
  refreshing,
  lastUpdatedSec,
}: {
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdatedSec: number;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">
          Security Operations Center
        </h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Real-time visibility across alerts, incidents and security telemetry.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs text-text-muted">
          Last updated {lastUpdatedSec}s ago
        </span>
        <Select
          value={range}
          onChange={(e) => onRangeChange(e.target.value as TimeRange)}
          aria-label="Time range"
        >
          {TIME_RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
        <Button onClick={onRefresh} disabled={refreshing} aria-label="Refresh telemetry">
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
