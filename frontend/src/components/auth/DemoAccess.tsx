import { Check, UserRound } from "lucide-react";

const ROLES = [
  { key: "analyst" as const, title: "SOC Analyst" },
  { key: "admin" as const, title: "SOC Admin" },
];

/** Optional demo access. Click-to-fill behaviour is preserved from Phase 1. */
export function DemoAccess({
  onSelect,
  selected,
}: {
  onSelect: (role: "analyst" | "admin") => void;
  selected: "analyst" | "admin" | null;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">Demo access</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ROLES.map((role) => (
          <button
            key={role.key}
            type="button"
            aria-pressed={selected === role.key}
            onClick={() => onSelect(role.key)}
            className={`group relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 hover:-translate-y-0.5 ${
              selected === role.key
                ? "border-accent/60 bg-accent/[0.07]"
                : "border-border bg-bg-elevated hover:border-accent/50 hover:bg-accent/[0.04]"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-bg-surface transition-colors ${
                selected === role.key ? "border-accent/50 text-accent" : "border-border text-text-muted group-hover:text-accent"
              }`}
            >
              {selected === role.key ? (
                <Check size={13} strokeWidth={2.6} aria-hidden="true" />
              ) : (
                <UserRound size={13} strokeWidth={1.8} aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-text-primary">{role.title}</span>
              <span
                className={`mono block truncate text-2xs transition-colors ${
                  selected === role.key ? "text-accent" : "text-text-secondary group-hover:text-accent"
                }`}
              >
                {role.key}@socgenie.demo
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
