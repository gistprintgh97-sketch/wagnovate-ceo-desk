import { accraParts, addDays, today, weekIndex, weekStart, TZ } from "@/lib/dates";

type Sched = { reviewDay: number; reviewTime: string; reviewEveryWeeks: number };

/** Converts a wall-clock time in Africa/Accra to a real instant. */
export function accraToInstant(date: Date, hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hh, mm);
  const p = accraParts(new Date(guess));
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  return new Date(guess - (asUtc - guess)); // corrects for the zone offset (0 for Accra, but kept correct in general)
}

/** The review for the week starting `ws` is held on `reviewDay` (0 = Sunday) of that Monday-Sunday week. */
export function reviewInstantForWeek(ws: Date, s: Sched): Date {
  const offset = (s.reviewDay + 6) % 7;
  return accraToInstant(addDays(ws, offset), s.reviewTime);
}

export function weekIsReviewWeek(ws: Date, s: Sched): boolean {
  return s.reviewEveryWeeks <= 1 || weekIndex(ws) % s.reviewEveryWeeks === 0;
}

/**
 * Which review is next?
 * - `weekStart` is the week that review covers.
 * - `at` is when it is due.
 * - `overdue` is true if that time has passed and the review for that week is not completed.
 */
export function nextReview(s: Sched, completedWeekStarts: Set<string>, now = new Date()): { weekStart: Date; at: Date; overdue: boolean } {
  let ws = weekStart(today(now));
  for (let i = 0; i < 6; i++) {
    if (weekIsReviewWeek(ws, s)) {
      const at = reviewInstantForWeek(ws, s);
      const done = completedWeekStarts.has(ws.toISOString().slice(0, 10));
      if (!done && at.getTime() >= now.getTime()) return { weekStart: ws, at, overdue: false };
      if (!done && at.getTime() < now.getTime() && i === 0) return { weekStart: ws, at, overdue: true };
    }
    ws = addDays(ws, 7);
  }
  const at = reviewInstantForWeek(ws, s);
  return { weekStart: ws, at, overdue: false };
}

export function describeSchedule(s: Sched): string {
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][s.reviewDay];
  const [h, m] = s.reviewTime.split(":").map(Number);
  const t = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  return `${s.reviewEveryWeeks > 1 ? `Every ${s.reviewEveryWeeks} weeks on` : "Every"} ${day} at ${t} (${TZ})`;
}
