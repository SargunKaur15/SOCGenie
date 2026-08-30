import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  width?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = "No rows to display.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <div className="px-6 py-12 text-center text-xs text-text-muted">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-bg-secondary">
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={`px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-text-muted first:pl-6 last:pr-6 ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={`border-b border-border/60 text-[13px] transition-colors ${
                onRowClick ? "cursor-pointer hover:bg-bg-elevated/60" : ""
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-3 first:pl-6 last:pr-6 ${col.align === "right" ? "text-right" : ""}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
