import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cyber dark theme. We deliberately keep the old token names
        // (parchment, ink, wine, gold, olive, sky) so existing
        // utility classes like chip-wine, btn-primary, text-ink/60
        // pick up the new palette without touching every component.
        parchment: "#0B1220",   // page background (deep slate-navy)
        ink:       "#E5E7EB",   // primary text + subtle outlines via /N opacity
        wine:      "#F472B6",   // accent / danger / view-only chip (magenta-pink)
        gold:      "#FBBF24",   // codes + warm highlights (amber)
        olive:     "#34D399",   // success / mastery (mint)
        sky:       "#22D3EE",   // alt accent (electric cyan)

        // New tokens for the cyber look.
        cyan:      "#22D3EE",   // primary CTA / action accent
        purple:    "#A78BFA",   // secondary accent
        surface:   "#131C30",   // card surface
        surface2:  "#1A2540",   // raised surface (modals, hover)
        line:      "#1F2A44",   // subtle border
        lineStrong:"#2D3957",   // focus / hover border
      },
      fontFamily: {
        // Calibri first (most Office machines), Carlito as a metric-
        // compatible open replacement loaded from Google Fonts, then
        // system fallbacks.
        sans: ['Calibri', 'Carlito', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ["ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.4), 0 0 24px -4px rgba(34,211,238,0.35)",
        ring: "0 0 0 3px rgba(34,211,238,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
