import { useEffect } from "react";
import { X } from "lucide-react";

/** Modals are used ONLY for confirmations and the shortcuts overlay.
 *  Investigations are full pages, never modals (Blueprint §9). */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-border bg-bg-surface p-5 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <X size={15} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
