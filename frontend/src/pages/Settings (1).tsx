import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { Select } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { useTheme } from "../hooks/useTheme";
import { useHealth } from "../hooks/queries";
import { DEMO_MODE } from "../lib/api";
import { useSession } from "../hooks/useSession";
import { providerStatus, realProviderStatus } from "../lib/ai/provider";
import { KNOWLEDGE_BASE } from "../lib/rag/knowledgeBase";
import { SecurityTestRunner } from "../components/dev/SecurityTestRunner";

function Row({ label, description, control }: { label: string; description: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] text-text-primary">{label}</p>
        <p className="mt-0.5 text-2xs text-text-secondary">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { data: health } = useHealth();
  // Same source of truth the TopBar uses — no second auth state.
  const user = useSession();
  const isAdmin = user?.role === "admin";
  const ai = providerStatus();
  const realAi = realProviderStatus();

  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={SettingsIcon} title="Settings" description="Workspace, appearance and engine configuration" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-[760px] flex-col gap-4">
          <Panel eyebrow="Account" title="Profile">
            <Row
              label="Signed in as"
              description={user?.email ?? "Not signed in"}
              control={<Badge>{user?.roleLabel ?? "No role"}</Badge>}
            />
            <Row
              label="Display name"
              description="Recorded against notes, decisions and audit entries you create"
              control={<Badge tone="neutral">{user?.name ?? "--"}</Badge>}
            />
            <Row
              label="Role"
              description="Determines which response and configuration actions are available"
              control={
                <Badge tone={isAdmin ? "accent" : "neutral"}>
                  {user?.roleLabel ?? "No role"}
                </Badge>
              }
            />
          </Panel>

          <Panel eyebrow="Appearance" title="Interface">
            <Row
              label="Theme"
              description="Dark is the primary operational theme; light is provided for documentation and printing"
              control={
                <Select value={theme} onChange={(e) => setTheme(e.target.value as "dark" | "light")} aria-label="Theme">
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </Select>
              }
            />
            <Row
              label="Reduce motion"
              description="Animation is disabled automatically when your system requests reduced motion"
              control={<Badge tone="neutral">System</Badge>}
            />
            <Row
              label="Table density"
              description="Rows per screen in alert and log tables"
              control={<Select defaultValue="compact" disabled aria-label="Density"><option value="compact">Compact</option><option value="comfortable">Comfortable</option></Select>}
            />
          </Panel>

          <Panel
            eyebrow="Engines"
            title="Detection configuration"
            actions={
              <Badge tone={isAdmin ? "accent" : "neutral"}>
                {isAdmin ? "Configurable" : "Read-only"}
              </Badge>
            }
          >
            <Row
              label="Rule engine"
              description="Deterministic rules covering host telemetry, temporal patterns and external context"
              control={<Badge tone="success">Active</Badge>}
            />
            <Row
              label="ML detection engine"
              description="Locally trained scikit-learn models — Random Forest and Isolation Forest"
              control={
                <Badge tone={health?.ml_engine.loaded ? "success" : "warning"}>
                  {health?.ml_engine.loaded ? `Loaded v${health.ml_engine.version}` : "Not trained"}
                </Badge>
              }
            />
            <Row
              label="Assist provider"
              description="Optional. Configured server-side via environment variables only — never read by the browser"
              control={<Badge tone="neutral">{health?.assist_provider === "llm" ? "External LLM" : "Rule-based"}</Badge>}
            />
            <Row
              label="API connection"
              description={DEMO_MODE ? "No backend configured — the interface is running on local simulated data" : "Connected to the SOCGenie backend"}
              control={<Badge tone={DEMO_MODE ? "warning" : "success"}>{DEMO_MODE ? "Demo data" : "Live"}</Badge>}
            />
          </Panel>

          {/* Admin-only. Controls reference configuration that already exists in
              the project; nothing new was invented for this panel. In this
              phase they are disabled because the backend that would persist
              them does not exist yet — shown as unavailable rather than
              pretending to work. */}
          {isAdmin && (
            <Panel
              eyebrow="Administration"
              title="Workspace configuration"
              actions={<Badge tone="accent">{user?.roleLabel}</Badge>}
            >
              <Row
                label="Detection rule management"
                description="Enable, disable and tune the seven deterministic rules. Managed on the Detection & ML screen."
                control={<Badge tone="warning">Requires backend</Badge>}
              />
              <Row
                label="ML engine configuration"
                description="Model selection and decision thresholds. Unavailable until a model is trained."
                control={
                  <Badge tone={health?.ml_engine.loaded ? "success" : "warning"}>
                    {health?.ml_engine.loaded ? "Configurable" : "No trained model"}
                  </Badge>
                }
              />
              <Row
                label="AI provider status"
                description={ai.detail}
                control={<Badge tone={ai.connected ? "success" : "neutral"}>{ai.state.replace(/_/g, " ")}</Badge>}
              />
              <Row
                label="External model"
                description={realAi.message}
                control={<Badge tone={realAi.available ? "success" : "warning"}>
                  {realAi.available ? "Configured" : "Not configured"}
                </Badge>}
              />
              <Row
                label="Knowledge base"
                description={`${KNOWLEDGE_BASE.length} curated documents used for retrieval. Local only — no live threat intelligence feed is connected.`}
                control={<Badge tone="neutral">{KNOWLEDGE_BASE.length} documents</Badge>}
              />
              <Row
                label="Simulation Lab"
                description="Run scenario generators against the detection pipeline."
                control={<Badge tone="warning">Phase 14</Badge>}
              />
            </Panel>
          )}

          {!isAdmin && (
            <Panel eyebrow="Administration" title="Workspace configuration">
              <p className="py-3 text-2xs leading-relaxed text-text-secondary">
                Detection rule management, ML engine configuration and Assist provider selection
                require the SOC Admin role. Your current role is{" "}
                <span className="font-medium text-text-primary">{user?.roleLabel ?? "unknown"}</span>.
                Operational settings above remain available to you.
              </p>
            </Panel>
          )}

          {/* DEV SECURITY TEST — Phase 11 verification. Remove this block and
              components/dev/SecurityTestRunner.tsx once verified. */}
          {import.meta.env.DEV && <SecurityTestRunner />}

          <p className="pb-2 text-center text-2xs text-text-muted">
            API credentials are never stored in, transmitted to, or read by the frontend.
          </p>
        </div>
      </div>
    </div>
  );
}
