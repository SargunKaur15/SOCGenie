import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: c("--bg-primary"),
          secondary: c("--bg-secondary"),
          surface: c("--bg-surface"),
          elevated: c("--bg-elevated"),
        },
        border: { DEFAULT: c("--border-default") },
        text: {
          primary: c("--text-primary"),
          secondary: c("--text-secondary"),
          muted: c("--text-muted"),
        },
        accent: { DEFAULT: c("--accent"), secondary: c("--accent-secondary"), warm: c("--accent-warm") },
        status: {
          success: c("--status-success"),
          low: c("--status-low"),
          medium: c("--status-medium"),
          high: c("--status-high"),
          critical: c("--status-critical"),
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      boxShadow: { panel: "var(--panel-highlight), var(--shadow-panel)" },
      keyframes: {
        "fade-in-up": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "alert-pulse": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },

        /* --- Auth surfaces only (login + initialization). Additive. --- */
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "card-in": {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "logo-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "60%": { opacity: "1" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "shield-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.45" },
          "70%": { transform: "scale(1.5)", opacity: "0" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
        "packet-travel": {
          "0%": { transform: "translateX(-8%)", opacity: "0" },
          "12%": { opacity: "1" },
          "88%": { opacity: "1" },
          "100%": { transform: "translateX(108%)", opacity: "0" },
        },
        "node-breathe": {
          "0%,100%": { opacity: "0.25", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.25)" },
        },
        "scan-sweep": {
          "0%": { transform: "translateY(-20%)", opacity: "0" },
          "20%": { opacity: "0.5" },
          "80%": { opacity: "0.5" },
          "100%": { transform: "translateY(120%)", opacity: "0" },
        },
        "status-in": {
          "0%": { opacity: "0", transform: "translateX(-6px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "check-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "70%": { transform: "scale(1.06)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "hero-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "flow-down": {
          "0%": { transform: "translateY(-10%)", opacity: "0" },
          "15%": { opacity: "1" },
          "85%": { opacity: "1" },
          "100%": { transform: "translateY(110%)", opacity: "0" },
        },
        "orbit-ring": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },

        "wordmark-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "wordmark-breathe": {
          "0%, 100%": { opacity: "0.94", transform: "scale(0.99)" },
          "50%": { opacity: "1", transform: "scale(1.01)" },
        },

        /* --- MITRE ATT&CK entry transition. Additive, one-shot only. --- */
        "mitre-vignette": {
          "0%": { opacity: "0" },
          "16%": { opacity: "1" },
          "78%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "mitre-pulse-ring": {
          "0%": { transform: "scale(0.05)", opacity: "0" },
          "18%": { opacity: "0.9" },
          "55%": { transform: "scale(1)", opacity: "0.3" },
          "100%": { transform: "scale(1.7)", opacity: "0" },
        },
        "mitre-tunnel": {
          "0%": { opacity: "0", transform: "scale(0.35)" },
          "35%": { opacity: "0.55" },
          "72%": { opacity: "0.3" },
          "100%": { opacity: "0", transform: "scale(2.1)" },
        },
        "mitre-streak": {
          "0%": { transform: "rotate(var(--streak-angle)) translateX(0) scaleX(0.3)", opacity: "0" },
          "12%": { opacity: "1" },
          "70%": { opacity: "0.7" },
          "100%": { transform: "rotate(var(--streak-angle)) translateX(38vmin) scaleX(1)", opacity: "0" },
        },
        "mitre-scan": {
          "0%": { transform: "translateY(-70%) rotate(-6deg)", opacity: "0" },
          "18%": { opacity: "0.45" },
          "82%": { opacity: "0.3" },
          "100%": { transform: "translateY(170%) rotate(-6deg)", opacity: "0" },
        },

        /* --- Live-environment layer (auth surfaces only) --- */
        "grid-drift": {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(48px, 48px, 0)" },
        },
        "link-breathe": {
          "0%, 100%": { opacity: "0.25" },
          "45%": { opacity: "1" },
        },
        "packet-rtl": {
          "0%": { transform: "translateX(108%)", opacity: "0" },
          "12%": { opacity: "1" },
          "88%": { opacity: "1" },
          "100%": { transform: "translateX(-8%)", opacity: "0" },
        },
        "wave-sweep": {
          "0%": { transform: "translateY(-30%) rotate(-8deg)", opacity: "0" },
          "25%": { opacity: "1" },
          "75%": { opacity: "1" },
          "100%": { transform: "translateY(130%) rotate(-8deg)", opacity: "0" },
        },
        "signal-blink": {
          "0%, 92%, 100%": { opacity: "0.2", transform: "scale(1)" },
          "96%": { opacity: "1", transform: "scale(1.6)" },
        },
        "core-breathe": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgb(var(--accent) / 0)" },
          "50%": { transform: "scale(1.035)", boxShadow: "0 0 22px 2px rgb(var(--accent) / 0.16)" },
        },
        /* 6s workflow cycle: DETECT 0-2s, ANALYZE 2-4s, RESPOND 4-6s.
           Each node uses the same keyframe with a 2s delay offset. */
        "node-receive": {
          "0%, 34%, 100%": {
            borderColor: "rgb(var(--border-default))",
            boxShadow: "0 0 0 0 rgb(var(--accent) / 0)",
          },
          "8%": {
            borderColor: "rgb(var(--accent) / 0.7)",
            boxShadow: "0 0 16px 1px rgb(var(--accent) / 0.22)",
          },
          "20%": {
            borderColor: "rgb(var(--accent) / 0.4)",
            boxShadow: "0 0 8px 0 rgb(var(--accent) / 0.10)",
          },
        },
        "node-dot": {
          "0%, 34%, 100%": { opacity: "0.25", transform: "scale(1)" },
          "8%": { opacity: "1", transform: "scale(1.5)" },
        },
        /* --- Intelligence Core --- */
        "orbit-ccw": {
          "0%": { transform: "rotate(360deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        /* 6s workflow cycle, 2s per stage. Same keyframe, offset by 0/2/4s. */
        "stage-activate": {
          "0%, 36%, 100%": { opacity: "0.45", borderColor: "rgb(var(--border-default))" },
          "8%": { opacity: "1", borderColor: "rgb(var(--accent) / 0.65)" },
          "24%": { opacity: "0.8", borderColor: "rgb(var(--accent) / 0.3)" },
        },
        "stage-glow": {
          "0%, 36%, 100%": { opacity: "0" },
          "8%": { opacity: "1" },
          "24%": { opacity: "0.35" },
        },
        /* --- 8s security-event cycle ---
           packet enters (0-18%) -> core pulse (18-24%) -> DETECT (25%)
           -> ANALYZE (44%) -> RESPOND (62%) -> rest. Stages share one
           keyframe, offset by animation-delay. */
        "core-impact": {
          "0%, 16%, 30%, 100%": { transform: "scale(1)", opacity: "0" },
          "20%": { transform: "scale(1.35)", opacity: "0.85" },
        },
        "stage-fire": {
          "0%, 22%, 100%": { opacity: "0.5", borderColor: "rgb(var(--border-default))" },
          "5%": { opacity: "1", borderColor: "var(--stage-accent, rgb(var(--accent)))" },
          "14%": { opacity: "0.85", borderColor: "rgb(var(--border-default))" },
        },
        /* Floating AI SOCGenie button — scale-only so reduced-motion freezes
           it cleanly at its resting size. */
        /* Soft severity glow — opacity only on a blur layer, so it reads as a
           breath rather than a flash. */
        "sev-glow": {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "0.65" },
        },
        "emoji-float": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-2px) scale(1.05)" },
        },
        "stage-icon": {
          "0%, 22%, 100%": { transform: "scale(1)", opacity: "0.55" },
          "5%": { transform: "scale(1.12)", opacity: "1" },
        },
        "core-halo": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.06)" },
        },
        "trace-fill": {
          "0%": { transform: "scaleY(0)", opacity: "0" },
          "10%": { opacity: "1" },
          "34%": { transform: "scaleY(1)", opacity: "1" },
          "48%, 100%": { transform: "scaleY(1)", opacity: "0" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.3s ease-out",
        "alert-pulse": "alert-pulse 0.9s ease-in-out 2",
        shimmer: "shimmer 1.6s infinite",

        "fade-in": "fade-in 0.35s ease-out",
        "card-in": "card-in 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
        "logo-in": "logo-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "shield-ring": "shield-ring 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "packet-travel": "packet-travel 7s linear infinite",
        "node-breathe": "node-breathe 4s ease-in-out infinite",
        "scan-sweep": "scan-sweep 9s ease-in-out infinite",
        "status-in": "status-in 0.28s ease-out",
        "check-in": "check-in 0.36s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "hero-in": "hero-in 0.55s cubic-bezier(0.16, 1, 0.3, 1)",
        "flow-down": "flow-down 3.2s linear infinite",
        "orbit-ring": "orbit-ring 26s linear infinite",

        "wordmark-in": "wordmark-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "wordmark-breathe": "wordmark-breathe 5.5s ease-in-out infinite",

        "mitre-vignette": "mitre-vignette 1400ms ease-out forwards",
        "mitre-pulse-ring": "mitre-pulse-ring 750ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "mitre-tunnel": "mitre-tunnel 750ms ease-out 280ms both",
        "mitre-streak": "mitre-streak 500ms ease-out both",
        "mitre-scan": "mitre-scan 650ms ease-in-out 250ms both",

        "grid-drift": "grid-drift 40s linear infinite",
        "link-breathe": "link-breathe 9s ease-in-out infinite",
        "packet-rtl": "packet-rtl 8s linear infinite",
        "wave-sweep": "wave-sweep 14s ease-in-out infinite",
        "signal-blink": "signal-blink 7s ease-in-out infinite",
        "core-breathe": "core-breathe 4.5s ease-in-out infinite",
        "node-receive": "node-receive 6s ease-in-out infinite",
        "node-dot": "node-dot 6s ease-in-out infinite",
        "trace-fill": "trace-fill 6s ease-in-out infinite",
        "orbit-ccw": "orbit-ccw 1s linear infinite",
        "stage-activate": "stage-activate 6s ease-in-out infinite",
        "stage-glow": "stage-glow 6s ease-in-out infinite",
        "core-halo": "core-halo 6s ease-in-out infinite",
        "core-impact": "core-impact 8s ease-out infinite",
        "stage-fire": "stage-fire 8s ease-in-out infinite",
        "stage-icon": "stage-icon 8s ease-in-out infinite",
        "emoji-float": "emoji-float 3.2s ease-in-out infinite",
        "sev-glow": "sev-glow 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
