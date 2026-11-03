import { ActivityLog } from "../shared/ActivityLog";
import type { ActivityEntry } from "../../mocks/investigation";

export function InvestigationActivity({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ActivityLog
      title="Investigation Activity"
      entries={entries}
      emptyMessage="No analyst actions recorded yet for this investigation."
    />
  );
}
