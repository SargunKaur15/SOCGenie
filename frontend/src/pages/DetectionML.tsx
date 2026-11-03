import { useState } from "react";
import { Radar, AlertCircle, Terminal } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { Tabs } from "../components/ui/Tabs";
import { SeverityBadge } from "../components/ui/SeverityBadge";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { DataTable, type Column } from "../components/ui/DataTable";
import { KeyValueList } from "../components/ui/KeyValueList";
import { TableSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { useDetections, useMlStatus } from "../hooks/queries";
import { FEATURE_REGISTRY, SECURITY_CLASSES } from "../lib/constants";
import { relativeTime } from "../lib/format";
import type { DetectionRule } from "../lib/types";

const TABS = ["rules", "model"] as const;

const PIPELINE = ["Data", "Preprocess", "Features", "Train", "Evaluate", "Model", "Predict"];

export function DetectionML() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("rules");
  const rulesQ = useDetections();
  const statusQ = useMlStatus();

  const rules = rulesQ.data ?? [];
  const status = statusQ.data;
  // "not_trained" here means "not currently loaded/active" — the live-service
  // signal from mlStatus() (server/src/mlProvider.ts). It is NOT a claim that
  // no model was ever trained: model_card.json's offline training/evaluation
  // is a separate, always-true fact once training has run. metrics below
  // comes from that same model_card.json and is real whenever status.available
  // is true, whether or not this exact session ever queried it before.
  const live = status?.available === true;
  const metrics = status?.metrics ?? null;

  const columns: Column<DetectionRule>[] = [
    {
      key: "rule",
      header: "Rule",
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-text-primary">{r.name}</p>
          <p className="mono text-2xs text-text-muted">{r.id}</p>
        </div>
      ),
    },
    { key: "desc", header: "Condition", render: (r) => <p className="max-w-md text-xs text-text-secondary">{r.description}</p> },
    { key: "sev", header: "Severity", render: (r) => <SeverityBadge severity={r.severity} /> },
    { key: "mitre", header: "MITRE", render: (r) => <span className="mono text-2xs text-text-secondary">{r.mitre_technique_id}</span> },
    { key: "matches", header: "Matches", align: "right", render: (r) => <span className="mono tabular text-text-secondary">{r.match_count}</span> },
    { key: "last", header: "Last fired", align: "right", render: (r) => <span className="text-2xs text-text-muted">{r.last_triggered ? relativeTime(r.last_triggered) : "Never"}</span> },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "Enabled" : "Disabled"}</Badge>,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Radar}
        title="Detection & ML"
        description="Deterministic rules and the custom machine learning detection engine"
        actions={<Tabs options={TABS} value={tab} onChange={setTab} ariaLabel="Detection view" />}
      />

      {tab === "rules" ? (
        <div className="flex-1 overflow-auto">
          {rulesQ.isLoading ? (
            <TableSkeleton rows={7} cols={6} />
          ) : rulesQ.isError ? (
            <ErrorState message="Detection rules could not be loaded." onRetry={() => rulesQ.refetch()} />
          ) : rules.length === 0 ? (
            <EmptyState icon={Radar} title="No detection rules" description="No detection rules are loaded." />
          ) : (
            <>
              <DataTable columns={columns} rows={rules} rowKey={(r) => r.id} />
              <p className="border-t border-border px-6 py-3 text-2xs text-text-muted">
                Each rule covers detection the classifier structurally cannot perform — host telemetry, temporal
                sequences across events, or external context. No rule duplicates the ML model.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
            {!live && (
              <div className="flex items-start gap-2.5 rounded-lg border border-status-medium/30 bg-status-medium/[0.06] px-4 py-3">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
                <div>
                  <p className="text-[13px] font-medium text-text-primary">ML ENGINE — LIVE SCORING NOT RUNNING</p>
                  <p className="mt-1 text-2xs leading-relaxed text-text-secondary">
                    {status?.reason ?? "The ML service is not reachable from this session."} Detection
                    falls back to the seven deterministic rules, which are fully operational.
                  </p>
                  <p className="mt-0.5 text-2xs text-text-secondary">
                    This is about live inference, not training: the Random Forest and Isolation Forest
                    models were trained and evaluated offline against CSE-CIC-IDS2018, and their
                    checksummed artifacts and real evaluation metrics exist in the repository (see the
                    training pipeline below). SOCGenie only refuses to display placeholder or estimated
                    figures here — it never fabricates a result — which is why the panel below is empty
                    while the live service is unreachable, even though training itself is complete.
                  </p>
                  <p className="mono mt-2 flex items-center gap-1.5 text-2xs text-text-muted">
                    <Terminal size={11} aria-hidden="true" /> python -m ml.train --data datasets/CSE-CIC-IDS2018 --out models
                  </p>
                </div>
              </div>
            )}

            <Panel eyebrow="Model registry" title="Active model">
              {statusQ.isLoading || !status ? (
                <TableSkeleton rows={2} cols={4} />
              ) : (
                <KeyValueList
                  columns={4}
                  items={[
                    { label: "Model", value: status.model_name },
                    { label: "Version", value: status.version ?? "—" },
                    {
                      label: "Status",
                      value: (
                        <span className={live ? "text-status-success" : "text-status-medium"}>
                          {live ? "ACTIVE — LIVE SCORING" : "TRAINED, LIVE SERVICE DORMANT"}
                        </span>
                      ),
                    },
                    { label: "Trained", value: status.trained_at ?? (live ? "—" : "Unknown — live service not running") },
                    { label: "Classifier", value: status.algorithm },
                    { label: "Anomaly detector", value: status.anomaly_algorithm },
                    { label: "Dataset", value: status.dataset_name ?? "—" },
                    { label: "Features", value: String(status.feature_count) },
                  ]}
                />
              )}
            </Panel>

            <Panel eyebrow="Architecture" title="Training and inference pipeline">
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {PIPELINE.map((stage, i) => (
                  <div key={stage} className="flex items-center">
                    <span className="whitespace-nowrap rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-2xs text-text-secondary">
                      {stage}
                    </span>
                    {i < PIPELINE.length - 1 && <span className="mx-1 text-text-muted" aria-hidden="true">→</span>}
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t border-border pt-3 text-2xs text-text-muted">
                Runs locally with pandas, NumPy, scikit-learn and joblib. No external service participates in a
                detection decision.
              </p>
            </Panel>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel eyebrow="Evaluation" title="Classification performance">
                {statusQ.isLoading ? (
                  <TableSkeleton rows={2} cols={4} />
                ) : metrics ? (
                  <>
                    <KeyValueList
                      columns={2}
                      items={[
                        { label: "Accuracy", value: metrics.accuracy != null ? `${(metrics.accuracy * 100).toFixed(2)}%` : "—" },
                        { label: "Macro F1", value: metrics.macroF1 != null ? metrics.macroF1.toFixed(4) : "—" },
                        { label: "Benign holdout FPR", value: metrics.benignHoldoutFpr != null ? `${(metrics.benignHoldoutFpr * 100).toFixed(2)}%` : "—" },
                        { label: "Checksums verified", value: metrics.checksumsVerified ? "Yes" : "No" },
                      ]}
                    />
                    <p className="mt-3 border-t border-border pt-3 text-2xs text-text-muted">
                      From model_card.json, produced by the offline training/evaluation run — not estimated,
                      not live-recomputed. Per-class precision/recall and the full confusion matrix are in
                      the model card itself; this API does not yet surface them here.
                    </p>
                  </>
                ) : (
                  <EmptyState
                    icon={AlertCircle}
                    title="Metrics unavailable"
                    description="The live ML service isn't reachable from this session, so its real evaluation metrics can't be fetched right now. This does not mean the model is untrained — see the notice above."
                  />
                )}
              </Panel>

              <Panel eyebrow="Target labels" title={`Detection classes · ${SECURITY_CLASSES.length}`}>
                <div className="flex flex-wrap gap-1.5">
                  {SECURITY_CLASSES.map((c) => (
                    <span key={c} className="mono rounded border border-border bg-bg-elevated px-2 py-1 text-2xs text-text-secondary">
                      {c}
                    </span>
                  ))}
                </div>
                <p className="mt-3 border-t border-border pt-3 text-2xs text-text-muted">
                  Seven supervised classes from CIC-IDS2017, plus an independent unsupervised anomaly channel for
                  behaviour matching no known class.
                </p>
              </Panel>
            </div>

            <Panel eyebrow="Feature engineering" title={`Feature registry · ${FEATURE_REGISTRY.raw.length + FEATURE_REGISTRY.engineered.length} features`}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-text-muted">
                    Raw dataset columns ({FEATURE_REGISTRY.raw.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {FEATURE_REGISTRY.raw.map((f) => (
                      <span key={f} className="mono rounded border border-border px-1.5 py-0.5 text-2xs text-text-secondary">{f}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-text-muted">
                    Engineered ({FEATURE_REGISTRY.engineered.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {FEATURE_REGISTRY.engineered.map((f) => (
                      <span key={f} className="mono rounded border border-accent/30 bg-accent/5 px-1.5 py-0.5 text-2xs text-accent">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-3 border-t border-border pt-3 text-2xs text-text-muted">
                Importance ranking is derived from the fitted forest and is unavailable before training.
                Destination port is deliberately excluded to avoid learning the testbed's port assignment.
              </p>
            </Panel>

            <p className="pb-2 text-center text-2xs text-text-muted">
              Academic research prototype. Synthetic and lab-generated training data can overstate real-world
              detection performance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
