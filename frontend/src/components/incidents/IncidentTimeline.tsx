import { EventTimeline } from "../shared/EventTimeline";
import type { IncidentTimelineEvent } from "../../mocks/incidentStore";

export function IncidentTimeline({ events }: { events: IncidentTimelineEvent[] }) {
  return (
    <EventTimeline
      eyebrow="Chronology"
      title="Incident Timeline"
      events={events}
      renderDetail={(e) => `Source ${e.source} · severity ${e.severity}`}
    />
  );
}
