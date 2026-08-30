import { SEVERITY_CLASSES, SEVERITY_LABEL } from "../../lib/constants";
import type { Severity } from "../../lib/types";

/** Colour is never the sole signal — the text label is always rendered. */
export function SeverityBadge({ severity, className = "" }: { severity: Severity; className?: string }) {
  const s = SEVERITY_CLASSES[severity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border ${s.border} ${s.bg} px-1.5 py-0.5 text-2xs font-semibold tracking-wide ${s.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
