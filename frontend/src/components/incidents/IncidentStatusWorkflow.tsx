import { WorkflowStepper } from "../shared/WorkflowStepper";
import { INCIDENT_STATUS_LABEL, INCIDENT_STATUS_ORDER, type IncidentWorkflowStatus } from "../../mocks/incidentStore";

/** Detection → Investigation → Containment → Resolution, derived from the
 *  incident's current workflow status so the two can never disagree. */
const STAGES = [
  { key: "new" as const, label: "Detection" },
  { key: "investigating" as const, label: "Investigation" },
  { key: "contained" as const, label: "Containment" },
  { key: "resolved" as const, label: "Resolution" },
];

export function IncidentStatusWorkflow({
  status,
  onChange,
}: {
  status: IncidentWorkflowStatus;
  onChange: (s: IncidentWorkflowStatus) => void;
}) {
  return (
    <WorkflowStepper
      eyebrow="Response lifecycle"
      title="Incident Status"
      stages={STAGES}
      currentIndex={INCIDENT_STATUS_ORDER.indexOf(status)}
      statusOrder={INCIDENT_STATUS_ORDER}
      statusLabel={INCIDENT_STATUS_LABEL}
      onChange={onChange}
    />
  );
}
