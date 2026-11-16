export function ghs(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return "GHS " + v.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function ghsCompact(n: number | null | undefined): string {
  const v = Number(n ?? 0); const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}
/** Round to 2 decimals (pesewas) to stop floating point noise after sums. */
export function r2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }
/** Percentage change. Returns null when it would be misleading (no/zero previous value). */
export function pctChange(curr: number, prev: number | null | undefined): number | null {
  if (prev === null || prev === undefined || prev === 0) return null;
  return r2(((curr - prev) / Math.abs(prev)) * 100);
}
