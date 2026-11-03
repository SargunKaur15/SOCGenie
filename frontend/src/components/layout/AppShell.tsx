import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAlerts } from "../../hooks/useAlerts";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import type { PageKey } from "../../App";

export const PAGE_TITLES: Record<PageKey, string> = {
  "command-center": "Command Center",
  alerts: "Alerts",
  investigation: "Investigation Workspace",
  incidents: "Incidents",
  "log-explorer": "Log Explorer",
  "detection-ml": "Detection & ML",
  mitre: "MITRE ATT&CK",
  simulation: "Simulation Lab",
  assist: "SOCGenie Assist",
  analytics: "Analytics",
  settings: "Settings",
};

export function AppShell({
  active,
  onNavigate,
  onShowShortcuts,
  onLogout,
  children,
}: {
  active: PageKey;
  onNavigate: (key: PageKey) => void;
  onShowShortcuts: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  // Close the drawer whenever the route changes, so it never lingers.
  useEffect(() => setMobileOpen(false), [active]);
  // Reads the same live alert store every triage/escalate/ingest action
  // writes to — see hooks/useAlerts.ts. A previous version of this file read
  // hooks/queries.ts's fixture-backed useAlerts instead, which meant this
  // badge never reflected anything that happened anywhere else in the app.
  const { alerts } = useAlerts();
  const openCount = alerts.filter((a) => a.status === "open" || a.status === "investigating").length;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-primary">
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        alertCount={openCount}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      {/* Scrim — only rendered while the drawer is open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-bg-primary/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          pageTitle={PAGE_TITLES[active]}
          onShowShortcuts={onShowShortcuts}
          onLogout={onLogout}
          onOpenNav={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {/* Cross-page transition — a fade + small vertical shift on the
              INCOMING page, so navigating between screens feels like one
              cohesive system rather than an abrupt swap. Skips under
              prefers-reduced-motion, and on first mount (App.tsx already
              fades the whole shell in once).

              Deliberately NOT wrapped in <AnimatePresence>. It was
              originally, driving both an enter and an exit animation
              (mode="wait"). That froze navigation for several seconds to
              indefinitely on every single page change, reproduced
              consistently regardless of destination page, and confirmed —
              by isolating one variable at a time — to be caused by
              AnimatePresence's own exit/unmount bookkeeping, not by 3D
              content, the per-page 1s status tickers, or React.StrictMode
              (all three were individually removed and the freeze persisted;
              removing only AnimatePresence, keeping everything else
              including this motion.div's enter animation, fixed it
              immediately and consistently). The 0.28s timing and easing
              curve are unchanged from the original transition — this keeps
              the page-entry animation exactly as designed and drops only
              the page-exit half, which is the part that was broken. */}
          <motion.div
            key={active}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
