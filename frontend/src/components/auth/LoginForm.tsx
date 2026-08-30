import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Mail, Lock, Check } from "lucide-react";

type Status = "idle" | "submitting" | "success";

/**
 * Credential form.
 *
 * PHASE 1: no authentication is performed. `onAuthenticated` advances the
 * session stage in App.tsx; real JWT auth against POST /api/auth/login arrives
 * in Phase 2. Nothing here validates a password or claims to.
 */
export function LoginForm({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onAuthenticated,
}: {
  email: string;
  password: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  /** Receives the submitted credentials. The password is forwarded to the
   *  backend for token exchange and is never stored client-side. */
  onAuthenticated: (email: string, password: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [recoveryNote, setRecoveryNote] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("submitting");
    // Short, deterministic transition so the loading and success states are
    // perceivable. Phase 2 replaces this with the real request.
    window.setTimeout(() => setStatus("success"), 420);
    window.setTimeout(() => onAuthenticated(email, password), 780);
  }

  const field =
    "h-11 w-full rounded-lg border border-border bg-bg-elevated pl-10 pr-3 text-[15px] text-text-primary " +
    "placeholder:text-text-muted transition-[border-color,box-shadow] duration-150 hover:border-text-muted/50 " +
    "focus:border-accent focus:shadow-[0_0_0_3px_rgb(var(--accent)/0.14),0_0_18px_-6px_rgb(var(--accent)/0.5)]";

  const iconCls = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-2 block text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Work email
        </label>
        <div className="relative">
          <Mail size={15} className={iconCls} aria-hidden="true" />
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@organisation.com"
            className={field}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Password
        </label>
        <div className="relative">
          <Lock size={15} className={iconCls} aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Enter your password"
            className={`${field} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text-secondary"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-bg-elevated accent-accent"
          />
          Remember me
        </label>
        {/* No recovery flow exists in Phase 1, so this states that plainly
            rather than linking to a dead end. */}
        <button
          type="button"
          onClick={() => setRecoveryNote(true)}
          className="text-[13px] text-accent transition-opacity hover:opacity-80"
        >
          Forgot password?
        </button>
      </div>
      {recoveryNote && (
        <p role="status" className="-mt-1 text-2xs text-text-muted">
          Password recovery is not available in this prototype. Use a demo role below.
        </p>
      )}

      <button
        type="submit"
        disabled={status !== "idle"}
        className={`group/submit relative mt-1 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg text-[15px] font-semibold transition-all duration-200 disabled:cursor-not-allowed ${
          status === "success"
            ? "bg-status-success text-bg-primary"
            : "bg-gradient-to-r from-accent to-accent-warm text-bg-primary hover:-translate-y-px hover:brightness-110 hover:shadow-[0_6px_22px_-6px_rgb(var(--accent-warm)/0.5)] active:translate-y-0 active:scale-[0.99] disabled:opacity-80"
        }`}
      >
        {/* Highlight sweep — a single diagonal pass on hover, not a looping
            shimmer (which would read as a loading state). */}
        {status === "idle" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/4 w-1/4 -skew-x-12 bg-white/25 -translate-x-[250%] transition-transform duration-500 ease-out group-hover/submit:translate-x-[600%]"
          />
        )}
        {status === "success" ? (
          <>
            <Check size={17} strokeWidth={3} aria-hidden="true" />
            Signed in
          </>
        ) : status === "submitting" ? (
          <>
            <Loader2 size={17} className="animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          <>
            Sign in to SOCGenie
            <ArrowRight
              size={17}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover/submit:translate-x-1"
            />
          </>
        )}
      </button>
    </form>
  );
}
