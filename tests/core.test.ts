import { describe, expect, it } from "vitest";
import { pctChange, r2, ghs } from "@/lib/money";
import { addDays, isoWeekKey, parseDate, iso, weekStart, previousRange, presetRange, quarterStart, accraParts } from "@/lib/dates";
import { nextReview, reviewInstantForWeek, weekIsReviewWeek, accraToInstant } from "@/server/schedule";
import { geocode } from "@/config/geo";
import { RESOURCES, buildSchema } from "@/config/resources";
import { ruleSummary, type Facts } from "@/server/summary";
import { completionProblems } from "@/server/review";
import { reportToCsv, type Report } from "@/server/reports";
import { label } from "@/config/enums";

describe("percentage change never misleads", () => {
  it("returns null when the previous value is zero or missing", () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
    expect(pctChange(100, null)).toBeNull();
    expect(pctChange(100, undefined)).toBeNull();
  });
  it("calculates normal and negative changes", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(-50, -100)).toBe(50);
  });
  it("rounds money to pesewas and formats GHS", () => {
    expect(r2(0.1 + 0.2)).toBe(0.3);
    expect(ghs(1234.5)).toBe("GHS 1,234.50");
  });
});

describe("dates (Africa/Accra, Monday weeks)", () => {
  it("finds the Monday of a week", () => {
    expect(iso(weekStart(parseDate("2026-11-15")))).toBe("2026-11-09"); // Sunday belongs to the week that started Monday 9th
    expect(iso(weekStart(parseDate("2026-11-16")))).toBe("2026-11-16");
  });
  it("builds ISO week keys and previous ranges", () => {
    expect(isoWeekKey(parseDate("2026-01-01"))).toBe("2026-W01");
    const r = presetRange("month", parseDate("2026-03-15"));
    expect(iso(r.from)).toBe("2026-03-01");
    expect(iso(previousRange("month", r).from)).toBe("2026-02-01");
    expect(iso(previousRange("month", r).to)).toBe("2026-02-28");
    expect(iso(quarterStart(parseDate("2026-05-20")))).toBe("2026-04-01");
  });
  it("reports Accra wall-clock time", () => {
    const p = accraParts(new Date("2026-11-16T18:30:00Z"));
    expect([p.hh, p.mm]).toEqual([18, 30]); // Ghana is UTC+0 all year
  });
});

describe("weekly review schedule", () => {
  const s = { reviewDay: 0, reviewTime: "18:00", reviewEveryWeeks: 1 };
  it("defaults to Sunday 18:00 Accra of the review week", () => {
    const at = reviewInstantForWeek(parseDate("2026-11-09"), s);
    expect(at.toISOString()).toBe("2026-11-15T18:00:00.000Z");
    expect(accraToInstant(parseDate("2026-11-15"), "18:00").toISOString()).toBe("2026-11-15T18:00:00.000Z");
  });
  it("is not overdue before Sunday evening, and overdue after if not completed", () => {
    const before = nextReview(s, new Set(), new Date("2026-11-15T12:00:00Z"));
    expect(before.overdue).toBe(false);
    expect(before.at.toISOString()).toBe("2026-11-15T18:00:00.000Z");
    const after = nextReview(s, new Set(), new Date("2026-11-15T19:00:00Z"));
    expect(after.overdue).toBe(true);
  });
  it("moves on to next Sunday once the week's review is completed", () => {
    const n = nextReview(s, new Set(["2026-11-09"]), new Date("2026-11-15T19:00:00Z"));
    expect(n.overdue).toBe(false);
    expect(n.at.toISOString()).toBe("2026-11-22T18:00:00.000Z");
  });
  it("supports every-2-weeks", () => {
    const biweekly = { ...s, reviewEveryWeeks: 2 };
    const a = weekIsReviewWeek(parseDate("2026-11-09"), biweekly), b = weekIsReviewWeek(parseDate("2026-11-16"), biweekly);
    expect(a).not.toBe(b);
  });
});

describe("globe geocoding", () => {
  it("matches cities before countries and is accent/case tolerant", () => {
    expect(geocode("Kumasi, Ghana")?.name).toBe("Kumasi");
    expect(geocode("cape coast")?.name).toBe("Cape Coast");
    expect(geocode("somewhere in Nigeria")?.name).toBe("Nigeria");
  });
  it("returns null for unknown or empty locations instead of guessing", () => {
    expect(geocode("Atlantis")).toBeNull();
    expect(geocode("")).toBeNull();
    expect(geocode(null)).toBeNull();
  });
});

describe("validation schemas built from field config", () => {
  const tx = buildSchema(RESOURCES.transactions);
  const ok = { title: "Fee", type: "INCOME", amount: "250.50", category: "CONSULTING", date: "2026-11-01", paymentMethod: "MTN_MOMO" };
  it("accepts a valid transaction and converts numbers", () => {
    const r = tx.parse(ok);
    expect(r.amount).toBe(250.5);
    expect(r.customerId).toBeNull();
  });
  it("rejects negative amounts, bad dates and bad enums with readable messages", () => {
    expect(() => tx.parse({ ...ok, amount: -5 })).toThrow(/cannot be negative/);
    expect(() => tx.parse({ ...ok, date: "01/11/2026" })).toThrow(/valid date/);
    expect(() => tx.parse({ ...ok, paymentMethod: "BITCOIN" })).toThrow(/valid payment method/i);
    expect(() => tx.parse({ ...ok, title: "" })).toThrow(/required/);
  });
  it("limits feedback rating to 1-5", () => {
    const fb = buildSchema(RESOURCES.feedback);
    const base = { customerId: "c1", date: "2026-11-01", category: "POSITIVE", resolution: "OPEN", comments: "Good" };
    expect(fb.parse({ ...base, rating: 5 }).rating).toBe(5);
    expect(() => fb.parse({ ...base, rating: 6 })).toThrow();
    expect(() => fb.parse({ ...base, rating: 0 })).toThrow();
  });
  it("allows partial updates", () => {
    const p = buildSchema(RESOURCES.tasks, true).parse({ status: "DONE" });
    expect(p.status).toBe("DONE");
    expect("title" in p).toBe(false);
  });
});

const emptyCtx = {
  week: { start: "2026-11-09", end: "2026-11-15" },
  engineering: { completed: 0, total: 0, tasksCompleted: 0, items: [], hours: 0 },
  sales: { newLeads: 0, won: [], lost: [], contractsSigned: [], contractValue: 0, pipeline: { stages: [], pipelineValue: 0, activeCount: 0, wonCount: 0, lostCount: 0, wonValue: 0, conversion: null } },
  feedback: { count: 0, avgRating: null, ratedCount: 0, items: [], unresolved: [], repeatedTechnical: [], followUps: [], atRisk: [] },
  finance: { income: 0, expenses: 0, net: 0, transactions: 0, prevIncome: 0, prevExpenses: 0, prevNet: 0, prevTransactions: 0, incomeChangePct: null, expenseChangePct: null, revenueByCategory: [], expensesByCategory: [], outstanding: 0, outstandingCount: 0, overdueAmount: 0, overdueCount: 0 },
  problems: { newThisWeek: [], resolvedThisWeek: [], open: [] },
  lessons: [],
} as unknown as Facts["context"];

describe("executive summary never fabricates", () => {
  it("says nothing was recorded when the week is empty", () => {
    const s = ruleSummary({ context: emptyCtx, narrative: {}, prior: null, next: null });
    expect(s).toMatch(/not recorded|No achievements were recorded|No weaknesses/);
    expect(s).toMatch(/No financial transactions were recorded/);
    expect(s).toMatch(/No priority has been chosen yet/);
    expect(s).not.toMatch(/GHS [1-9]/); // no invented money figures
  });
  it("answers all seven questions in order", () => {
    const s = ruleSummary({ context: emptyCtx, narrative: {}, prior: null, next: null });
    const heads = s.match(/^### .+$/gm) ?? [];
    expect(heads).toHaveLength(7);
    expect(heads[0]).toMatch(/How did the business perform/);
    expect(heads[6]).toMatch(/most important priority/);
  });
  it("uses only recorded figures and does not invent a % without prior data", () => {
    const ctx = { ...emptyCtx, finance: { ...emptyCtx.finance, income: 1000, transactions: 1, expenses: 200 } } as Facts["context"];
    const s = ruleSummary({ context: ctx, narrative: {}, prior: null, next: null });
    expect(s).toMatch(/GHS 1,000\.00/);
    expect(s).toMatch(/no valid comparison/);
  });
});

describe("review completion rules", () => {
  it("requires last week's priority to be assessed, explained when incomplete, and one next priority", () => {
    const prior = { status: "IN_PROGRESS" };
    expect(completionProblems({ priorOutcome: null, priorExplanation: null, priorAction: null }, prior, {})).toHaveLength(1);
    expect(completionProblems({ priorOutcome: "PARTIAL", priorExplanation: null, priorAction: null }, prior, {})).toHaveLength(2);
    expect(completionProblems({ priorOutcome: "PARTIAL", priorExplanation: "Client delayed", priorAction: "RESCHEDULE" }, prior, {})).toHaveLength(0);
    expect(completionProblems({ priorOutcome: "COMPLETED", priorExplanation: null, priorAction: null }, prior, null)).toHaveLength(1);
  });
  it("does not require an assessment when there was no prior priority", () => {
    expect(completionProblems({ priorOutcome: null, priorExplanation: null, priorAction: null }, null, {})).toHaveLength(0);
  });
});

describe("exports", () => {
  it("escapes CSV and adds a BOM", () => {
    const rep: Report = { type: "x", title: "T", subtitle: "S", kpis: [{ label: "A, B", value: 'say "hi"' }], sections: [{ title: "Rows", table: { columns: [{ key: "a", label: "A" }, { key: "m", label: "M", type: "money" }], rows: [{ a: "x,y", m: 12.5 }] } }] };
    const csv = reportToCsv(rep);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"A, B","say ""hi"""');
    expect(csv).toContain('"x,y",12.5');
  });
  it("labels enum values readably", () => {
    expect(label("MTN_MOMO")).toBe("MTN Mobile Money");
    expect(label("WAG_SMS")).toBe("WAG SMS");
    expect(addDays(parseDate("2026-02-27"), 2).toISOString().slice(0, 10)).toBe("2026-03-01");
  });
});
