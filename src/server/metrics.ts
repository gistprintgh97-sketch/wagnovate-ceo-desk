// Every business number shown anywhere in the app is calculated here, from database records only.
import { db } from "./db";
import { invoiceLedger, totalOutstanding } from "./ledger";
import { r2, pctChange } from "@/lib/money";
import { addDays, addMonths, diffDays, iso, monthStart, today, weekStart, yearStart, type Range } from "@/lib/dates";
import { INCOME_CATEGORIES } from "@/config/enums";

const n = (d: unknown) => Number(d ?? 0);
const inRange = (r: Range) => ({ gte: r.from, lte: r.to });
const ts = (r: Range) => ({ gte: r.from, lt: addDays(r.to, 1) });

export type KPI = { value: number | null; prev: number | null; pct: number | null; deltaPts?: number | null };
const kpi = (value: number | null, prev: number | null, pts = false): KPI =>
  pts
    ? { value, prev, pct: null, deltaPts: value !== null && prev !== null ? r2(value - prev) : null }
    : { value, prev, pct: value !== null ? pctChange(value, prev) : null };

export async function sumTx(r: Range) {
  const g = await db.financialTransaction.groupBy({ by: ["type"], where: { date: inRange(r) }, _sum: { amount: true }, _count: true });
  const income = n(g.find((x) => x.type === "INCOME")?._sum.amount);
  const expense = n(g.find((x) => x.type === "EXPENSE")?._sum.amount);
  const count = g.reduce((s, x) => s + x._count, 0);
  return { income: r2(income), expense: r2(expense), net: r2(income - expense), count };
}

/** Receivable balance on a past date, rebuilt from invoices issued and payments received up to that date. */
export async function outstandingAt(d: Date) {
  const inv = await db.invoice.findMany({ where: { status: "SENT", issueDate: { lte: d } }, select: { id: true, amount: true } });
  if (!inv.length) return { amount: 0, count: 0 };
  const paid = await db.financialTransaction.groupBy({ by: ["invoiceId"], where: { type: "INCOME", invoiceId: { in: inv.map((i) => i.id) }, date: { lte: d } }, _sum: { amount: true } });
  const pm = new Map(paid.map((p) => [p.invoiceId, n(p._sum.amount)]));
  let amount = 0, count = 0;
  for (const i of inv) { const o = Math.max(0, n(i.amount) - (pm.get(i.id) ?? 0)); if (o > 0.004) { amount += o; count++; } }
  return { amount: r2(amount), count };
}

/** Share of invoices issued in the range that has been paid by `asOf`. Null when nothing was invoiced. */
export async function collectionRate(r: Range, asOf: Date): Promise<number | null> {
  const inv = await db.invoice.findMany({ where: { status: "SENT", issueDate: inRange(r) }, select: { id: true, amount: true } });
  const billed = inv.reduce((s, i) => s + n(i.amount), 0);
  if (billed <= 0) return null;
  const paid = await db.financialTransaction.aggregate({ where: { type: "INCOME", invoiceId: { in: inv.map((i) => i.id) }, date: { lte: asOf } }, _sum: { amount: true } });
  return r2(Math.min(100, (n(paid._sum.amount) / billed) * 100));
}

export async function revenueByCategory(r: Range) {
  const g = await db.financialTransaction.groupBy({ by: ["category"], where: { type: "INCOME", date: inRange(r) }, _sum: { amount: true } });
  const labels = new Map(INCOME_CATEGORIES.map((c) => [c.value, c.label]));
  return g.map((x) => ({ key: x.category, label: labels.get(x.category) ?? x.category, amount: r2(n(x._sum.amount)) })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
}

export async function expenseByCategory(r: Range) {
  const g = await db.financialTransaction.groupBy({ by: ["category"], where: { type: "EXPENSE", date: inRange(r) }, _sum: { amount: true } });
  return g.map((x) => ({ key: x.category, amount: r2(n(x._sum.amount)) })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
}

export async function monthlySeries(year: number) {
  const r: Range = { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31)) };
  const [tx, inv] = await Promise.all([
    db.financialTransaction.findMany({ where: { date: inRange(r) }, select: { date: true, type: true, amount: true } }),
    db.invoice.findMany({ where: { status: "SENT", issueDate: inRange(r) }, select: { issueDate: true, amount: true } }),
  ]);
  const months = Array.from({ length: 12 }, (_, m) => ({ month: m, income: 0, expense: 0, invoiced: 0, net: 0 }));
  for (const t of tx) months[t.date.getUTCMonth()][t.type === "INCOME" ? "income" : "expense"] += n(t.amount);
  for (const i of inv) months[i.issueDate.getUTCMonth()].invoiced += n(i.amount);
  for (const m of months) { m.income = r2(m.income); m.expense = r2(m.expense); m.invoiced = r2(m.invoiced); m.net = r2(m.income - m.expense); }
  return months;
}

export async function weeklySeries(weeks: number, now = today()) {
  const first = addDays(weekStart(now), -7 * (weeks - 1));
  const tx = await db.financialTransaction.findMany({ where: { date: { gte: first, lte: addDays(weekStart(now), 6) } }, select: { date: true, type: true, amount: true } });
  const out = Array.from({ length: weeks }, (_, i) => ({ weekStart: iso(addDays(first, i * 7)), income: 0, expense: 0 }));
  for (const t of tx) {
    const idx = Math.floor(diffDays(t.date, first) / 7);
    if (idx >= 0 && idx < weeks) out[idx][t.type === "INCOME" ? "income" : "expense"] += n(t.amount);
  }
  return out.map((w) => ({ ...w, income: r2(w.income), expense: r2(w.expense) }));
}

export async function targetsFor(year: number) {
  const rows = await db.target.findMany({ where: { year } });
  const byCat = new Map<string, number>();
  for (const t of rows) byCat.set(t.category, n(t.annual));
  const catSum = [...byCat.entries()].filter(([k]) => k !== "TOTAL").reduce((s, [, v]) => s + v, 0);
  const total = byCat.get("TOTAL") ?? (catSum > 0 ? catSum : null);
  return { byCat, total };
}

/** Metrics for any date range. Used by the dashboard, comparisons and reports. */
export async function rangeMetrics(r: Range) {
  const [tx, newCustomers, contracts, projectsDone, fb, resolved, prios] = await Promise.all([
    sumTx(r),
    db.customer.count({ where: { status: { not: "PROSPECT" }, OR: [{ since: inRange(r) }, { since: null, createdAt: ts(r) }] } }),
    db.contract.count({ where: { OR: [{ signedDate: inRange(r) }, { signedDate: null, startDate: inRange(r) }] } }),
    db.project.count({ where: { completedAt: inRange(r) } }),
    db.customerFeedback.aggregate({ where: { date: inRange(r), rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
    db.businessProblem.count({ where: { resolvedAt: inRange(r) } }),
    db.strategicPriority.groupBy({ by: ["status"], where: { weekStart: inRange(r) }, _count: true }),
  ]);
  const prioTotal = prios.filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + p._count, 0);
  const prioDone = prios.find((p) => p.status === "COMPLETED")?._count ?? 0;
  return {
    revenue: tx.income, expenses: tx.expense, cashFlow: tx.net, transactions: tx.count,
    newCustomers, contractsSecured: contracts, projectsCompleted: projectsDone,
    satisfaction: fb._count.rating > 0 ? r2(fb._avg.rating ?? 0) : null, ratingsCount: fb._count.rating,
    problemsResolved: resolved, prioritiesAchieved: prioDone, prioritiesSet: prioTotal,
  };
}
export type RangeMetrics = Awaited<ReturnType<typeof rangeMetrics>>;

export async function pipelineSummary() {
  const g = await db.salesLead.groupBy({ by: ["stage"], _count: true, _sum: { value: true } });
  const get = (s: string) => ({ count: g.find((x) => x.stage === s)?._count ?? 0, value: r2(n(g.find((x) => x.stage === s)?._sum.value)) });
  const stages = ["NEW_LEAD", "CONTACTED", "INTERESTED", "DEMO_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"].map((s) => ({ stage: s, ...get(s) }));
  const active = stages.filter((s) => !["WON", "LOST"].includes(s.stage));
  const won = get("WON"), lost = get("LOST");
  return {
    stages, pipelineValue: r2(active.reduce((s, x) => s + x.value, 0)), activeCount: active.reduce((s, x) => s + x.count, 0),
    wonCount: won.count, lostCount: lost.count, wonValue: won.value,
    conversion: won.count + lost.count > 0 ? r2((won.count / (won.count + lost.count)) * 100) : null,
  };
}

export async function getDashboard() {
  const now = new Date();
  const t = today(now);
  const year = t.getUTCFullYear();
  const ytd: Range = { from: yearStart(t), to: t };
  const prevYtd: Range = { from: new Date(Date.UTC(year - 1, 0, 1)), to: new Date(Date.UTC(year - 1, t.getUTCMonth(), t.getUTCDate())) };
  const oneYearAgo = prevYtd.to;
  const ws = weekStart(t);

  const [cur, prev, ledger, outPrev, colCur, colPrev, monthly, targets, byCat, pipeline, weekly,
    activeCust, prevCust, churned, nonProspect, activeProj, projects, leads, custRows, unplottedCount] = await Promise.all([
    rangeMetrics(ytd), rangeMetrics(prevYtd), invoiceLedger(), outstandingAt(oneYearAgo),
    collectionRate(ytd, t), collectionRate(prevYtd, oneYearAgo),
    monthlySeries(year), targetsFor(year), revenueByCategory(ytd), pipelineSummary(), weeklySeries(8, t),
    db.customer.count({ where: { status: { in: ["ACTIVE", "AT_RISK"] } } }),
    db.customer.count({ where: { status: { not: "PROSPECT" }, OR: [{ since: { lte: oneYearAgo } }, { since: null, createdAt: { lt: addDays(oneYearAgo, 1) } }] } }),
    db.customer.count({ where: { status: "CHURNED" } }),
    db.customer.count({ where: { status: { not: "PROSPECT" } } }),
    db.project.count({ where: { status: "ACTIVE" } }),
    db.project.findMany({ where: { startDate: { not: null }, status: { in: ["ACTIVE", "COMPLETED", "ON_HOLD"] } }, orderBy: { startDate: "desc" }, take: 7, select: { id: true, name: true, startDate: true, targetDate: true, completedAt: true, status: true } }),
    db.salesLead.count(),
    db.customer.findMany({ where: { location: { not: null } }, select: { id: true, name: true, location: true, status: true } }),
    db.customer.count({ where: { location: null } }),
  ]);

  // ── KPIs (year to date vs same period last year) ──
  const outstanding = totalOutstanding(ledger);
  const overdue = ledger.filter((r) => r.overdueDays > 0);
  const kpis = {
    revenue: kpi(cur.revenue, prev.revenue), expenses: kpi(cur.expenses, prev.expenses), netCashFlow: kpi(cur.cashFlow, prev.cashFlow),
    collectionRate: kpi(colCur, colPrev, true),
    activeCustomers: kpi(activeCust, prevCust),
    newContracts: kpi(cur.contractsSecured, prev.contractsSecured),
    outstandingInvoices: { ...kpi(outstanding, outPrev.amount), count: ledger.filter((r) => r.outstanding > 0).length, overdueCount: overdue.length, overdueAmount: r2(overdue.reduce((s, r) => s + r.outstanding, 0)) },
    activeProjects: kpi(activeProj, null), completedProjects: kpi(cur.projectsCompleted, prev.projectsCompleted),
  };

  // ── Achievement vs target (year to date, pro-rated by days elapsed) ──
  const dayOfYear = diffDays(t, yearStart(t)) + 1;
  const daysInYear = diffDays(new Date(Date.UTC(year + 1, 0, 1)), yearStart(t));
  const frac = dayOfYear / daysInYear;
  const labelMap = new Map(INCOME_CATEGORIES.map((c) => [c.value, c.label]));
  const achievement = [...targets.byCat.entries()].filter(([k]) => k !== "TOTAL").map(([k, annual]) => {
    const actual = byCat.find((b) => b.key === k)?.amount ?? 0;
    const expected = annual * frac;
    return { key: k, label: labelMap.get(k) ?? k, actual, annual, expected: r2(expected), pct: expected > 0 ? r2((actual / expected) * 100) : null };
  }).sort((a, b) => b.annual - a.annual);

  // ── Revenue trend vs target, with a simple forecast ──
  const curMonth = t.getUTCMonth();
  const recent = monthly.slice(Math.max(0, curMonth - 2), curMonth + 1).map((m) => m.income);
  const avg = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
  const hasRevenue = monthly.some((m) => m.income > 0);
  const monthlyTarget = targets.total ? r2(targets.total / 12) : null;
  const trend = monthly.map((m, i) => ({ month: i, actual: i <= curMonth ? m.income : null, target: monthlyTarget, forecast: hasRevenue && i >= curMonth ? r2(avg) : null }));

  // ── Project delivery days ──
  const delivery = projects.map((p) => {
    const end = p.completedAt ?? t;
    return { id: p.id, name: p.name, status: p.status, days: Math.max(0, diffDays(end, p.startDate!)), target: p.targetDate ? Math.max(1, diffDays(p.targetDate, p.startDate!)) : null };
  });

  // ── Top customers ──
  const custIds = [...new Set(ledger.map((r) => r.customerId))];
  const incomeRows = await db.financialTransaction.groupBy({ by: ["customerId"], where: { type: "INCOME", date: inRange(ytd), customerId: { not: null } }, _sum: { amount: true } });
  const received = new Map(incomeRows.map((x) => [x.customerId!, n(x._sum.amount)]));
  const names = new Map((await db.customer.findMany({ where: { id: { in: [...new Set([...custIds, ...received.keys()])] } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const topCustomers = [...names.keys()].map((id) => {
    const rows = ledger.filter((r) => r.customerId === id);
    return { id, name: names.get(id)!, received: r2(received.get(id) ?? 0), outstanding: r2(rows.reduce((s, r) => s + r.outstanding, 0)), overdueDays: Math.max(0, ...rows.map((r) => r.overdueDays)) };
  }).sort((a, b) => b.outstanding - a.outstanding || b.received - a.received).slice(0, 6);

  // ── Globe ──
  const { geocode, HUB } = await import("@/config/geo");
  const custMoney = new Map<string, { out: number; rec: number }>();
  for (const r of ledger) { const x = custMoney.get(r.customerId) ?? { out: 0, rec: 0 }; x.out += r.outstanding; x.rec += r.paid; custMoney.set(r.customerId, x); }
  const plotted: { id: string; name: string; location: string; place: string; lat: number; lng: number; status: string; outstanding: number; paid: number }[] = [];
  let unplotted = unplottedCount;
  for (const c of custRows) {
    const g = geocode(c.location);
    if (!g) { unplotted++; continue; }
    const m = custMoney.get(c.id);
    plotted.push({ id: c.id, name: c.name, location: c.location!, place: g.name, lat: g.lat, lng: g.lng, status: c.status, outstanding: r2(m?.out ?? 0), paid: r2(m?.rec ?? 0) });
  }

  // ── Business performance row ──
  const wk8 = Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i)));
  const [tasksDone, achDone, newCustRows, projDoneRows, pastPrios] = await Promise.all([
    db.task.findMany({ where: { completedAt: { gte: wk8[0], lt: addDays(ws, 7) } }, select: { completedAt: true } }),
    db.engineeringAchievement.findMany({ where: { status: "COMPLETED", completedAt: { gte: wk8[0], lte: addDays(ws, 6) } }, select: { completedAt: true } }),
    db.customer.findMany({ where: { status: { not: "PROSPECT" }, OR: [{ since: { gte: ytd.from } }, { since: null, createdAt: { gte: ytd.from } }] }, select: { since: true, createdAt: true } }),
    db.project.findMany({ where: { completedAt: inRange(ytd) }, select: { completedAt: true } }),
    db.strategicPriority.findMany({ where: { weekStart: { lt: ws }, status: { not: "CANCELLED" } }, select: { status: true, outcome: true } }),
  ]);
  const productivity = wk8.map((w) => {
    const idx = (d: Date | null) => (d ? Math.floor(diffDays(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), w) / 7) === 0 : false);
    return { weekStart: iso(w), tasks: tasksDone.filter((x) => idx(x.completedAt)).length, shipped: achDone.filter((x) => idx(x.completedAt)).length };
  });
  const perMonth = (rows: (Date | null)[]) => Array.from({ length: 12 }, (_, m) => rows.filter((d) => d && d.getUTCMonth() === m).length);
  const newCustPerMonth = perMonth(newCustRows.map((c) => c.since ?? c.createdAt));
  const projDonePerMonth = perMonth(projDoneRows.map((p) => p.completedAt));
  const prioDone = pastPrios.filter((p) => p.status === "COMPLETED" || p.outcome === "COMPLETED").length;

  return {
    asOf: now.toISOString(), year, ytdLabel: `Jan 1 – today ${year}`,
    kpis, achievement, revenueByCategory: byCat, revenueTotal: cur.revenue, delivery, topCustomers,
    trend, monthly, monthlyTarget, hasTargets: !!targets.total, collections: monthly.map((m) => ({ month: m.month, invoiced: m.invoiced, collected: m.income, net: m.net })),
    globe: { hub: HUB, customers: plotted, unplotted },
    performance: {
      pipeline, weekly, productivity, newCustPerMonth, projDonePerMonth,
      retention: nonProspect > 0 ? r2(((nonProspect - churned) / nonProspect) * 100) : null,
      priorityRate: pastPrios.length ? r2((prioDone / pastPrios.length) * 100) : null, prioritiesDone: prioDone, prioritiesTotal: pastPrios.length,
    },
    counts: { leads, transactions: cur.transactions, customers: nonProspect },
  };
}
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
export { monthStart, addMonths };
