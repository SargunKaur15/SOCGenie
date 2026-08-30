/**
 * Renders untrusted log content safely.
 * Log lines are attacker-controlled by definition, so this component is the ONLY
 * approved way to display them. React escapes by default; we additionally strip
 * ANSI escapes and C0/C1 control characters, and truncate very long lines.
 * `dangerouslySetInnerHTML` is banned repo-wide (Blueprint §10).
 */
const MAX_LINE_LENGTH = 2000;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const ANSI_ESCAPES = /\u001B\[[0-9;]*[A-Za-z]/g;

export function sanitizeLogLine(line: string): string {
  const cleaned = line.replace(ANSI_ESCAPES, "").replace(CONTROL_CHARS, "");
  return cleaned.length > MAX_LINE_LENGTH ? `${cleaned.slice(0, MAX_LINE_LENGTH)}… [truncated]` : cleaned;
}

export function CodeBlock({ lines, showLineNumbers = true }: { lines: string[]; showLineNumbers?: boolean }) {
  return (
    <pre className="mono overflow-x-auto rounded-md border border-border bg-bg-elevated p-3 text-2xs leading-relaxed text-text-secondary">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-3">
          {showLineNumbers && (
            <span className="select-none tabular text-text-muted">{String(i + 1).padStart(3, "0")}</span>
          )}
          <code className="whitespace-pre-wrap break-all">{sanitizeLogLine(line)}</code>
        </div>
      ))}
    </pre>
  );
}
