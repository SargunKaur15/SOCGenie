export function Tabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex items-center gap-0.5 rounded-md border border-border bg-bg-elevated p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          role="tab"
          aria-selected={value === opt}
          onClick={() => onChange(opt)}
          className={`rounded px-2.5 py-1 text-2xs font-medium capitalize transition-colors ${
            value === opt ? "bg-bg-surface text-text-primary shadow-panel" : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
