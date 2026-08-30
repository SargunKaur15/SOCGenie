import { useState } from "react";
import { ShieldCheck, Play, RotateCw, Loader2, Check, X, Info } from "lucide-react";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";

/**
 * DEVELOPMENT-ONLY Phase 11 security test runner.
 *
 * Executes the real authentication and authorization controls against the real
 * backend endpoints. Nothing is mocked, stubbed or bypassed — every assertion
 * is the genuine server response.
 *
 * CREDENTIAL HANDLING, all deliberate:
 *   - Tokens live in a local `let` inside the run function and are cleared in
 *     a `finally` block. They never enter React state, storage or the DOM.
 *   - Passwords are module constants matching the demo values already shown on
 *     the login page. They are never rendered and never logged.
 *   - No console output anywhere in this file.
 *   - Only status codes, server codes and safe messages are displayed.
 *
 * Rendered solely under `import.meta.env.DEV`, so it cannot reach production.
 *
 * TO REMOVE: delete this file and the guarded block in pages/Settings.tsx.
 */

const ADMIN_ENDPOINT = "/api/admin/config";
const CHAT_ENDPOINT = "/api/ai/chat";
const LOGIN_ENDPOINT = "/api/auth/login";

// These are the demo credentials already visible in the login UI. They are not
// secrets, and Phase 11 documents that explicitly.
const ANALYST = { email: "analyst@socgenie.demo", password: "socgenie-demo" };
const ADMIN = { email: "admin@socgenie.demo", password: "socgenie-admin" };

type Outcome = "pending" | "running" | "pass" | "fail" | "skipped" | "inconclusive";

/**
 * A 404 means the request never reached the Node server — almost always the
 * Vite /api proxy. It says nothing about the security control being tested, so
 * it must not be reported as either pass or fail.
 */
const UNREACHABLE_HINT =
  "404 — the request did not reach the backend. Check the /api proxy in vite.config.ts and that `npm run server` is running. This is a harness problem, not a security result.";

function classify(status: number, expected: (s: number) => boolean): Outcome {
  if (status === 404) return "inconclusive";
  return expected(status) ? "pass" : "fail";
}

interface TestResult {
  id: string;
  group: string;
  name: string;
  expectation: string;
  outcome: Outcome;
  status?: number;
  code?: string;
  detail?: string;
}

const INITIAL: Omit<TestResult, "outcome">[] = [
  { id: "T1", group: "Authentication", name: "No token → admin API", expectation: "401 UNAUTHORIZED" },
  { id: "T2a", group: "Authentication", name: "Analyst login", expectation: "200, token issued" },
  { id: "T3a", group: "Authentication", name: "Admin login", expectation: "200, token issued" },
  { id: "T2", group: "Authorization", name: "Analyst → admin API", expectation: "403 FORBIDDEN" },
  { id: "T3", group: "Authorization", name: "Admin → admin API", expectation: "200 OK" },
  { id: "T4", group: "Authorization", name: "Role tampering (body, header, query)", expectation: "still 403" },
  { id: "T5", group: "AI protection", name: "No token → chat API", expectation: "401 UNAUTHORIZED" },
  { id: "T6", group: "AI protection", name: "Analyst → chat API", expectation: "not 401/403" },
  { id: "T7a", group: "Origin protection", name: "Allowed origin accepted", expectation: "not 403" },
  { id: "T7b", group: "Origin protection", name: "Untrusted origin rejected", expectation: "403 (server-side only)" },
];

/** Reads a JSON error envelope without ever surfacing anything sensitive. */
async function readEnvelope(res: Response): Promise<{ code: string; message: string }> {
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null) {
      const b = body as { code?: unknown; error?: unknown };
      return {
        code: typeof b.code === "string" ? b.code : res.ok ? "OK" : "",
        message: typeof b.error === "string" ? b.error : res.ok ? "Request accepted" : "",
      };
    }
  } catch {
    /* non-JSON body — nothing safe to report beyond the status */
  }
  return { code: res.ok ? "OK" : "", message: "" };
}

export function SecurityTestRunner() {
  const [results, setResults] = useState<TestResult[]>(
    INITIAL.map((t) => ({ ...t, outcome: "pending" }))
  );
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const update = (id: string, patch: Partial<TestResult>) =>
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const runAll = async () => {
    setRunning(true);
    setHasRun(true);
    setResults(INITIAL.map((t) => ({ ...t, outcome: "pending" })));

    // Local only. Cleared in `finally`. Never enters state or storage.
    let analystToken: string | null = null;
    let adminToken: string | null = null;

    const login = async (creds: { email: string; password: string }) => {
      const res = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(creds),
      });
      if (!res.ok) return { ok: false as const, status: res.status };
      const body: unknown = await res.json();
      const token = (body as { token?: unknown }).token;
      return typeof token === "string"
        ? { ok: true as const, status: res.status, token }
        : { ok: false as const, status: res.status };
    };

    try {
      // ── T1: no token ──────────────────────────────────────────────────
      update("T1", { outcome: "running" });
      const r1 = await fetch(ADMIN_ENDPOINT, { method: "GET" });
      const e1 = await readEnvelope(r1);
      update("T1", {
        outcome: classify(r1.status, (s) => s === 401),
        status: r1.status,
        code: e1.code,
        detail:
          r1.status === 404
            ? UNREACHABLE_HINT
            : r1.status === 401
              ? "Rejected before any role check."
              : `Expected 401, received ${r1.status}.`,
      });

      // ── T2a / T3a: real logins ────────────────────────────────────────
      update("T2a", { outcome: "running" });
      const la = await login(ANALYST);
      analystToken = la.ok ? la.token : null;
      update("T2a", {
        outcome: la.ok ? "pass" : "fail",
        status: la.status,
        code: la.ok ? "OK" : "",
        detail: la.ok
          ? "Token issued (never displayed or stored)."
          : "Login failed — are DEMO_ANALYST_PASSWORD and AUTH_SECRET set in .env?",
      });

      update("T3a", { outcome: "running" });
      const ld = await login(ADMIN);
      adminToken = ld.ok ? ld.token : null;
      update("T3a", {
        outcome: ld.ok ? "pass" : "fail",
        status: ld.status,
        code: ld.ok ? "OK" : "",
        detail: ld.ok ? "Token issued (never displayed or stored)." : "Login failed — check DEMO_ADMIN_PASSWORD.",
      });

      // ── T2: analyst → admin endpoint ──────────────────────────────────
      update("T2", { outcome: "running" });
      if (!analystToken) {
        update("T2", { outcome: "skipped", detail: "Analyst login did not succeed." });
      } else {
        const r2 = await fetch(ADMIN_ENDPOINT, {
          method: "GET",
          headers: { authorization: `Bearer ${analystToken}` },
        });
        const e2 = await readEnvelope(r2);
        update("T2", {
          outcome: classify(r2.status, (s) => s === 403),
          status: r2.status,
          code: e2.code,
          detail:
            r2.status === 403
              ? "Authenticated but not authorised — the distinction Phase 11 added."
              : `Expected 403, received ${r2.status}.`,
        });
      }

      // ── T3: admin → admin endpoint ────────────────────────────────────
      update("T3", { outcome: "running" });
      if (!adminToken) {
        update("T3", { outcome: "skipped", detail: "Admin login did not succeed." });
      } else {
        const r3 = await fetch(ADMIN_ENDPOINT, {
          method: "GET",
          headers: { authorization: `Bearer ${adminToken}` },
        });
        const e3 = await readEnvelope(r3);
        update("T3", {
          outcome: classify(r3.status, (s) => s === 200),
          status: r3.status,
          code: e3.code,
          detail: r3.status === 200 ? "Admin privileges confirmed server-side." : `Expected 200, received ${r3.status}.`,
        });
      }

      // ── T4: role tampering with an UNMODIFIED analyst token ────────────
      update("T4", { outcome: "running" });
      if (!analystToken) {
        update("T4", { outcome: "skipped", detail: "Analyst login did not succeed." });
      } else {
        // Token untouched. Escalation attempted only via channels the client
        // controls: a custom header and a query parameter. No forgery.
        const r4 = await fetch(`${ADMIN_ENDPOINT}?role=admin&admin=true`, {
          method: "GET",
          headers: {
            authorization: `Bearer ${analystToken}`,
            role: "admin",
            "x-role": "admin",
            "x-socgenie-role": "admin",
          },
        });
        const e4 = await readEnvelope(r4);
        update("T4", {
          outcome: classify(r4.status, (s) => s === 403),
          status: r4.status,
          code: e4.code,
          detail:
            r4.status === 403
              ? "Role read from the signed token; headers and query ignored."
              : `Expected 403, received ${r4.status} — escalation may be possible.`,
        });
      }

      // ── T5: chat without a token ──────────────────────────────────────
      update("T5", { outcome: "running" });
      const r5 = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "security test" }),
      });
      const e5 = await readEnvelope(r5);
      update("T5", {
        outcome: classify(r5.status, (s) => s === 401),
        status: r5.status,
        code: e5.code,
        detail:
          r5.status === 404
            ? UNREACHABLE_HINT
            : r5.status === 401
              ? "AI endpoint requires authentication."
              : `Expected 401, received ${r5.status}.`,
      });

      // ── T6: analyst may use chat ──────────────────────────────────────
      update("T6", { outcome: "running" });
      if (!analystToken) {
        update("T6", { outcome: "skipped", detail: "Analyst login did not succeed." });
      } else {
        const r6 = await fetch(CHAT_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${analystToken}` },
          body: JSON.stringify({ message: "security test — no analysis required" }),
        });
        const e6 = await readEnvelope(r6);
        // 404 excluded explicitly: it would otherwise satisfy "not 401/403" and
        // report a spurious pass.
        const authOk = r6.status !== 401 && r6.status !== 403 && r6.status !== 404;
        update("T6", {
          outcome: r6.status === 404 ? "inconclusive" : authOk ? "pass" : "fail",
          status: r6.status,
          code: e6.code,
          // A provider failure is NOT an auth failure; the test says so.
          detail: authOk
            ? r6.status === 200
              ? "Authorised and the provider answered."
              : `Authorised. ${r6.status === 503 || r6.status === 504 ? "Provider unavailable — unrelated to auth." : r6.status === 429 ? "Rate limited — unrelated to auth." : "Reached the pipeline."}`
            : `Rejected at authentication/authorisation with ${r6.status}.`,
        });
      }

      // ── T7a: allowed origin ───────────────────────────────────────────
      update("T7a", { outcome: "running" });
      const r7 = await fetch("/api/health", { method: "GET" });
      update("T7a", {
        outcome: classify(r7.status, (s) => s !== 403),
        status: r7.status,
        code: r7.ok ? "OK" : "",
        detail:
          r7.status !== 403
            ? "Request from the dev origin was not blocked by the origin policy."
            : "Origin policy rejected the configured dev origin.",
      });

      // ── T7b: cannot be automated in a browser ─────────────────────────
      update("T7b", {
        outcome: "skipped",
        detail:
          "Origin is a forbidden header name — a browser sets it and scripts cannot override it. Verify with the curl command below.",
      });
    } finally {
      // Explicitly drop the credentials.
      analystToken = null;
      adminToken = null;
      setRunning(false);
    }
  };

  // Inconclusive runs are deliberately excluded: counting them would let an
  // unreachable backend inflate the denominator and look like coverage.
  const executed = results.filter((r) => r.outcome === "pass" || r.outcome === "fail");
  const passed = results.filter((r) => r.outcome === "pass").length;
  const failed = results.filter((r) => r.outcome === "fail").length;
  const skipped = results.filter((r) => r.outcome === "skipped").length;
  const inconclusive = results.filter((r) => r.outcome === "inconclusive").length;
  const groups = [...new Set(INITIAL.map((t) => t.group))];

  const icon = (o: Outcome) =>
    o === "running" ? (
      <Loader2 size={12} className="animate-spin text-accent" aria-hidden="true" />
    ) : o === "pass" ? (
      <Check size={12} className="text-status-success" aria-hidden="true" />
    ) : o === "fail" ? (
      <X size={12} className="text-status-critical" aria-hidden="true" />
    ) : o === "skipped" || o === "inconclusive" ? (
      <Info size={12} className="text-status-medium" aria-hidden="true" />
    ) : (
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-muted/50" aria-hidden="true" />
    );

  return (
    <Panel
      eyebrow="Development only"
      title="PHASE 11 SECURITY TEST RUNNER"
      actions={
        <span className="rounded border border-status-medium/40 bg-status-medium/10 px-2 py-0.5 text-2xs font-semibold text-status-medium">
          REMOVE AFTER VERIFICATION
        </span>
      }
    >
      <p className="text-2xs leading-relaxed text-text-secondary">
        Runs the real authentication and authorization controls against the real backend. Nothing
        is mocked. Tokens exist only inside the test function and are never displayed, logged or
        stored.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" icon={hasRun ? RotateCw : Play} onClick={runAll} disabled={running}>
          {running ? "Running…" : hasRun ? "Run again" : "Run all tests"}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">{group}</p>
            <ul className="space-y-1">
              {results
                .filter((r) => r.group === group)
                .map((r) => (
                  <li key={r.id} className="rounded-md border border-border bg-bg-elevated px-2.5 py-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="mt-0.5 shrink-0">{icon(r.outcome)}</span>
                      <span className="mono shrink-0 text-2xs text-text-muted">{r.id}</span>
                      <span className="min-w-0 flex-1 text-2xs text-text-primary">{r.name}</span>
                      {r.status !== undefined && (
                        <span className="mono shrink-0 text-2xs text-text-secondary">
                          {r.status}
                          {r.code ? ` ${r.code}` : ""}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 pl-6 text-2xs text-text-muted">
                      expected {r.expectation}
                      {r.detail ? ` · ${r.detail}` : ""}
                    </p>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      {hasRun && !running && (
        <div
          className={`mt-4 rounded-lg border px-3 py-2.5 ${
            failed > 0
              ? "border-status-critical/40 bg-status-critical/10"
              : inconclusive > 0
                ? "border-status-medium/40 bg-status-medium/10"
                : "border-status-success/40 bg-status-success/10"
          }`}
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <ShieldCheck
              size={14}
              className={
                failed > 0
                  ? "text-status-critical"
                  : inconclusive > 0
                    ? "text-status-medium"
                    : "text-status-success"
              }
              aria-hidden="true"
            />
            SECURITY STATUS:{" "}
            {failed > 0 ? "FAIL" : inconclusive > 0 ? "INCONCLUSIVE" : "PASS"}
          </p>
          <p className="mono mt-1 text-2xs text-text-secondary">
            {passed} / {executed.length} executed tests passed
            {inconclusive > 0 ? ` · ${inconclusive} unreachable (404)` : ""}
            {skipped > 0 ? ` · ${skipped} not automatable in a browser` : ""}
          </p>
          {inconclusive > 0 && (
            <p className="mt-2 rounded-md border border-status-medium/30 bg-status-medium/[0.06] px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
              <span className="font-semibold text-text-primary">Backend not reachable for {inconclusive} test(s).</span>{" "}
              Those requests returned 404, which means they never arrived at the Node server — nothing
              was proven about the control. Verify with:
              <br />
              <span className="mono break-all text-text-secondary">
                curl -i http://localhost:8787/api/admin/config
              </span>
              <br />
              Expect <span className="mono">401</span>. If that works but the runner shows 404, the
              Vite <span className="mono">/api</span> proxy is not forwarding — restart the dev server
              after confirming the proxy block in <span className="mono">vite.config.ts</span>.
            </p>
          )}

          {skipped > 0 && (
            <p className="mt-2 text-2xs leading-relaxed text-text-muted">
              Verify the untrusted-origin control from a terminal:
              <br />
              <span className="mono break-all text-text-secondary">
                curl -i -H &quot;Origin: http://evil.example&quot; http://localhost:8787/api/health
              </span>
              <br />
              Expect <span className="mono">403</span>. Do not change ALLOWED_ORIGINS to make it pass.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
