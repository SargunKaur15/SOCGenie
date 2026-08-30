import { ArrowLeft, RefreshCw } from "lucide-react";
import { SeverityBadge } from "../ui/SeverityBadge";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { STATUS_LABEL, type SocAlert } from "../../mocks/alertStore";

export function InvestigationHeader({
  alert,
  investigationId,
  actor,
  lastUpdatedSec,
  refreshing,
  onBack,
  onRefresh,
}: {
  alert: SocAlert;
  investigationId: string;
  actor: string;
  lastUpdatedSec: number;
  refreshing: boolean;
  onBack: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="border-b border-border px-6 py-5">
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1.5 text-2xs font-medium text-text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft size={13} aria-hidden="true" /> Back to Alerts
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-text-primary">Investigation Workspace</h1>
          <p className="mt-0.5 text-xs text-text-secondary">
            Analyze alert evidence, understand attack behavior and determine response actions.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="mono text-2xs text-text-muted">{investigationId}</span>
            <SeverityBadge severity={alert.severity} />
            <Badge>{STATUS_LABEL[alert.status]}</Badge>
            <span className="text-2xs text-text-muted">
              Assigned to <span className="font-medium text-text-secondary">{actor}</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-2xs text-text-muted sm:inline">Updated {lastUpdatedSec}s ago</span>
          <Button onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
