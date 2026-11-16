// All business dates are "calendar dates" in Africa/Accra, held as UTC-midnight Date objects
// (matching Postgres DATE columns). Ghana has no daylight saving, but we still use Intl for correctness.
export const TZ = "Africa/Accra";
const DAY = 86_400_000;

export function accraParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second };
}
/** Today's calendar date in Accra as a UTC-midnight Date. */
export function today(now = new Date()): Date { const p = accraParts(now); return new Date(Date.UTC(p.y, p.m - 1, p.d)); }
export function addDays(d: Date, n: number): Date { return new Date(d.getTime() + n * DAY); }
export function addMonths(d: Date, n: number): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate())); }
export function iso(d: Date): string { return d.toISOString().slice(0, 10); }
export function parseDate(s: string): Date { const [y, m, dd] = s.slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd)); }
export function diffDays(a: Date, b: Date): number { return Math.round((a.getTime() - b.getTime()) / DAY); }
/** Monday of the week containing d. */
export function weekStart(d: Date): Date { const dow = (d.getUTCDay() + 6) % 7; return addDays(d, -dow); }
export function weekEnd(d: Date): Date { return addDays(weekStart(d), 6); }
export function monthStart(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
export function monthEnd(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); }
export function quarterStart(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1)); }
export function quarterEnd(d: Date): Date { const s = quarterStart(d); return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 3, 0)); }
export function yearStart(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); }
export function yearEnd(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), 11, 31)); }

export type Range = { from: Date; to: Date }; // inclusive calendar dates
export type Preset = "today" | "week" | "month" | "quarter" | "year" | "custom";
export function presetRange(p: Preset, now = today(), custom?: Range): Range {
  switch (p) {
    case "today": return { from: now, to: now };
    case "week": return { from: weekStart(now), to: weekEnd(now) };
    case "month": return { from: monthStart(now), to: monthEnd(now) };
    case "quarter": return { from: quarterStart(now), to: quarterEnd(now) };
    case "year": return { from: yearStart(now), to: yearEnd(now) };
    default: return custom ?? { from: monthStart(now), to: monthEnd(now) };
  }
}
/** The equal-length-style previous period for week/month/quarter/year comparisons. */
export function previousRange(p: Exclude<Preset, "custom" | "today">, r: Range): Range {
  if (p === "week") return { from: addDays(r.from, -7), to: addDays(r.to, -7) };
  if (p === "month") { const f = addMonths(r.from, -1); return { from: f, to: monthEnd(f) }; }
  if (p === "quarter") { const f = addMonths(r.from, -3); return { from: f, to: quarterEnd(f) }; }
  const f = addMonths(r.from, -12); return { from: f, to: yearEnd(f) };
}
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((t.getTime() - firstThu.getTime()) / DAY - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}
export function weekIndex(d: Date): number { return Math.floor(weekStart(d).getTime() / (7 * DAY)); }
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—"; const x = typeof d === "string" ? parseDate(d) : d;
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}
