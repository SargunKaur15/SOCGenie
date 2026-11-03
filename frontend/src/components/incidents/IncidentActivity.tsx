import { ActivityLog } from "../shared/ActivityLog";
import type { IncidentActivityEntry } from "../../mocks/incidentStore";

export function IncidentActivity({ entries }: { entries: IncidentActivityEntry[] }) {
  return (
    <ActivityLog
      title="Incident Activity"
      entries={entries}
      emptyMessage="No analyst actions recorded yet in this session."
    />
  );
}
