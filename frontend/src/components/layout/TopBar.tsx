import { useEffect, useRef, useState } from "react";
import { NOTIFICATIONS } from "../../mocks/dashboard";
import { Bell, ChevronDown, HelpCircle, LogOut, Menu, UserRound } from "lucide-react";
import { StatusPill } from "../ui/StatusPill";
import { ThemeToggle } from "./ThemeToggle";
import { useHealth } from "../../hooks/queries";
import { useSession } from "../../hooks/useSession";

const NOTIF_TONE: Record<string, string> = {
  critical: "bg-status-critical",
  high: "bg-status-high",
  medium: "bg-status-medium",
  info: "bg-accent",
};

export function TopBar({
  pageTitle,
  onShowShortcuts,
  onLogout,
  onOpenNav,
}: {
  pageTitle: string;
  onShowShortcuts: () => void;
  onLogout: () => void;
  onOpenNav?: () => void;
}) {
  const { data: health, isLoading } = useHealth();
  const user = useSession();

  // TopBar only mounts once the session stage is "ready", i.e. after login.
  // A null user here is therefore an error, not a normal state — most often it
  // means App.tsx was not updated to call sessionStore.signIn(). Surfacing it
  // beats rendering a plausible-looking but wrong identity.
  if (import.meta.env.DEV && !user) {
    console.warn(
      "[socgenie/session] TopBar rendered with no session. " +
        "Check that App.tsx calls sessionStore.signIn(email) in <Login onLogin={...} />."
    );
  }
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const unread = NOTIFICATIONS.filter((n) => !readIds.includes(n.id)).length;

  // One handler closes whichever popover is open — avoids two competing listeners.
  useEffect(() => {
    if (!menuOpen && !notifOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, notifOpen]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-bg-secondary px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary lg:hidden"
        >
          <Menu size={16} />
        </button>
        <h1 className="truncate text-[13px] font-medium text-text-secondary">{pageTitle}</h1>
      </div>

      <div className="hidden items-center divide-x divide-border overflow-hidden rounded-md border border-border bg-bg-surface lg:flex">
        {isLoading || !health ? (
          <div className="px-3 py-1.5 text-2xs text-text-muted">Checking system status…</div>
        ) : (
          <>
            <StatusPill
              label="SOC"
              value={health.status === "ok" ? "OPERATIONAL" : "DEGRADED"}
              tone={health.status === "ok" ? "success" : "warning"}
            />
            <StatusPill
              label="Database"
              value={health.db === "connected" ? "CONNECTED" : "UNAVAILABLE"}
              tone={health.db === "connected" ? "success" : "warning"}
            />
            {/* Reports the real state — no model exists until Phase 9. */}
            <StatusPill
              label="ML Engine"
              value={health.ml_engine.loaded ? `v${health.ml_engine.version}` : "NOT LOADED"}
              tone={health.ml_engine.loaded ? "info" : "neutral"}
            />
            <StatusPill
              label="Assist"
              value={health.assist_provider === "llm" ? "LLM" : "RULE-BASED"}
              tone="neutral"
            />
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onShowShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-secondary"
        >
          <HelpCircle size={15} />
        </button>
        <ThemeToggle />
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotifOpen((o) => !o);
              setMenuOpen(false);
            }}
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            aria-expanded={notifOpen}
            aria-haspopup="menu"
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-secondary"
          >
            <Bell size={15} />
            {unread > 0 && (
              <span
                className="absolute right-1 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-status-critical px-1 text-[9px] font-semibold text-bg-primary"
                aria-hidden="true"
              >
                {unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-lg border border-border bg-bg-surface shadow-panel"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <p className="text-xs font-medium text-text-primary">Notifications</p>
                {unread > 0 && (
                  <button
                    onClick={() => setReadIds(NOTIFICATIONS.map((n) => n.id))}
                    className="text-2xs text-accent hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <ul className="max-h-72 overflow-y-auto">
                {NOTIFICATIONS.map((n) => {
                  const isRead = readIds.includes(n.id);
                  return (
                    <li key={n.id}>
                      <button
                        role="menuitem"
                        onClick={() => setReadIds((prev) => (isRead ? prev : [...prev, n.id]))}
                        className="flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-bg-elevated"
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            isRead ? "bg-text-muted/40" : NOTIF_TONE[n.tone]
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-2xs ${isRead ? "text-text-muted" : "text-text-primary"}`}>
                            {n.title}
                          </span>
                          <span className="mt-0.5 block text-2xs text-text-muted">{n.detail}</span>
                          <span className="mono mt-0.5 block text-2xs text-text-muted">{n.minutesAgo} min ago</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="border-t border-border px-3 py-2 text-2xs text-text-muted">
                Simulated notifications — no live source is connected.
              </p>
            </div>
          )}
        </div>

        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              setMenuOpen((o) => !o);
              setNotifOpen(false);
            }}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-bg-elevated"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-elevated text-2xs font-semibold text-text-secondary">
              {user?.initials ?? "--"}
            </span>
            <span className="hidden text-left xl:block">
              <span className="block text-2xs font-medium leading-tight text-text-primary">
                {user?.name ?? "Not signed in"}
              </span>
              <span className="block text-2xs leading-tight text-text-muted">
                {user?.roleLabel ?? "--"}
              </span>
            </span>
            <ChevronDown size={13} className="text-text-muted" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-lg border border-border bg-bg-surface shadow-panel"
            >
              <div className="border-b border-border px-3 py-2.5">
                <p className="text-xs font-medium text-text-primary">{user?.name ?? "Not signed in"}</p>
                <p className="mono text-2xs text-text-muted">{user?.email ?? "--"}</p>
                <p className="mt-1 inline-block rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-2xs font-semibold text-accent">
                  {user?.roleLabel ?? "No role"}
                </p>
              </div>
              <button
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
              >
                <UserRound size={13} aria-hidden="true" /> Profile
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-status-critical transition-colors hover:bg-status-critical/10"
              >
                <LogOut size={13} aria-hidden="true" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
