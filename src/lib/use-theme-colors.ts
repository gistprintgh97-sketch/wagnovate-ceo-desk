"use client";
import { useEffect, useState } from "react";

const NAMES = ["accent", "cyan", "good", "warn", "bad", "violet", "fg", "muted", "line", "panel", "panel2", "bg"] as const;
export type ThemeColors = Record<(typeof NAMES)[number], string> & { rgba: (name: (typeof NAMES)[number], a: number) => string };

function read(): Record<string, [number, number, number]> {
  const cs = getComputedStyle(document.documentElement);
  const out: Record<string, [number, number, number]> = {};
  for (const n of NAMES) {
    const parts = cs.getPropertyValue(`--${n}`).trim().split(/\s+/).map(Number);
    out[n] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  return out;
}

function build(raw: Record<string, [number, number, number]>): ThemeColors {
  const o = {} as Record<string, string>;
  for (const n of NAMES) o[n] = `rgb(${raw[n].join(",")})`;
  return { ...(o as Record<(typeof NAMES)[number], string>), rgba: (name, a) => `rgba(${raw[name].join(",")},${a})` };
}

const FALLBACK = build(Object.fromEntries(NAMES.map((n) => [n, [128, 128, 128] as [number, number, number]])));

/** Resolved theme colours (as real colour strings) for Recharts and canvas, updated when the theme changes. */
export function useThemeColors(): ThemeColors {
  const [c, setC] = useState<ThemeColors>(FALLBACK);
  useEffect(() => {
    const update = () => setC(build(read()));
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return c;
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const h = () => setR(m.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return r;
}
