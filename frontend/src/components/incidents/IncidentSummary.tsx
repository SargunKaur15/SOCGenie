import { Panel } from "../ui/Panel";
import { KeyValueList } from "../ui/KeyValueList";
import { INCIDENT_STATUS_LABEL, type SocIncident } from "../../mocks/incidentStore";

export function IncidentSummary({ incident }: { incident: SocIncident }) {
  return (
    <Panel eyebrow="Summary" title={incident.title}>
      <KeyValueList
        columns={4}
        items={[
          { label: "Incident ID", value: incident.ref },
          { label: "Severity", value: incident.severity.toUpperCase() },
          { label: "Status", value: INCIDENT_STATUS_LABEL[incident.status] },
          { label: "Risk score", value: `${incident.riskScore} / 100` },
          { label: "Created", value: `${incident.minutesAgo} min ago` },
          { label: "Last updated", value: `${incident.updatedMinutesAgo} min ago` },
          { label: "Assigned analyst", value: incident.assignedTo ?? "Unassigned" },
          { label: "Affected host", value: incident.host },
          { label: "Source IP", value: incident.sourceIp },
          { label: "Affected user", value: incident.user ?? "—" },
          { label: "Correlated alerts", value: String(incident.alertRefs.length) },
          { label: "Containment", value: incident.isolationSimulated ? "Simulated isolation recorded" : "Not applied" },
        ]}
      />
    </Panel>
  );
}
