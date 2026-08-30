import { ChevronRight } from "lucide-react";
import { Panel } from "../ui/Panel";
import { SeverityBadge } from "../ui/SeverityBadge";
import { STATUS_LABEL, type SocAlert } from "../../mocks/alertStore";

/** Clicking a row hands off to the existing Investigation Workspace — the same
 *  path the Alerts table uses. No duplicate alert detail view. */
export function RelatedAlerts({
  alerts,
  onOpenAlert,
}: {
  alerts: SocAlert[];
  onOpenAlert: (alert: SocAlert) => void;
}) {
  return (
    <Panel eyebrow="Correlated detections" title="Related Alerts" noPadding>
      {alerts.length === 0 ? (
        <p className="px-4 py-6 text-center text-2xs text-text-muted">
          No alerts are currently correlated into this incident.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="bg-bg-secondary">
              <tr className="border-b border-border text-2xs uppercase tracking-wide text-text-muted">
                <th scope="col" className="px-4 py-2.5 font-semibold">Severity</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Alert</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Source</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Host</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Time</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr
                  key={a.ref}
                  onClick={() => onOpenAlert(a)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenAlert(a);
                    }
                  }}
                  className="group cursor-pointer border-b border-border/60 text-[13px] transition-colors hover:bg-bg-elevated/60"
                >
                  <td className="px-4 py-2.5"><SeverityBadge severity={a.severity} /></td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-text-primary">{a.title}</p>
                    <p className="mono text-2xs text-text-muted">{a.ref}</p>
                  </td>
                  <td className="mono px-3 py-2.5 text-2xs text-text-secondary">{a.sourceIp}</td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary">{a.host}</td>
                  <td className="px-3 py-2.5 text-right text-2xs text-text-muted">{a.minutesAgo} min ago</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center justify-between gap-2 text-2xs text-text-secondary">
                      {STATUS_LABEL[a.status]}
                      <ChevronRight size={13} className="text-text-muted group-hover:text-accent" aria-hidden="true" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
