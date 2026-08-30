/* ---------------------------------------------------------------------------
   Redaction — applied BEFORE anything leaves this process.

   Ordering matters: redaction runs on the fully assembled prompt, after RAG
   context construction and immediately before the provider call. Redacting
   earlier would let a later assembly step reintroduce a raw value.

   Deliberately conservative in scope. Security evidence is the entire point of
   the product, so hostnames, IPs, usernames and process names are NOT
   redacted — removing them would leave the model nothing to reason about. Only
   credential material is removed.
--------------------------------------------------------------------------- */

export const REDACTED = "[REDACTED]";

interface Rule {
  name: string;
  pattern: RegExp;
  /** Replacement preserving the label so the model still knows a field existed. */
  replace: (match: string, ...groups: string[]) => string;
}

const RULES: Rule[] = [
  {
    name: "anthropic-key",
    pattern: /sk-ant-[A-Za-z0-9_-]{16,}/g,
    replace: () => REDACTED,
  },
  {
    name: "openai-key",
    pattern: /sk-[A-Za-z0-9]{32,}/g,
    replace: () => REDACTED,
  },
  {
    name: "aws-access-key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    replace: () => REDACTED,
  },
  {
    name: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
    replace: () => REDACTED,
  },
  {
    name: "bearer-token",
    pattern: /\b(Bearer|Token)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
    replace: (_m, scheme) => `${scheme} ${REDACTED}`,
  },
  {
    name: "authorization-header",
    pattern: /\b(Authorization|Proxy-Authorization)\s*[:=]\s*\S+/gi,
    replace: (_m, header) => `${header}: ${REDACTED}`,
  },
  {
    name: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: () => REDACTED,
  },
  {
    name: "private-key-block",
    pattern: /-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+)?PRIVATE KEY-----/g,
    replace: () => REDACTED,
  },
  {
    name: "labelled-secret",
    // password=..., api_key: ..., client_secret "...", session_token=...
    pattern:
      /\b(password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|session[_-]?token|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*["']?([^\s"',;}]{3,})["']?/gi,
    replace: (_m, label) => `${label}=${REDACTED}`,
  },
  {
    name: "connection-string-credentials",
    pattern: /\b([a-z][a-z0-9+.-]*):\/\/([^:/\s]+):([^@/\s]+)@/gi,
    replace: (_m, scheme, user) => `${scheme}://${user}:${REDACTED}@`,
  },
];

export interface RedactionResult {
  text: string;
  /** Which rules fired. Logged server-side; never returned to the browser. */
  applied: string[];
  count: number;
}

export function redact(input: string): RedactionResult {
  let text = input;
  const applied: string[] = [];
  let count = 0;

  for (const rule of RULES) {
    // Fresh lastIndex each pass — the patterns are global.
    rule.pattern.lastIndex = 0;
    const matches = text.match(rule.pattern);
    if (!matches || matches.length === 0) continue;
    applied.push(rule.name);
    count += matches.length;
    text = text.replace(rule.pattern, rule.replace as (...args: string[]) => string);
  }

  return { text, applied, count };
}

/** Names of every rule, for documentation and tests. */
export const REDACTION_RULES = RULES.map((r) => r.name);
