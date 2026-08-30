import { useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { IngestPanel } from "../components/detection/IngestPanel";
import { PageHeader } from "../components/ui/PageHeader";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { CodeBlock } from "../components/ui/CodeBlock";
import { DataTable, type Column } from "../components/ui/DataTable";
import { TableSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { ProgressStages } from "../components/ui/ProgressStages";
import { Panel } from "../components/ui/Panel";
import { useEvents } from "../hooks/queries";
import { formatTime } from "../lib/format";
import type { EventOut } from "../lib/types";

const VIEWS = ["raw", "structured", "analysis"] as const;

/** The pipeline stages shown during analysis. The list doubles as an
 *  explanation of the detection architecture (Blueprint §9). */
const PIPELINE_STAGES = [
  "Validating file",
  "Parsing records",
  "Normalising to common schema",
  "Enriching with asset context",
  "ML classification",
  "Rule evaluation",
  "Risk scoring",
  "Correlating alerts",
];

export function LogExplorer() {
  const [view, setView] = useState<(typeof VIEWS)[number]>("raw");
  const [q, setQ] = useState("");
  const query = useEvents(q);
  const events = query.data?.items ?? [];

  const columns: Column<EventOut>[] = [
    { key: "time", header: "Time", width: "110px", render: (e) => <span className="mono text-2xs tabular text-text-muted">{formatTime(e.timestamp)}</span> },
    { key: "source", header: "Source", render: (e) => <span className="text-2xs text-text-secondary">{e.source_type}</span> },
    { key: "host", header: "Host", render: (e) => <span className="text-xs text-text-primary">{e.host ?? "—"}</span> },
    { key: "user", header: "User", render: (e) => <span className="text-xs text-text-secondary">{e.user ?? "—"}</span> },
    { key: "src", header: "Source IP", render: (e) => <span className="mono text-2xs text-text-secondary">{e.src_ip ?? "—"}</span> },
    { key: "action", header: "Action", render: (e) => <span className="mono text-2xs text-text-secondary">{e.action ?? "—"}</span> },
    { key: "outcome", header: "Outcome", render: (e) => <span className="text-2xs text-text-secondary">{e.outcome ?? "—"}</span> },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={ScrollText}
        title="Log Explorer"
        description="Search and analyse ingested security events · CSV, JSON, TXT"
      />

      <div className="border-b border-border px-6 py-4">
        <IngestPanel />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <div className="w-80">
          <Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="host=, user=, src=, evt=…" aria-label="Search events" className="mono" />
        </div>
        <div className="ml-auto">
          <Tabs options={VIEWS} value={view} onChange={setView} ariaLabel="Log view" />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {query.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : query.isError ? (
          <ErrorState message="Events could not be loaded." onRetry={() => query.refetch()} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={q ? "No events match this search" : "No logs ingested"}
            description={q ? "Try a broader search term." : "Upload a log file or run a Simulation Lab scenario to populate this view."}
          />
        ) : view === "raw" ? (
          <div className="p-6">
            <CodeBlock lines={events.map((e) => e.raw_line)} />
          </div>
        ) : view === "structured" ? (
          <DataTable columns={columns} rows={events} rowKey={(e) => e.id} />
        ) : (
          <div className="mx-auto max-w-[720px] p-6">
            <Panel eyebrow="Logs" title="Analysis view">
              <p className="mb-4 text-xs text-text-secondary">
                The analysis view runs an ingested batch through the full detection pipeline and reports what each
                stage produced. These are the stages it will execute:
              </p>
              <ProgressStages stages={PIPELINE_STAGES.map((label) => ({ label, state: "pending" as const }))} />
            </Panel>
          </div>
        )}
      </div>

      {events.length > 0 && (
        <div className="shrink-0 border-t border-border px-6 py-2 text-2xs text-text-muted">
          {events.length} events · simulated data, no batch ingested yet
        </div>
      )}
    </div>
  );
}
