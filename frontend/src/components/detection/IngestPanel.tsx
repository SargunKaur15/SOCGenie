import { useRef, useState } from "react";
import { Upload, Play, AlertTriangle, Check, FileText, Info } from "lucide-react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { SeverityBadge } from "../ui/SeverityBadge";
import { runDetection, RULES, type DetectionOutput } from "../../lib/detection";
import { detectFlowCsv, parseFlowCsv, toMlPayload, type FlowParseResult } from "../../lib/detection/flowParser";
import { authHeader, hasApiToken } from "../../lib/auth/apiToken";
import { flowsToAlerts, MlLabelError, type FlowAlertResult } from "../../lib/detection/flowParser";
import { useAlerts } from "../../hooks/useAlerts";

/**
 * Log ingestion and rule execution.
 *
 * The engine runs in the browser for this phase. It is a pure module with no
 * React import, structured exactly like lib/rag, so the Node server can import
 * it unchanged when detection moves server-side — no rewrite required.
 */
/** Response shape from POST /api/ml/score, via the Node proxy. */
interface MlScoreState {
  available: boolean;
  reason?: string;
  modelVersion?: string;
  schemaVersion?: string;
  predictions?: { index: number; label: string; mlConfidence: number; anomalyScore: number; isBenign: boolean }[];
}

export function IngestPanel() {
  const { ingest } = useAlerts();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string>("");
  const [output, setOutput] = useState<DetectionOutput | null>(null);
  const [ingested, setIngested] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [completed, setCompleted] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowParseResult | null>(null);
  const [ml, setMl] = useState<MlScoreState | null>(null);
  const [flowAlerts, setFlowAlerts] = useState<FlowAlertResult | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    setOutput(null);
    setIngested(null);
    setCompleted(null);
    setFlow(null);
    setMl(null);
    setFlowAlerts(null);
    setText("");
    setFileName(null);

    if (file.size === 0) {
      setError(`"${file.name}" is empty — nothing to analyse.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds 5 MB. Use a smaller extract.");
      return;
    }

    setReading(true);
    try {
      const contents = await file.text();
      if (contents.trim() === "") {
        setError(`"${file.name}" contains no readable text.`);
        return;
      }
      setFileName(file.name);
      setText(contents);
    } catch {
      // A read can fail on a moved or permission-denied file. Silence here
      // would look identical to "the button does nothing".
      setError(`Could not read "${file.name}". Try selecting it again.`);
    } finally {
      setReading(false);
    }
  };

  /**
   * Scores parsed flows through the Node proxy.
   *
   * Only the 18 mapped features are sent — toMlPayload copies nothing else, so
   * addresses and ports cannot reach the model. Any failure resolves to an
   * unavailable state; a prediction is never fabricated.
   */
  const scoreFlows = async (parsed: FlowParseResult) => {
    if (parsed.flows.length === 0) {
      setMl({ available: false, reason: "No valid flows to score." });
      return;
    }
    // /api/ml/score is authenticated. Without this header Node answers 401 and
    // the panel reported a generic "ML service unavailable", hiding the real
    // cause. /api/ml/status is unauthenticated, which is why it worked.
    if (!hasApiToken()) {
      setMl({
        available: false,
        reason: "Not authenticated for ML scoring. Sign out and sign in again — the bearer token is held in memory only and is lost on reload.",
      });
      return;
    }

    try {
      const res = await fetch("/api/ml/score", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader() },
        body: JSON.stringify({ flows: toMlPayload(parsed.flows) }),
      });

      const data = (await res.json().catch(() => null)) as (MlScoreState & { error?: string; code?: string }) | null;

      if (data && data.available === true) {
        setMl(data);
        try {
          // Predictions become real alerts in the existing SocAlert contract.
          // An unrecognised label throws rather than being coerced.
          setFlowAlerts(
            flowsToAlerts(
              parsed.flows,
              data.predictions ?? [],
              data.modelVersion ?? "unknown",
              data.schemaVersion ?? "unknown"
            )
          );
        } catch (err) {
          setFlowAlerts(null);
          setError(
            err instanceof MlLabelError
              ? err.message
              : "Could not build alerts from the ML response."
          );
        }
        return;
      }

      // Report the ACTUAL cause. Collapsing every failure to one message is
      // what made this take three rounds to find.
      const byStatus: Record<number, string> = {
        401: "Authentication rejected by the server (401). The session token may have expired — sign in again.",
        403: "Authorisation refused (403).",
        413: "Payload too large (413) — reduce the number of flows.",
        415: "Content-Type rejected (415).",
        429: "Rate limited (429) — wait a minute and retry.",
        503: "The Python ML service is not reachable from the Node proxy (503).",
        504: "The Python ML service timed out (504).",
      };
      setMl({
        available: false,
        reason:
          data?.reason ??
          byStatus[res.status] ??
          `${data?.error ?? "ML scoring failed"} (HTTP ${res.status}${data?.code ? ` ${data.code}` : ""}).`,
      });
    } catch (err) {
      // Ingestion must never break because a model is offline.
      setMl({
        available: false,
        reason: `Could not reach the Node proxy: ${err instanceof Error ? err.message : "network error"}. Is \`npm run server\` running?`,
      });
    }
  };

  const analyse = () => {
    setCompleted(null);
    setFlow(null);
    setMl(null);
    setFlowAlerts(null);
    if (!text) {
      setError("Choose a log file first, then run detection.");
      return;
    }
    setBusy(true);
    setError(null);
    setIngested(null);
    try {
      // CICFlowMeter CSVs take a separate path. Host logs never reach the
      // model — their events carry none of the 22 features it was trained on,
      // and synthesising them would be fabrication.
      if (detectFlowCsv(text).isFlowCsv) {
        const parsed = parseFlowCsv(text);
        setFlow(parsed);
        setCompleted(
          `CICFlowMeter CSV detected — ${parsed.parsed} flow${parsed.parsed === 1 ? "" : "s"} parsed, ${parsed.skipped} rejected. Scoring with the ML model…`
        );
        void scoreFlows(parsed);
        setBusy(false);
        return;
      }

      const result = runDetection(text);
      setOutput(result);
      setCompleted(
        `Detection completed — ${result.alerts.length} alert${result.alerts.length === 1 ? "" : "s"} found from ${result.run.parse.parsed} parsed event${result.run.parse.parsed === 1 ? "" : "s"}.`
      );
      if (result.run.parse.parsed === 0) {
        setError(
          "No events could be parsed. Supported formats: CSV with a header row, JSON Lines, or key=value. Every row needs a recognisable timestamp."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detection failed.");
    } finally {
      setBusy(false);
    }
  };

  const push = () => {
    if (!output) return;
    setIngested(ingest(output.alerts));
  };

  /** Sends ML-derived flow alerts into the same store the rule path uses. */
  const pushFlowAlerts = () => {
    if (!flowAlerts) return;
    setIngested(ingest(flowAlerts.alerts));
  };

  const parse = output?.run.parse;

  return (
    <Panel eyebrow="Detection" title="Log ingestion and rule execution">
      <p className="text-2xs leading-relaxed text-text-secondary">
        Upload a log extract. The engine normalises each line, evaluates the seven detection rules
        and scores any match with the six-factor risk model. Alerts are produced only from evidence
        present in the file.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.log,.txt,.json,.jsonl"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            // Reset the value so choosing the SAME file again still fires
            // onChange. Without this a re-selection is a silent no-op.
            e.target.value = "";
            if (f) void onFile(f);
          }}
        />
        <Button icon={Upload} onClick={() => fileRef.current?.click()} disabled={reading}>
          {reading ? "Reading…" : "Choose log file"}
        </Button>
        <Button variant="primary" icon={Play} onClick={analyse} disabled={!text || busy || reading}>
          {busy ? "Analysing…" : "Run detection"}
        </Button>
        {!text && !reading && !error && (
          <span className="text-2xs text-text-muted">Choose a log file to enable detection.</span>
        )}
        {fileName && (
          <span className="mono inline-flex items-center gap-1.5 text-2xs text-text-muted">
            <FileText size={11} aria-hidden="true" /> {fileName}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-status-medium/30 bg-status-medium/[0.06] px-3 py-2.5 text-2xs leading-relaxed text-text-secondary">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
          {error}
        </p>
      )}

      {completed && !error && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-status-success/30 bg-status-success/[0.06] px-3 py-2.5 text-2xs leading-relaxed text-text-secondary">
          <Check size={13} className="mt-0.5 shrink-0 text-status-success" aria-hidden="true" />
          {completed}
        </p>
      )}

      {flow && (
        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Network flow ingestion
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {[
                ["Format", "CICFlowMeter CSV"],
                ["Rows", String(flow.totalRows)],
                ["Flows parsed", String(flow.parsed)],
                ["Rejected", String(flow.skipped)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-2xs text-text-muted">{k}</dt>
                  <dd className="mono text-2xs text-text-primary">{v}</dd>
                </div>
              ))}
            </dl>
            {flow.warnings.length > 0 && (
              <p className="mt-1.5 text-2xs text-text-muted">
                {flow.warnings.length} row(s) rejected — first: row {flow.warnings[0].row},{" "}
                {flow.warnings[0].reason}. Valid rows were still scored.
              </p>
            )}
          </div>

          {/* ML enrichment is visually separate from rule detection. */}
          <div className="rounded-lg border border-border bg-bg-elevated px-3 py-2.5">
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              ML prediction · anomaly detection
            </p>

            {ml === null && <p className="text-2xs text-text-muted">Scoring…</p>}

            {ml?.available === false && (
              <p className="flex items-start gap-2 text-2xs leading-relaxed text-text-secondary">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
                <span>
                  <span className="font-semibold text-text-primary">ML unavailable.</span> {ml.reason}{" "}
                  Flow parsing succeeded and rule-based detection is unaffected. No prediction was
                  fabricated.
                </span>
              </p>
            )}

            {flowAlerts && (
              <div className="mb-3 rounded-md border border-border bg-bg-surface px-2.5 py-2">
                <p className="text-2xs text-text-secondary">
                  <span className="font-semibold text-text-primary">
                    {flowAlerts.alerts.length} ML detection{flowAlerts.alerts.length === 1 ? "" : "s"}
                  </span>{" "}
                  from {ml?.predictions?.length ?? 0} scored flow(s).{" "}
                  {flowAlerts.benign} classified BENIGN (no alert raised).
                  {flowAlerts.duplicates > 0 && ` ${flowAlerts.duplicates} duplicate finding(s) suppressed.`}
                  {flowAlerts.unmatched > 0 && ` ${flowAlerts.unmatched} prediction(s) had no matching flow.`}
                </p>
                {flowAlerts.alerts.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button variant="primary" icon={Check} onClick={pushFlowAlerts} disabled={ingested !== null}>
                      {ingested === null
                        ? `Send ${flowAlerts.alerts.length} ML alert${flowAlerts.alerts.length === 1 ? "" : "s"} to the queue`
                        : "Sent"}
                    </Button>
                    {ingested !== null && (
                      <span className="text-2xs text-status-success">
                        {ingested} alert{ingested === 1 ? "" : "s"} added — open the Alerts screen.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {ml?.available === true && ml.predictions && (
              <>
                <p className="mono mb-2 text-2xs text-text-muted">
                  {ml.modelVersion} · schema {ml.schemaVersion}
                </p>
                <ul className="space-y-1">
                  {ml.predictions.slice(0, 20).map((p) => {
                    const src = flow.flows[p.index];
                    return (
                      <li key={p.index} className="flex flex-wrap items-center gap-2 rounded-md px-1.5 py-1 hover:bg-bg-surface">
                        <span className="mono shrink-0 text-2xs text-text-muted">row {src?.row ?? p.index + 1}</span>
                        <span className={`rounded border px-1.5 py-0.5 text-2xs font-semibold ${
                          p.isBenign
                            ? "border-status-success/40 bg-status-success/10 text-status-success"
                            : "border-status-high/40 bg-status-high/10 text-status-high"
                        }`}>
                          {p.label}
                        </span>
                        <span className="mono text-2xs text-text-secondary">
                          conf {(p.mlConfidence * 100).toFixed(1)}%
                        </span>
                        <span className="mono text-2xs text-text-secondary">
                          anomaly {p.anomalyScore.toFixed(3)}
                        </span>
                        {p.anomalyScore >= 0.8 && (
                          <span className="rounded border border-status-medium/40 bg-status-medium/10 px-1.5 py-0.5 text-2xs font-semibold text-status-medium">
                            ANOMALOUS
                          </span>
                        )}
                        {src?.label && (
                          <span className="text-2xs text-text-muted">csv label: {src.label}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-2xs leading-relaxed text-text-muted">
                  A BENIGN prediction contributes 0 to ML risk by design. PORT_SCAN is not an ML
                  class — it remains rule-only. Identifiers (addresses, ports, timestamps) are never
                  sent to the model.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {parse && (
        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Ingestion
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {[
                ["Format", parse.format],
                ["Lines", String(parse.totalLines)],
                ["Events parsed", String(parse.parsed)],
                ["Skipped", String(parse.skipped)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-2xs text-text-muted">{k}</dt>
                  <dd className="mono text-2xs text-text-primary">{v}</dd>
                </div>
              ))}
            </dl>
            {parse.warnings.length > 0 && (
              <div className="mt-2 rounded-md border border-border bg-bg-surface px-2.5 py-2">
                <p className="text-2xs text-text-muted">
                  {parse.warnings.length} line(s) skipped. First problem: line{" "}
                  {parse.warnings[0].line} — {parse.warnings[0].reason}.
                </p>
                {/* Quoting the source line turns "0 events parsed" from a dead
                    end into something the analyst can act on. */}
                <p className="mono mt-1 break-all text-2xs text-text-secondary">
                  {(text.split(/\r?\n/)[parse.warnings[0].line - 1] ?? "").slice(0, 160) || "(blank line)"}
                </p>
                {parse.parsed === 0 && (
                  <p className="mt-1.5 text-2xs text-text-muted">
                    Every row needs a timestamp field named one of:{" "}
                    <span className="mono">timestamp, time, date, datetime, @timestamp, eventtime, ts</span>{" "}
                    — with an ISO-8601 value such as{" "}
                    <span className="mono">2026-08-18T09:00:00Z</span>, or epoch seconds/milliseconds.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Rules evaluated
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RULES.map((r) => {
                const fired = output?.run.rulesFired.includes(r.id);
                return (
                  <span
                    key={r.id}
                    title={r.description}
                    className={`mono rounded border px-1.5 py-0.5 text-2xs ${
                      fired
                        ? "border-status-high/40 bg-status-high/10 text-status-high"
                        : "border-border bg-bg-elevated text-text-muted"
                    }`}
                  >
                    {r.id}
                    {fired ? " ✓" : ""}
                  </span>
                );
              })}
            </div>
          </div>

          {output && output.alerts.length > 0 && (
            <div>
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Detections · {output.alerts.length}
              </p>
              <ul className="space-y-1.5">
                {output.alerts.map((a) => {
                  const b = output.breakdowns[a.ref];
                  return (
                    <li key={a.ref} className="rounded-md border border-border bg-bg-elevated px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={a.severity} />
                        <span className="mono text-2xs text-text-muted">{a.ref}</span>
                        <span className="min-w-0 flex-1 text-2xs text-text-primary">{a.title}</span>
                        <span className="mono text-2xs tabular text-text-secondary">
                          risk {a.riskScore}/100
                        </span>
                      </div>
                      <p className="mono mt-1 text-2xs text-text-muted">
                        {a.host} · {a.sourceIp}
                        {a.techniqueId ? ` · ${a.techniqueId}` : ""}
                      </p>
                      {b && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-2xs text-text-muted hover:text-text-secondary">
                            Risk breakdown
                          </summary>
                          <p className="mono mt-1 text-2xs text-text-secondary">
                            ML {b.mlConfidence} + anomaly {b.anomaly} + rule {b.ruleSeverity} + correlation{" "}
                            {b.correlation} + asset {b.assetCriticality} + privileged {b.privilegedAccount} + intel{" "}
                            {b.threatIntel} = {b.total}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {b.notes.map((n) => (
                              <li key={n} className="text-2xs text-text-muted">• {n}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" icon={Check} onClick={push} disabled={ingested !== null}>
                  {ingested === null ? `Send ${output.alerts.length} alerts to the queue` : "Sent"}
                </Button>
                {ingested !== null && (
                  <span className="text-2xs text-status-success">
                    {ingested} alert{ingested === 1 ? "" : "s"} added — open the Alerts screen.
                  </span>
                )}
              </div>
            </div>
          )}

          {output && output.alerts.length === 0 && parse.parsed > 0 && (
            <p className="rounded-md border border-border bg-bg-elevated px-3 py-2.5 text-2xs leading-relaxed text-text-secondary">
              {parse.parsed} events parsed, no rule conditions met. That is a valid result — the file
              contains no activity matching R-001 to R-007.
            </p>
          )}

          {/* The ML gap is stated on the surface that would otherwise imply it. */}
          <p className="flex items-start gap-2 rounded-md border border-status-medium/25 bg-status-medium/[0.05] px-3 py-2 text-2xs leading-relaxed text-text-secondary">
            <Info size={12} className="mt-0.5 shrink-0 text-status-medium" aria-hidden="true" />
            <span className="font-semibold text-text-primary">ML ENGINE — NOT LOADED.</span> Detection
            is rule-based only. No model is trained, so the machine-learning factor contributes 0, the
            anomaly factor uses the rule-derived heuristic, and the attainable maximum score is 75 of
            100. Alerts are labelled <span className="mono">rule</span> rather than combined. Scores
            here are identical to those produced before the ML layer existed.
          </p>
        </div>
      )}
    </Panel>
  );
}
