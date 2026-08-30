import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "socgenie.theme";
/** Must match the transition duration in index.css. */
const TRANSITION_CLASS = "theme-switching";
const TRANSITION_MS = 400;

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitial(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unavailable — fall through */
  }
  return "dark"; // Dark is the primary operational theme.
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  const firstRun = useRef(true);

  useEffect(() => {
    const root = document.documentElement;

    // Enable colour transitions only for the duration of a switch. Skipped on
    // first mount so the initial paint is instant rather than fading in.
    let timer = 0;
    if (!firstRun.current) {
      root.classList.add(TRANSITION_CLASS);
      timer = window.setTimeout(() => root.classList.remove(TRANSITION_CLASS), TRANSITION_MS);
    }
    firstRun.current = false;

    root.classList.remove("dark", "light");
    root.classList.add(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* non-fatal */
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
