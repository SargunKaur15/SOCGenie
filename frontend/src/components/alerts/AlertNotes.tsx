import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "../ui/Button";
import type { AlertNote } from "../../mocks/alertStore";

/** Analyst notes are the audit trail — and, later, the label source for
 *  supervised model improvement. Local state only in this phase. */
export function AlertNotes({
  notes,
  onAdd,
}: {
  notes: AlertNote[];
  onAdd: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    onAdd(body);
    setDraft("");
  };

  return (
    <section>
      <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
        Analyst notes {notes.length > 0 && <span className="text-text-secondary">({notes.length})</span>}
      </h3>

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-2xs text-text-muted">
          No notes recorded for this alert.
        </p>
      ) : (
        <ul className="mb-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-bg-elevated px-3 py-2">
              <p className="text-2xs leading-relaxed text-text-primary">{n.body}</p>
              <p className="mt-1.5 text-2xs text-text-muted">
                {n.author} · {n.createdAt}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3">
        <label htmlFor="note-draft" className="sr-only">Add a note</label>
        <textarea
          id="note-draft"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Record what you observed and what you did…"
          className="w-full resize-y rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-accent"
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" icon={MessageSquarePlus} disabled={!draft.trim()}>
            Add note
          </Button>
        </div>
      </form>
    </section>
  );
}
