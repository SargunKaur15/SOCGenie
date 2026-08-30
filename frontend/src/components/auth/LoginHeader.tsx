import { Logo } from "../brand/Logo";
import { ThemeSelector } from "./ThemeSelector";
import { useHealth } from "../../hooks/queries";

/** Brand lockup, live platform status and theme control. */
export function LoginHeader() {
  const { data: health, isLoading } = useHealth();
  const operational = health?.status === "ok";

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <div className="flex items-center gap-3.5">
        <Logo size={42} showWordmark={false} />
        <div>
          <p className="text-[22px] font-bold leading-none tracking-tight text-text-primary">SOCGenie</p>
          <p className="mt-1.5 hidden text-xs font-medium tracking-wide text-text-muted sm:block">
            Intelligent Security Operations Platform
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Reads the real health endpoint — never a hardcoded status. */}
        <span className="hidden items-center gap-2 rounded-lg border border-border bg-bg-surface/80 px-3 py-1.5 backdrop-blur-sm md:inline-flex">
          {isLoading ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted" aria-hidden="true" />
              <span className="text-2xs font-semibold uppercase tracking-wide text-text-muted">Checking</span>
            </>
          ) : (
            <>
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                {operational && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-60" />
                )}
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    operational ? "bg-status-success" : "bg-status-medium"
                  }`}
                />
              </span>
              <span
                className={`text-2xs font-semibold uppercase tracking-wide ${
                  operational ? "text-status-success" : "text-status-medium"
                }`}
              >
                {operational ? "Platform operational" : "Degraded"}
              </span>
            </>
          )}
        </span>
        <ThemeSelector />
      </div>
    </header>
  );
}
