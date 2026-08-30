import { useMemo, useState } from "react";
import { Copy, Check, Search } from "lucide-react";
import { Panel } from "../ui/Panel";
import { Input } from "../ui/Input";
import { EVIDENCE_TABS, type EvidenceTab } from "../../mocks/investigation";
import type { SocAlert } from "../../mocks/alertStore";

/** Evidence is grouped per tab. Items not applicable to an alert simply do not
 *  appear — we never invent a value to fill a section. */
function evidenceFor(alert: SocAlert, tab: EvidenceTab): { label: string; value: string }[] {
  const own = alert.evidence;
  const pick = (...keys: string[]) => own.filter((e) => keys.some((k) => e.label.toLowerCase().includes(k)));

  switch (tab) {
    case "process":
      return [
        ...pick("process", "integrity", "task", "key"),
        { label: "Host", value: alert.host },
        { label: "User", value: alert.user ?? "—" },
      ];
    case "network":
      return [
        ...pick("connection", "destination", "bytes", "duration", "port"),
        { label: "Source IP", value: alert.sourceIp },
        { label: "Destination IP", value: alert.destinationIp ?? "—" },
      ];
    case "authentication":
      return [
        ...pick("attempt", "account", "reputation", "window", "logon"),
        { label: "User", value: alert.user ?? "—" },
      ];
    case "files":
      return pick("attachment", "macro", "hash", "file", "disposition");
    case "commands":
      return pick("command", "action", "value", "trigger");
    default:
      return [];
  }
}

export function EvidencePanel({ alert }: { alert: SocAlert }) {
  const [tab, setTab] = useState<EvidenceTab>("process");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = evidenceFor(alert, tab);
    if (!q) return all;
    const n = q.toLowerCase();
    return all.filter((r) => r.label.toLowerCase().includes(n) || r.value.toLowerCase().includes(n));
  }, [alert, tab, q]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
  };

  return (
    <Panel eyebrow="Simulated telemetry" title="Evidence" noPadding>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <div role="tablist" aria-label="Evidence category" className="flex flex-wrap gap-0.5 rounded-md border border-border bg-bg-elevated p-0.5">
          {EVIDENCE_TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded px-2.5 py-1 text-2xs font-medium transition-colors ${
                tab === t.key ? "bg-bg-surface text-text-primary" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto w-full sm:w-48">
          <Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter evidence…" aria-label="Filter evidence" />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-2xs text-text-muted">
          {q ? "No evidence matches this filter." : "No evidence of this type was captured for this alert."}
        </p>
      ) : (
        <dl>
          {rows.map((r, i) => (
            <div
              key={`${r.label}-${i}`}
              className={`group flex items-start justify-between gap-3 px-4 py-2 ${i % 2 === 0 ? "bg-bg-elevated/40" : ""}`}
            >
              <dt className="shrink-0 text-2xs text-text-muted">{r.label}</dt>
              <dd className="flex min-w-0 items-start gap-2">
                <span className="mono break-all text-right text-2xs text-text-primary">{r.value}</span>
                <button
                  onClick={() => copy(r.label, r.value)}
                  aria-label={`Copy ${r.label}`}
                  className="shrink-0 text-text-muted opacity-0 transition-opacity hover:text-accent focus:opacity-100 group-hover:opacity-100"
                >
                  {copied === r.label ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}
