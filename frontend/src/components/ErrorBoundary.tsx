import { Component, type ErrorInfo, type ReactNode } from "react";
import { ShieldAlert, RotateCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level recovery boundary — the last line of defense against a blank
 * screen.
 *
 * The failure mode this exists for is a failed dynamic import: a lazy page
 * or 3D-scene chunk (see App.tsx / the components/3d Suspense boundaries)
 * that didn't fetch, e.g. after a redeploy changed the asset hashes, or a
 * transient network blip. React cannot recover from that by re-rendering —
 * the failed module import stays rejected in the browser's module cache, so
 * retrying in place throws again. A full reload re-fetches the current asset
 * manifest and is the only action that actually resolves it, so that is the
 * one recovery action offered here rather than a "try again" that would
 * silently fail a second time.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Message and component stack only — this never touches application
    // state (alerts, incidents, credentials), so there is nothing sensitive
    // to redact.
    console.error("[socgenie/app] unhandled render error:", error.message, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-primary p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-bg-surface p-6 text-center shadow-panel">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-status-critical/30 bg-status-critical/10 text-status-critical">
            <ShieldAlert size={20} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 className="text-sm font-semibold text-text-primary">SOCGenie hit an unexpected error</h1>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            Something failed to load correctly. Reloading almost always fixes this — your session
            and any local data are unaffected.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-xs font-medium text-bg-primary transition-colors hover:opacity-90"
          >
            <RotateCw size={13} strokeWidth={2} aria-hidden="true" />
            Reload SOCGenie
          </button>
          {import.meta.env.DEV && (
            <p className="mono mt-4 break-words rounded-md bg-bg-elevated p-2 text-left text-[11px] text-text-muted">
              {this.state.error.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}
