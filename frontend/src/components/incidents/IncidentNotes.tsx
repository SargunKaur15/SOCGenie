import { useState } from "react";
import { MessageSquarePlus, Pencil, Check, X } from "lucide-react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
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
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    onAdd(body);
    setDraft("");
  };

  const field =
    "w-full resize-y rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-accent";

  return (
    <Panel eyebrow="Audit trail" title="Incident Notes">
      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-2xs text-text-muted">
          No notes recorded for this incident.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-bg-elevated px-3 py-2">
              {editingId === n.id ? (
                <>
                  <textarea rows={3} value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className={field} />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" icon={X} onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button
                      icon={Check}
                      disabled={!editDraft.trim()}
                      onClick={() => {
                        if (editDraft.trim()) onEdit(n.id, editDraft.trim());
                        setEditingId(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-2xs leading-relaxed text-text-primary">{n.body}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-2xs text-text-muted">{n.author} · {n.createdAt}</span>
                    <button
                      onClick={() => { setEditingId(n.id); setEditDraft(n.body); }}
                      aria-label="Edit note"
                      className="flex items-center gap-1 text-2xs text-text-muted transition-colors hover:text-accent"
                    >
                      <Pencil size={11} aria-hidden="true" /> Edit
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3">
        <label htmlFor="inc-note" className="sr-only">Add an incident note</label>
        <textarea
          id="inc-note"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Record what you observed and what you did…"
          className={field}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-2xs text-text-muted">Demo notes saved as {analyst} — no backend persistence.</span>
          <Button type="submit" icon={MessageSquarePlus} disabled={!draft.trim()}>Add note</Button>
        </div>
      </form>
    </Panel>
  );
}
