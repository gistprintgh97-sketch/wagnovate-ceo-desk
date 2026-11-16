"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "dark" | "light" | "system";
export function applyTheme(t: Theme) {
  document.cookie = `ceo-theme=${t}; path=/; max-age=31536000; samesite=lax`;
  const light = t === "light" || (t === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.className = light ? "light" : "dark";
}
export function currentTheme(): Theme {
  const m = document.cookie.match(/ceo-theme=(\w+)/);
  return (m?.[1] as Theme) ?? "dark";
}

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.classList.contains("light")); }, []);
  return (
    <button
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-panel2 text-accent transition hover:border-accent/60"
      onClick={() => { const next = light ? "dark" : "light"; applyTheme(next); setLight(!light); }}
    >
      {light ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
