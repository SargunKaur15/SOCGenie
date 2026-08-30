import {
  LayoutGrid, Bell, Search, ShieldAlert, ScrollText, Radar,
  Crosshair, FlaskConical, Sparkles, BarChart3, Settings as SettingsIcon,
  ChevronsLeft, ChevronsRight, X,
} from "lucide-react";
import { Logo } from "../brand/Logo";
import type { PageKey } from "../../App";

interface NavItem {
  key: PageKey;
  label: string;
  icon: typeof LayoutGrid;
}

/** The 11 screens locked in PRD v2.0 §25, grouped by analyst workflow.
 *  Grouping is presentational only — no screen was renamed, added or removed. */
const NAV_GROUPS: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ key: "command-center", label: "Command Center", icon: LayoutGrid }],
  },
  {
    section: "Monitor",
    items: [
      { key: "alerts", label: "Alerts", icon: Bell },
      { key: "incidents", label: "Incidents", icon: ShieldAlert },
      { key: "log-explorer", label: "Log Explorer", icon: ScrollText },
    ],
  },
  {
    section: "Investigate",
    items: [
      { key: "investigation", label: "Investigation", icon: Search },
      { key: "mitre", label: "MITRE ATT&CK", icon: Crosshair },
      { key: "assist", label: "SOCGenie Assist", icon: Sparkles },
    ],
  },
  {
    section: "Manage",
    items: [
      { key: "detection-ml", label: "Detection & ML", icon: Radar },
      { key: "analytics", label: "Analytics", icon: BarChart3 },
      { key: "simulation", label: "Simulation Lab", icon: FlaskConical },
      { key: "settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export function Sidebar({
  active,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  alertCount,
  mobileOpen = false,
  onCloseMobile,
}: {
  active: PageKey;
  onNavigate: (key: PageKey) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  alertCount: number;
  /** Below lg the sidebar becomes an overlay drawer. */
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  return (
    <aside
      aria-label="Primary navigation"
      className={`fixed inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col border-r border-border bg-bg-secondary transition-[width,transform] duration-200 lg:static lg:translate-x-0 ${
        collapsed ? "lg:w-[68px]" : "lg:w-[224px]"
      } w-[248px] ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className={`flex h-14 shrink-0 items-center justify-between border-b border-border px-4 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
        <Logo size={24} showWordmark={!collapsed} />
        <button
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-elevated hover:text-text-primary lg:hidden"
        >
          <X size={16} />
        </button>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.section} className="mb-3 last:mb-0">
            {(!collapsed || mobileOpen) && (
              <p className="px-3.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {group.section}
              </p>
            )}
            {collapsed && !mobileOpen && <div className="mx-3 mb-2 hidden h-px bg-border lg:block" aria-hidden="true" />}
        <ul className="flex flex-col gap-0.5 px-2">
          {group.items.map((item) => {
            const isActive = item.key === active;
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button
                  onClick={() => {
                    onNavigate(item.key);
                    onCloseMobile?.();
                  }}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                    isActive
                      ? "bg-bg-elevated text-text-primary"
                      : "text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-accent" aria-hidden="true" />
                  )}
                  <Icon
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                    className={isActive ? "shrink-0 text-accent" : "shrink-0 text-text-muted group-hover:text-text-secondary"}
                  />
                  {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                  {(!collapsed || mobileOpen) && item.key === "alerts" && alertCount > 0 && (
                    <span className="ml-auto rounded-full bg-status-critical/15 px-1.5 py-0.5 text-2xs font-semibold text-status-critical">
                      {alertCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
          </div>
        ))}
      </nav>

      <div className="hidden shrink-0 border-t border-border p-2 lg:block">
        <button
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex w-full items-center justify-center gap-2 rounded-md px-2.5 py-2 text-text-muted transition-colors hover:bg-bg-elevated/60 hover:text-text-secondary"
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          {!collapsed && <span className="text-2xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
