import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

/**
 * Segmented dark/light control for the authentication surfaces.
 *
 * Wraps the existing ThemeProvider — no separate theme architecture. The
 * provider already writes to localStorage and applies the class to <html>,
 * and index.html restores it before first paint, so selection persists across
 * reloads without a flash.
 */
export function ThemeSelector({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "dark" as const, label: "Dark", Icon: Moon },
    { value: "light" as const, label: "Light", Icon: Sun },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`relative flex items-center gap-0.5 rounded-lg border border-border bg-bg-surface/80 p-0.5 backdrop-blur-sm ${className}`}
    >
      {options.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
              active
                ? "bg-bg-elevated text-text-primary shadow-panel"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Icon size={13} aria-hidden="true" className={active ? "text-accent" : ""} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
