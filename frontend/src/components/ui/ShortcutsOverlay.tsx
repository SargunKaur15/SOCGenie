import { Modal } from "./Modal";

const SHORTCUTS: [string, string][] = [
  ["G then C", "Go to Command Center"],
  ["G then A", "Go to Alerts"],
  ["G then I", "Go to Incidents"],
  ["G then L", "Go to Log Explorer"],
  ["G then D", "Go to Detection & ML"],
  ["T", "Toggle dark / light theme"],
  ["?", "Show this panel"],
  ["Esc", "Close overlay"],
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <ul className="flex flex-col gap-2">
        {SHORTCUTS.map(([key, label]) => (
          <li key={key} className="flex items-center justify-between gap-4">
            <span className="text-xs text-text-secondary">{label}</span>
            <kbd className="mono shrink-0 rounded border border-border bg-bg-elevated px-1.5 py-0.5 text-2xs text-text-primary">
              {key}
            </kbd>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border pt-3 text-2xs text-text-muted">
        Triage shortcuts (J / K / I / E / R) activate with the Investigation Workspace in Phase 6.
      </p>
    </Modal>
  );
}
