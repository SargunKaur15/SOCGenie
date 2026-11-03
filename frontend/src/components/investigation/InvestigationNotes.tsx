import { NotesPanel } from "../shared/NotesPanel";
import type { AlertNote } from "../../mocks/alertStore";

export function InvestigationNotes({
  notes,
  actor,
  onAdd,
  onEdit,
}: {
  notes: AlertNote[];
  actor: string;
  onAdd: (body: string) => void;
  onEdit: (id: string, body: string) => void;
}) {
  return (
    <NotesPanel
      title="Investigation Notes"
      formId="inv-note"
      notes={notes}
      emptyMessage="No notes recorded yet."
      persistenceNote={`Saved locally as ${actor} — no backend in this phase.`}
      onAdd={onAdd}
      onEdit={onEdit}
    />
  );
}
