import { useState } from "react";
import { ShieldAlert, FlaskConical } from "lucide-react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { authHeader, hasApiToken, apiRole } from "../../lib/auth/apiToken";

/**
 * DEVELOPMENT-ONLY authorization probe. Phase 11 verification aid.
 *
 * Sends a GET to /api/admin/config so server-side authorization can be
 * observed in a browser. It exists because the application has no production
 * caller for that endpoint — deliberately, since nothing in the UI needs it.
 *
 * SAFETY PROPERTIES, all deliberate:
 *   - The bearer token is NEVER read, displayed, logged, copied or persisted.
 *     `authHeader()` is spread directly into the request and never inspected.
 *   - Only the HTTP status and the server's own error code/message are shown.
 *   - It calls the real endpoint through the real guard. Nothing is bypassed,
 *     stubbed or weakened.
 *   - Rendered only under `import.meta.env.DEV`, so it cannot reach a
 *     production build.
 *
 * TO REMOVE AFTER VERIFICATION: delete this file and the three-line block in
 * pages/Settings.tsx that renders it. Nothing else references it.
 */

interface ProbeResult {
  withToken: boolean;
  status: number;
  code: string;
  message: string;
  verdict: string;
}

export function AuthzProbe() {
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState(false);

  const probe = async (withToken: boolean) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "GET",
        // Spread directly — the value is never bound to a variable here.
        headers: withToken ? { ...authHeader() } : {},
      });

      let code = "";
      let message = "";
      try {
        const body: unknown = await res.json();
        if (typeof body === "object" && body !== null) {
          const b = body as { code?: unknown; error?: unknown; provider?: unknown };
          code = typeof b.code === "string" ? b.code : res.ok ? "OK" : "";
          message =
            typeof b.error === "string"
              ? b.error
              : b.provider !== undefined
                ? "Admin configuration returned"
                : "";
        }
      } catch {
        message = "Response was not JSON";
      }

      const verdict =
        res.status === 200
          ? "ALLOWED — admin privileges confirmed server-side"
          : res.status === 403
            ? "FORBIDDEN — authenticated, insufficient privileges"
            : res.status === 401
              ? "UNAUTHORIZED — no valid token presented"
              : "Unexpected status";

      setResult({ withToken, status: res.status, code, message, verdict });
    } catch {
      setResult({
        withToken,
        status: 0,
        code: "NETWORK",
        message: "Backend proxy unreachable — is `npm run server` running?",
        verdict: "Inconclusive",
      });
    } finally {
      setBusy(false);
    }
  };

  const tone =
    result?.status === 200
      ? "border-status-success/40 bg-status-success/10 text-status-success"
      : result?.status === 403
        ? "border-status-high/40 bg-status-high/10 text-status-high"
        : result?.status === 401
          ? "border-status-medium/40 bg-status-medium/10 text-status-medium"
          : "border-border bg-bg-elevated text-text-secondary";

  return (
    <Panel
      eyebrow="Development only"
      title="DEV SECURITY TEST — server-side authorization"
      actions={
        <span className="flex items-center gap-1.5 rounded border border-status-medium/40 bg-status-medium/10 px-2 py-0.5 text-2xs font-semibold text-status-medium">
          <FlaskConical size={11} aria-hidden="true" /> REMOVE AFTER VERIFICATION
        </span>
      }
    >
      <p className="text-2xs leading-relaxed text-text-secondary">
        Calls <span className="mono">GET /api/admin/config</span> through the real
        authorization guard. The bearer token is never displayed, logged or stored — only the
        HTTP status and the server&apos;s own response code are shown.
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-2">
          <dt className="text-2xs text-text-muted">Token held</dt>
          <dd className="mono text-2xs text-text-primary">{hasApiToken() ? "yes" : "no"}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-2xs text-text-muted">Server-asserted role</dt>
          <dd className="mono text-2xs text-text-primary">{apiRole() ?? "none"}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button icon={ShieldAlert} onClick={() => probe(true)} disabled={busy}>
          Send with token
        </Button>
        <Button onClick={() => probe(false)} disabled={busy}>
          Send without token
        </Button>
      </div>

      {result && (
        <div className={`mt-3 rounded-lg border px-3 py-2.5 ${tone}`}>
          <p className="mono text-xs font-semibold">
            HTTP {result.status} {result.code && `· ${result.code}`}
          </p>
          <p className="mt-1 text-2xs text-text-secondary">{result.verdict}</p>
          {result.message && (
            <p className="mt-1 text-2xs text-text-muted">Server said: {result.message}</p>
          )}
          <p className="mt-1.5 text-2xs text-text-muted">
            Request sent {result.withToken ? "with" : "without"} an Authorization header.
          </p>
        </div>
      )}
    </Panel>
  );
}
