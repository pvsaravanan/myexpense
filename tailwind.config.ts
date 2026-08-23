import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS variables (see globals.css).
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        fg: "hsl(var(--fg) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        faint: "hsl(var(--faint) / <alpha-value>)",
        brand: "hsl(var(--brand) / <alpha-value>)",
        "brand-fg": "hsl(var(--brand-fg) / <alpha-value>)",
        "brand-soft": "hsl(var(--brand-soft) / <alpha-value>)",
        "brand-hover": "hsl(var(--brand-hover) / <alpha-value>)",
        "brand-light": "hsl(var(--brand-light) / <alpha-value>)",
        "border-faint": "hsl(var(--border-faint) / <alpha-value>)",
        secondary: "hsl(var(--secondary) / <alpha-value>)",
        tertiary: "hsl(var(--tertiary) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        income: "hsl(var(--income) / <alpha-value>)",
        expense: "hsl(var(--expense) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        overlay: "hsl(var(--overlay) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      // Sharp by default. `none` is the system's native corner; md softens cards only.
      borderRadius: {
        none: "0px",
        DEFAULT: "0px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px",
      },
      // Roboto Mono is the entire system, with a mono fallback chain.
      fontFamily: {
        mono: [
          "var(--font-mono)",
          "Roboto Mono",
          "IBM Plex Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        sans: ["var(--font-mono)", "Roboto Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      // The College.xyz type scale, verbatim.
      fontSize: {
        "2xs": ["11px", { lineHeight: "14px", letterSpacing: "0.08em", fontWeight: "700" }],
        "display": ["42px", { lineHeight: "50px", letterSpacing: "-1.04px", fontWeight: "800" }],
        "headline-lg": ["32px", { lineHeight: "38px", letterSpacing: "-0.28px", fontWeight: "800" }],
        "headline-md": ["25px", { lineHeight: "30px", letterSpacing: "-0.19px", fontWeight: "700" }],
        "headline-sm": ["19px", { lineHeight: "23px", letterSpacing: "1px", fontWeight: "700" }],
        "body-lg": ["16px", { lineHeight: "24px" }],
        "body-md": ["15px", { lineHeight: "24px" }],
        "body-sm": ["14px", { lineHeight: "20px" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.02em", fontWeight: "700" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.08em", fontWeight: "700" }],
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.08em", fontWeight: "700" }],
      },
      // The 8/16/24/32/56 modular rhythm.
      spacing: {
        xs: "8px",
        sm: "16px",
        md: "24px",
        lg: "32px",
        xl: "56px",
      },
      // Hard-edged offset shadows only — no blur, no gloss.
      boxShadow: {
        card: "none",
        stamp: "3px 3px 0 0 hsl(var(--shadow))",
        "stamp-sm": "2px 2px 0 0 hsl(var(--shadow))",
        "stamp-lg": "5px 5px 0 0 hsl(var(--shadow))",
        pop: "4px 4px 0 0 hsl(var(--shadow))",
        sheet: "0 -3px 0 0 hsl(var(--shadow))",
        none: "none",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "scale-in": {
          from: { transform: "scale(0.98)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        // Page-content entrance on navigation: a small, decisive rise + fade.
        "enter": {
          from: { transform: "translateY(6px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "slide-up": "slide-up 0.18s ease-out",
        "sheet-up": "sheet-up 0.24s cubic-bezier(0.32, 0.72, 0, 1)",
        "scale-in": "scale-in 0.14s ease-out",
        "enter": "enter 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
