import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { ShortcutsOverlay } from "./components/ui/ShortcutsOverlay";
import { Loader2 } from "lucide-react";
import { sessionStore } from "./lib/auth/session";
import { apiLogin, apiLogout } from "./lib/ai/backendClient";
// Login and Initializing are NOT lazy — they're what the very first paint
// shows, before any authentication gate, so deferring them would only add a
// loading flicker to the one screen that can least afford it.
import { Login } from "./pages/Login";
import { Initializing } from "./pages/Initializing";
import { useTheme } from "./hooks/useTheme";
import type { Alert } from "./lib/types";

/**
 * The 11 authenticated screens, lazy per Phase C (§C2 of the readiness
 * audit): only one is ever mounted at a time, and a session may easily never
 * visit most of them, so eagerly bundling all 11 cost every session the
 * weight of every page regardless of which it actually used. Confirmed via
 * profiling first — see the audit report — that this is a bundle-composition
 * fix, not a rendering-speed one; navigation itself was already fast.
 *
 * Each lazy() call is wrapped in Suspense inside the render below, inside
 * AppShell's existing motion.div — NOT inside an AnimatePresence, which is
 * exactly the mechanism Phase A removed after it froze every page
 * transition. A plain Suspense boundary here is unrelated to that bug: it
 * only governs the one-time fallback while a page's own chunk is still being
 * fetched, not any exit/unmount animation.
 */
const CommandCenter = lazy(() => import("./pages/CommandCenter").then((m) => ({ default: m.CommandCenter })));
const Alerts = lazy(() => import("./pages/Alerts").then((m) => ({ default: m.Alerts })));
const Investigation = lazy(() => import("./pages/Investigation").then((m) => ({ default: m.Investigation })));
const Incidents = lazy(() => import("./pages/Incidents").then((m) => ({ default: m.Incidents })));
const LogExplorer = lazy(() => import("./pages/LogExplorer").then((m) => ({ default: m.LogExplorer })));
const DetectionML = lazy(() => import("./pages/DetectionML").then((m) => ({ default: m.DetectionML })));
const Mitre = lazy(() => import("./pages/Mitre").then((m) => ({ default: m.Mitre })));
const SimulationLab = lazy(() => import("./pages/SimulationLab").then((m) => ({ default: m.SimulationLab })));
const Assist = lazy(() => import("./pages/Assist").then((m) => ({ default: m.Assist })));
const Analytics = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.Analytics })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));

/** Lazy — a one-shot navigation effect that most sessions may never trigger
 *  (only when actually entering MITRE ATT&CK), so it shouldn't cost anything
 *  in the initial bundle. */
const MitreEntryTransition = lazy(() =>
  import("./components/transitions/MitreEntryTransition").then((m) => ({
    default: m.MitreEntryTransition,
  }))
);

/** Full-page fallback for a page chunk that's still being fetched — only
 *  ever visible on a page's genuine first visit in a session; every later
 *  visit resolves instantly since the chunk is already cached. */
function PageLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading page">
      <Loader2 size={20} className="animate-spin text-text-muted" aria-hidden="true" />
    </div>
  );
}

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
  // A valid session persists in sessionStorage (see lib/auth/session.ts), but
  // this defaulted to "login" unconditionally, so refreshing the tab always
  // forced a full re-login even with a live session. Checking the store's
  // snapshot at mount restores straight to "ready" when one exists. This
  // only affects client-side UI state — the real, server-signed auth token
  // was never persisted across a reload either way (by design; see
  // lib/auth/backendClient.ts), so privileged actions still require it
  // exactly as before regardless of what this shows.
  const [stage, setStage] = useState<SessionStage>(() =>
    sessionStore.getSnapshot() ? "ready" : "login"
  );
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
          <Suspense fallback={<PageLoadingFallback />}>{pages[page]}</Suspense>
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
