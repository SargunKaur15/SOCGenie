import { NotesPanel } from "../shared/NotesPanel";
import type { IncidentNote } from "../../mocks/incidentStore";

export function IncidentNotes({
  notes,
  analyst,
  onAdd,
  onEdit,
}: {
  notes: IncidentNote[];
  analyst: string;
  onAdd: (body: string) => void;
  onEdit: (id: string, body: string) => void;
}) {
  return (
    <NotesPanel
      title="Incident Notes"
      formId="inc-note"
      notes={notes}
      emptyMessage="No notes recorded for this incident."
      persistenceNote={`Demo notes saved as ${analyst} — no backend persistence.`}
      onAdd={onAdd}
      onEdit={onEdit}
    />
  );
}
