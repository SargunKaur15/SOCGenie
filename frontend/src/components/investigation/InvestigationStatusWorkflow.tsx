import { WorkflowStepper } from "../shared/WorkflowStepper";
import {
  INVESTIGATION_STATUS_LABEL,
  INVESTIGATION_STATUS_ORDER,
  type InvestigationStatus,
} from "../../mocks/investigationStore";

const STAGES = INVESTIGATION_STATUS_ORDER.map((s) => ({ key: s, label: INVESTIGATION_STATUS_LABEL[s] }));

export function InvestigationStatusWorkflow({
  status,
  onChange,
}: {
  status: InvestigationStatus;
  onChange: (s: InvestigationStatus) => void;
}) {
  return (
    <WorkflowStepper
      eyebrow="Lifecycle"
      title="Investigation Status"
      stages={STAGES}
      currentIndex={INVESTIGATION_STATUS_ORDER.indexOf(status)}
      statusOrder={INVESTIGATION_STATUS_ORDER}
      statusLabel={INVESTIGATION_STATUS_LABEL}
      onChange={onChange}
    />
  );
}
