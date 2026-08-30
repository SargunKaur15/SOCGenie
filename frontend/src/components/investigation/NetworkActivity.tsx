import { Panel } from "../ui/Panel";
import type { NetworkFlow } from "../../mocks/investigation";

const STATUS_TONE: Record<NetworkFlow["status"], string> = {
  Suspicious: "text-status-high",
  Observed: "text-text-secondary",
  Blocked: "text-status-success",
};

export function NetworkActivity({ flows }: { flows: NetworkFlow[] }) {
  return (
    <Panel eyebrow="Simulated telemetry" title="Network Activity" noPadding>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead className="bg-bg-secondary">
            <tr className="border-b border-border text-2xs uppercase tracking-wide text-text-muted">
              <th scope="col" className="px-4 py-2.5 font-semibold">Time</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Source</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Destination</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Port</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Protocol</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Bytes</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f) => (
              <tr key={f.id} className="border-b border-border/60 text-[13px] hover:bg-bg-elevated/50">
                <td className="mono px-4 py-2.5 text-2xs tabular text-text-muted">{f.time}</td>
                <td className="mono px-3 py-2.5 text-2xs text-text-secondary">{f.source}</td>
                <td className="mono px-3 py-2.5 text-2xs text-text-secondary">{f.destination}</td>
                <td className="mono px-3 py-2.5 text-right text-2xs tabular text-text-secondary">{f.port}</td>
                <td className="px-3 py-2.5 text-2xs text-text-secondary">{f.protocol}</td>
                <td className="mono px-3 py-2.5 text-right text-2xs tabular text-text-secondary">{f.bytes}</td>
                <td className={`px-4 py-2.5 text-2xs font-medium ${STATUS_TONE[f.status]}`}>{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
