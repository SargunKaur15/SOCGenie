import { EventTimeline } from "../shared/EventTimeline";
import type { TimelineEvent } from "../../mocks/investigation";

export function InvestigationTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <EventTimeline
      eyebrow="Chronology"
      title="Investigation Timeline"
      events={events}
      renderDetail={(e) => `Host ${e.host} · severity ${e.severity}`}
    />
  );
}
