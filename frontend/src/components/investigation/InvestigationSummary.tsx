import { Panel } from "../ui/Panel";
import { KeyValueList } from "../ui/KeyValueList";
import { STATUS_LABEL, SOURCE_LABEL, type SocAlert } from "../../mocks/alertStore";
import { mitreTechniques } from "../../lib/data/fixtures";

export function InvestigationSummary({ alert }: { alert: SocAlert }) {
  const technique = alert.techniqueId
    ? mitreTechniques.find((t) => t.technique_id === alert.techniqueId)
    : undefined;

  return (
    <Panel eyebrow="Summary" title={alert.title}>
      <KeyValueList
        columns={4}
        items={[
          { label: "Alert ID", value: alert.ref },
          { label: "Severity", value: alert.severity.toUpperCase() },
          { label: "Risk score", value: `${alert.riskScore} / 100` },
          { label: "Status", value: STATUS_LABEL[alert.status] },
          { label: "Source", value: alert.sourceIp },
          { label: "Host", value: alert.host },
          { label: "User", value: alert.user ?? "—" },
          { label: "Detection", value: SOURCE_LABEL[alert.detectionSource] },
          {
            label: "MITRE technique",
            value: technique ? `${technique.technique_id} — ${technique.name}` : "No confident mapping",
          },
          { label: "Destination", value: alert.destinationIp ?? "—" },
          { label: "First seen", value: `${alert.minutesAgo} min ago` },
          { label: "Incident", value: alert.escalatedTo ?? "Not escalated" },
        ]}
      />
    </Panel>
  );
}
