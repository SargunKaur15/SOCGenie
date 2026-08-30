import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { ShortcutsOverlay } from "./components/ui/ShortcutsOverlay";
import { sessionStore } from "./lib/auth/session";
import { apiLogin, apiLogout } from "./lib/ai/backendClient";
import { Login } from "./pages/Login";
import { Initializing } from "./pages/Initializing";
import { CommandCenter } from "./pages/CommandCenter";
import { Alerts } from "./pages/Alerts";
import { Investigation } from "./pages/Investigation";
import { Incidents } from "./pages/Incidents";
import { LogExplorer } from "./pages/LogExplorer";
import { DetectionML } from "./pages/DetectionML";
import { Mitre } from "./pages/Mitre";
import { SimulationLab } from "./pages/SimulationLab";
import { Assist } from "./pages/Assist";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";
import { useTheme } from "./hooks/useTheme";
import type { Alert } from "./lib/types";

/** Lazy — a one-shot navigation effect that most sessions may never trigger
 *  (only when actually entering MITRE ATT&CK), so it shouldn't cost anything
 *  in the initial bundle. */
const MitreEntryTransition = lazy(() =>
  import("./components/transitions/MitreEntryTransition").then((m) => ({
    default: m.MitreEntryTransition,
  }))
);

/** The 11 screens locked in PRD v2.0 §25. */
export type PageKey =
  | "command-center"
  | "alerts"
  | "investigation"
  | "incidents"
  | "log-explorer"
  | "detection-ml"
  | "mitre"
  | "simulation"
  | "assist"
  | "analytics"
  | "settings";

/** "G then X" navigation targets. */
const GOTO_KEYS: Record<string, PageKey> = {
  c: "command-center",
  a: "alerts",
  i: "incidents",
  l: "log-explorer",
  d: "detection-ml",
  m: "mitre",
  s: "simulation",
  n: "analytics",
};

/** Opening flow: login → initialization → the application shell. */
type SessionStage = "login" | "initializing" | "ready";

export default function App() {
  const [stage, setStage] = useState<SessionStage>("login");
  const [page, setPage] = useState<PageKey>("command-center");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { toggle: toggleTheme } = useTheme();
  const awaitingGoto = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const prevPage = useRef(page);
  const [mitreEntry, setMitreEntry] = useState(false);

  // A short cinematic overlay plays only when actually ENTERING MITRE
  // ATT&CK from elsewhere — not on every navigation, and never under
  // prefers-reduced-motion (AppShell's own reduced-motion-safe page fade
  // still runs either way).
  useEffect(() => {
    if (page === "mitre" && prevPage.current !== "mitre" && !reducedMotion) {
      setMitreEntry(true);
    }
    prevPage.current = page;
  }, [page, reducedMotion]);

  /** Returns to the login screen and clears the selected alert. */
  const handleLogout = useCallback(() => {
    sessionStore.signOut();
    apiLogout();
    setSelectedAlert(null);
    setPage("command-center");
    setStage("login");
  }, []);

  const handleInvestigate = useCallback((alert: Alert) => {
    setSelectedAlert(alert);
    setPage("investigation");
  }, []);

  useEffect(() => {
    if (stage !== "ready") return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (awaitingGoto.current) {
        awaitingGoto.current = false;
        const dest = GOTO_KEYS[key];
        if (dest) {
          e.preventDefault();
          setPage(dest);
        }
        return;
      }

      if (key === "g") {
        awaitingGoto.current = true;
        window.setTimeout(() => (awaitingGoto.current = false), 1200);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      }
      if (key === "t") toggleTheme();
      if (e.key === "Escape") setShortcutsOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stage, toggleTheme]);

  if (stage === "login") {
    return (
      <Login
        onLogin={(email, password) => {
          // Client session drives UI state only.
          sessionStore.signIn(email);
          // Backend authentication is separate and authoritative: it returns a
          // signed token carrying a SERVER-DERIVED role. Failure is
          // non-blocking — the UI still works, AI falls back to the local
          // engine, and no privileged API call can succeed without the token.
          void apiLogin(email, password);
          setStage("initializing");
        }}
      />
    );
  }

  if (stage === "initializing") {
    return <Initializing onEnter={() => setStage("ready")} />;
  }

  const pages: Record<PageKey, React.ReactNode> = {
    "command-center": <CommandCenter onInvestigate={handleInvestigate} onNavigate={setPage} />,
    alerts: <Alerts onInvestigate={handleInvestigate} />,
    investigation: (
      <Investigation
        alertRef={selectedAlert?.alert_ref ?? null}
        onBack={() => setPage("alerts")}
        onNavigate={setPage}
      />
    ),
    incidents: <Incidents onInvestigate={handleInvestigate} onNavigate={setPage} />,
    "log-explorer": <LogExplorer />,
    "detection-ml": <DetectionML />,
    mitre: <Mitre />,
    simulation: <SimulationLab />,
    assist: <Assist />,
    analytics: <Analytics />,
    settings: <Settings />,
  };

  return (
    <>
      <div className="h-full animate-fade-in">
        <AppShell
          active={page}
          onNavigate={setPage}
          onShowShortcuts={() => setShortcutsOpen(true)}
          onLogout={handleLogout}
        >
          {pages[page]}
        </AppShell>
      </div>
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
      {mitreEntry && (
        <Suspense fallback={null}>
          <MitreEntryTransition onDone={() => setMitreEntry(false)} />
        </Suspense>
      )}
    </>
  );
}
