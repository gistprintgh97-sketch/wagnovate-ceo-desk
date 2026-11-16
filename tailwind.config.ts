import type { Config } from "tailwindcss";
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { bg: c("bg"), panel: c("panel"), panel2: c("panel2"), line: c("line"), fg: c("fg"), muted: c("muted"), accent: c("accent"), cyan: c("cyan"), good: c("good"), warn: c("warn"), bad: c("bad"), violet: c("violet") },
      fontFamily: { sans: ["Inter Variable", "system-ui", "sans-serif"], mono: ["JetBrains Mono Variable", "ui-monospace", "monospace"] },
      borderRadius: { panel: "14px" },
      boxShadow: { glow: "0 0 0 1px rgb(var(--line) / 1), 0 0 24px -6px rgb(var(--accent) / var(--glow))", soft: "0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.18)" },
      keyframes: { shimmer: { "100%": { transform: "translateX(100%)" } }, pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } } },
      animation: { pulseDot: "pulseDot 2s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
