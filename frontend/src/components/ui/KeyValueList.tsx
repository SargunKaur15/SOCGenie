export function KeyValueList({
  items,
  columns = 2,
  mono = false,
}: {
  items: { label: string; value: React.ReactNode }[];
  columns?: 1 | 2 | 3 | 4;
  mono?: boolean;
}) {
  const grid = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-2 md:grid-cols-3", 4: "grid-cols-2 md:grid-cols-4" }[columns];
  return (
    <dl className={`grid ${grid} gap-x-6 gap-y-3`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-2xs uppercase tracking-wide text-text-muted">{item.label}</dt>
          <dd className={`mt-0.5 truncate text-xs text-text-primary ${mono ? "mono" : ""}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
