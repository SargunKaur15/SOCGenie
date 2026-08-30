import { useMemo, useState } from "react";
import { Search, FilterX, Bell } from "lucide-react";
import { Panel } from "../ui/Panel";
import { Input, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import { SeverityBadge } from "../ui/SeverityBadge";
import { EmptyState } from "../ui/EmptyState";
import { DataTable, type Column } from "../ui/DataTable";
import { STATUS_LABEL, type SocAlert, type TriageStatus } from "../../mocks/alertStore";
import type { Severity } from "../../lib/types";

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const STATUS_TONE: Record<TriageStatus, string> = {
  open: "text-accent",
  investigating: "text-status-medium",
  contained: "text-status-success",
  monitoring: "text-status-low",
  resolved: "text-status-success",
  false_positive: "text-text-muted",
};

type Sort = "newest" | "oldest" | "severity";

export function RecentAlerts({
  alerts,
  onOpenAlert,
}: {
  alerts: SocAlert[];
  onOpenAlert: (alert: SocAlert) => void;
}) {
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [status, setStatus] = useState<TriageStatus | "">("");
  const [sort, setSort] = useState<Sort>("newest");

  const filtersActive = q !== "" || severity !== "" || status !== "";

  const rows = useMemo(() => {
    let out = alerts.filter((a) => {
      if (severity && a.severity !== severity) return false;
      if (status && a.status !== status) return false;
      if (q) {
        const needle = q.toLowerCase();
        return (
          a.title.toLowerCase().includes(needle) ||
          a.host.toLowerCase().includes(needle) ||
          a.sourceIp.toLowerCase().includes(needle) ||
          a.ref.toLowerCase().includes(needle) ||
          (a.techniqueId ?? "").toLowerCase().includes(needle)
        );
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === "severity") {
        const d = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        return d !== 0 ? d : a.minutesAgo - b.minutesAgo;
      }
      return sort === "oldest" ? b.minutesAgo - a.minutesAgo : a.minutesAgo - b.minutesAgo;
    });
    return out;
  }, [alerts, q, severity, status, sort]);

  const clear = () => {
    setQ("");
    setSeverity("");
    setStatus("");
  };

  const columns: Column<SocAlert>[] = [
    { key: "sev", header: "Severity", width: "116px", render: (a) => <SeverityBadge severity={a.severity} /> },
    {
      key: "alert",
      header: "Alert",
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{a.title}</p>
          <p className="mono text-2xs text-text-muted">
            {a.ref}
            {a.techniqueId && <span className="ml-2 text-accent">{a.techniqueId}</span>}
          </p>
        </div>
      ),
    },
    { key: "source", header: "Source", render: (a) => <span className="mono text-2xs text-text-secondary">{a.sourceIp}</span> },
    { key: "host", header: "Host", render: (a) => <span className="text-xs text-text-secondary">{a.host}</span> },
    { key: "time", header: "Time", align: "right", render: (a) => <span className="text-2xs text-text-muted">{a.minutesAgo} min ago</span> },
    {
      key: "status",
      header: "Status",
      render: (a) => (
        <span className={`text-2xs font-medium ${STATUS_TONE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
      ),
    },
  ];

  return (
    <Panel
      eyebrow="Simulated telemetry"
      title="Recent Alerts"
      noPadding
      actions={<span className="text-2xs text-text-muted">{rows.length} of {alerts.length}</span>}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="w-full sm:w-64">
          <Input
            icon={Search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search alert, host, source, technique…"
            aria-label="Search alerts"
          />
        </div>
        <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")} aria-label="Filter by severity">
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as TriageStatus | "")} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="monitoring">Monitoring</option>
          <option value="resolved">Resolved</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort alerts">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="severity">Highest severity</option>
        </Select>
        {filtersActive && (
          <Button variant="ghost" icon={FilterX} onClick={clear}>Clear</Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={filtersActive ? FilterX : Bell}
          title="No alerts found"
          description={
            filtersActive
              ? "No alerts match the current search and filters."
              : "No alerts have been generated yet."
          }
          action={filtersActive ? <Button onClick={clear}>Clear filters</Button> : undefined}
        />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(a) => a.ref} onRowClick={onOpenAlert} />
      )}
    </Panel>
  );
}
