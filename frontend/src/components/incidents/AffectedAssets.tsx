import { Panel } from "../ui/Panel";
import { SeverityBadge } from "../ui/SeverityBadge";
import type { AffectedAsset } from "../../mocks/incidentStore";

const STATUS_TONE: Record<AffectedAsset["status"], string> = {
  "At Risk": "text-status-critical",
  Monitored: "text-status-medium",
  Contained: "text-status-success",
};

export function AffectedAssets({ assets }: { assets: AffectedAsset[] }) {
  return (
    <Panel eyebrow="Scope" title="Affected Assets" noPadding>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead className="bg-bg-secondary">
            <tr className="border-b border-border text-2xs uppercase tracking-wide text-text-muted">
              <th scope="col" className="px-4 py-2.5 font-semibold">Host</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">IP</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">User</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">OS</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Risk</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.host} className="border-b border-border/60 text-[13px] hover:bg-bg-elevated/50">
                <td className="px-4 py-2.5 font-medium text-text-primary">{a.host}</td>
                <td className="mono px-3 py-2.5 text-2xs text-text-secondary">{a.ip}</td>
                <td className="px-3 py-2.5 text-xs text-text-secondary">{a.user ?? "—"}</td>
                <td className="px-3 py-2.5 text-xs text-text-secondary">{a.os}</td>
                <td className="px-3 py-2.5"><SeverityBadge severity={a.risk} /></td>
                <td className={`px-4 py-2.5 text-2xs font-medium ${STATUS_TONE[a.status]}`}>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
