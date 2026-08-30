import { AutomationPanel } from "./AutomationPanel";
import { Search, CheckCircle2, XCircle, ShieldAlert, ExternalLink } from "lucide-react";
import { Button } from "../ui/Button";
import type { SocAlert, TriageStatus } from "../../mocks/alertStore";

export function AlertActions({
  alert,
  onSetStatus,
  onEscalate,
  onOpenInvestigation,
}: {
  alert: SocAlert;
  onSetStatus: (status: TriageStatus) => void;
  onEscalate: () => void;
  onOpenInvestigation: () => void;
}) {
  return (
    <>
    <section>
      <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Triage actions</h3>
      <div className="flex flex-wrap gap-2">
        <Button
          icon={Search}
          onClick={() => onSetStatus("investigating")}
          disabled={alert.status === "investigating"}
        >
          Mark investigating
        </Button>
        <Button
          icon={CheckCircle2}
          onClick={() => onSetStatus("resolved")}
          disabled={alert.status === "resolved"}
        >
          Mark resolved
        </Button>
        <Button
          icon={XCircle}
          onClick={() => onSetStatus("false_positive")}
          disabled={alert.status === "false_positive"}
        >
          False positive
        </Button>
        <Button
          icon={ShieldAlert}
          onClick={onEscalate}
          disabled={Boolean(alert.escalatedTo)}
          title={alert.escalatedTo ? `Already escalated to ${alert.escalatedTo}` : undefined}
        >
          {alert.escalatedTo ? `Escalated · ${alert.escalatedTo}` : "Escalate to incident"}
        </Button>
        <Button variant="primary" icon={ExternalLink} onClick={onOpenInvestigation}>
          Open investigation
        </Button>
      </div>
    </section>
    {/* Phase 15 — advisory automation. Additive; the triage actions above are
        unchanged. */}
    <AutomationPanel alert={alert} />
    </>
  );
}
