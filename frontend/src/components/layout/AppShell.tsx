import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAlerts } from "../../hooks/queries";
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
  const { data } = useAlerts({});
  const openCount = (data?.items ?? []).filter((a) => a.status === "new" || a.status === "investigating").length;

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
          {/* Subtle cross-page transition — a fade + small vertical shift,
              so navigating between screens feels like one cohesive system
              rather than an abrupt swap. Skips entirely under
              prefers-reduced-motion, and on first mount (App.tsx already
              fades the whole shell in once). */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
