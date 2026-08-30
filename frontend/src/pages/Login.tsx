import { useState } from "react";
import { Crosshair, Search, Zap } from "lucide-react";
import { NetworkCanvas } from "../components/auth/NetworkCanvas";
import { LoginHeader } from "../components/auth/LoginHeader";
import { LoginFooter } from "../components/auth/LoginFooter";
import { EngineStatus } from "../components/auth/EngineStatus";
import { LoginForm } from "../components/auth/LoginForm";
import { DemoAccess } from "../components/auth/DemoAccess";
import { LiveTelemetryPanel } from "../components/auth/LiveTelemetryPanel";
import { LiveDetectionsPanel } from "../components/auth/LiveDetectionsPanel";

/**
 * SOCGenie entry experience — a SOC command-center preview, not a generic
 * SaaS login page.
 *
 * Three-column composition on desktop (hero + live detections | live
 * telemetry | authentication), stacking to hero -> telemetry -> detections ->
 * login on narrower viewports. Every count and alert on this screen reads
 * from the same demo alert/incident store the authenticated app uses, so
 * nothing here can drift from what the analyst sees after signing in.
 *
 * PHASE 1: client-side session state only. Real authentication arrives in
 * Phase 2; nothing here validates credentials.
 */

const entrance = (delayMs: number) => ({
  animationDelay: `${delayMs}ms`,
  animationFillMode: "both" as const,
});

const CAPABILITIES = [
  { label: "Threat Detection", caption: "Correlate signals, detect what matters", Icon: Crosshair },
  { label: "Deep Analysis", caption: "Investigate with full context & evidence", Icon: Search },
  { label: "Incident Response", caption: "Respond faster with actionable insights", Icon: Zap },
];

export function Login({ onLogin }: { onLogin: (email: string, password: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoRole, setDemoRole] = useState<"analyst" | "admin" | null>(null);

  function fillDemo(role: "analyst" | "admin") {
    setEmail(`${role}@socgenie.demo`);
    setPassword("socgenie-demo");
    setDemoRole(role);
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-bg-primary">
      <NetworkCanvas />

      <div className="relative z-10 animate-fade-in" style={entrance(0)}>
        <LoginHeader />
      </div>

      <main className="relative z-10 flex flex-1 justify-center px-5 py-5 sm:px-8 xl:py-4">
        <div className="grid w-full max-w-[1680px] grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)_400px] xl:grid-rows-[auto_auto] xl:items-stretch xl:gap-5">
          {/* Hero — brand positioning. Own grid cell so mobile/tablet can
              place it first while desktop keeps it atop the left column. */}
          <section className="xl:col-start-1 xl:row-start-1">
            <h1
              className="animate-hero-in text-[38px] font-bold uppercase leading-[1.05] tracking-tight text-text-primary sm:text-[44px] xl:text-[40px] 2xl:text-[46px]"
              style={entrance(150)}
            >
              Security
              <br />
              Operations,
              <br />
              <span className="bg-gradient-to-r from-accent to-status-low bg-clip-text text-transparent">
                Without the
                <br />
                Noise.
              </span>
            </h1>

            <p
              className="animate-fade-in-up mt-5 max-w-[46ch] text-[15px] leading-relaxed text-text-secondary"
              style={entrance(320)}
            >
              SOCGenie correlates security telemetry, detects threats, maps adversary behavior and
              gives analysts the context to investigate and respond faster.
            </p>
          </section>

          {/* Live telemetry — the visual centrepiece. Spans both rows so its
              height sets the rhythm the side columns stretch to match. */}
          <section
            className="animate-fade-in min-h-[520px] xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:h-auto xl:min-h-0"
            style={entrance(80)}
          >
            <LiveTelemetryPanel />
          </section>

          {/* Live detections + capability cards — second half of the left
              column on desktop, third stacked block on mobile. */}
          <section
            className="animate-fade-in-up flex flex-col gap-3 xl:col-start-1 xl:row-start-2"
            style={entrance(420)}
          >
            <LiveDetectionsPanel />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {CAPABILITIES.map(({ label, caption, Icon }) => (
                <div
                  key={label}
                  className="group flex items-center gap-2.5 rounded-lg border border-border bg-bg-surface/50 px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/[0.04] hover:shadow-[0_0_20px_-10px_rgb(var(--accent)/0.5)]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-bg-elevated text-accent transition-colors duration-200 group-hover:border-accent/40">
                    <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight text-text-primary">{label}</p>
                    <p className="truncate text-2xs leading-snug text-text-secondary">{caption}</p>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Authentication panel. */}
          <section
            className="animate-card-in mx-auto w-full max-w-[440px] xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:mx-0 xl:h-full xl:max-w-none"
            style={entrance(560)}
          >
            <div className="flex h-full flex-col rounded-2xl border border-border bg-bg-surface/90 p-6 shadow-panel ring-1 ring-accent-secondary/[0.06] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 hover:border-accent/25 hover:shadow-[0_0_32px_-14px_rgb(var(--accent)/0.35)] sm:p-7 dark:ring-white/[0.03]">
              <div className="mb-5 text-center">
                <h2 className="text-xl font-semibold tracking-tight text-text-primary">Welcome back</h2>
                <p className="mt-1 text-[13px] text-text-secondary">
                  Sign in to access your SOCGenie workspace.
                </p>
              </div>

              <div className="mb-5">
                <EngineStatus />
              </div>

              <LoginForm
                email={email}
                password={password}
                onEmailChange={(v) => { setEmail(v); setDemoRole(null); }}
                onPasswordChange={(v) => { setPassword(v); setDemoRole(null); }}
                onAuthenticated={onLogin}
              />

              <div className="mt-6">
                <DemoAccess onSelect={fillDemo} selected={demoRole} />
                <p className="mt-2.5 text-center text-2xs text-text-muted">
                  Select a role to fill the form. Credentials are not verified in this prototype.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <div className="relative z-10 animate-fade-in" style={entrance(700)}>
        <LoginFooter />
      </div>
    </div>
  );
}
