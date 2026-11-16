// One report engine feeds the on-screen reports, CSV export and PDF export, so the three can never disagree.
import { db } from "./db";
import { invoiceLedger } from "./ledger";
import { expenseByCategory, pipelineSummary, rangeMetrics, revenueByCategory, sumTx, type RangeMetrics } from "./metrics";
import { r2, pctChange, ghs } from "@/lib/money";
import { MONTHS, addDays, diffDays, fmtDate, iso, parseDate, presetRange, previousRange, today, type Preset, type Range } from "@/lib/dates";
import { ALL_TX_CATEGORIES, label } from "@/config/enums";
import type { Block, PdfSpec } from "./pdf";

const num = (d: unknown) => Number(d ?? 0);
const catLabel = new Map(ALL_TX_CATEGORIES.map((c) => [c.value, c.label]));

export function resolveRange(sp: URLSearchParams): { range: Range; preset: Preset } {
  const from = sp.get("from"), to = sp.get("to");
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const f = parseDate(from), t = parseDate(to);
    return { range: f <= t ? { from: f, to: t } : { from: t, to: f }, preset: "custom" };
  }
  const p = (["today", "week", "month", "quarter", "year"].includes(sp.get("preset") ?? "") ? sp.get("preset") : "month") as Preset;
  const anchor = sp.get("anchor") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("anchor")!) ? parseDate(sp.get("anchor")!) : today();
  return { range: presetRange(p, anchor), preset: p };
}

export type Column = { key: string; label: string; type?: "money" | "date" | "text" | "number" | "percent" };
export type Section = {
  title: string; note?: string;
  chart?: { kind: "bar" | "line" | "pie"; x: string; series: { key: string; label: string }[]; data: Record<string, string | number | null>[]; money?: boolean };
  table?: { columns: Column[]; rows: Record<string, string | number | null>[] };
};
export type Report = { type: string; title: string; subtitle: string; kpis: { label: string; value: string; sub?: string }[]; sections: Section[] };

const sub = (r: Range) => `${fmtDate(r.from)} – ${fmtDate(r.to)}`;

/** Income / expense over time: daily for short ranges, monthly for longer ones. */
export async function timeSeries(r: Range) {
  const tx = await db.financialTransaction.findMany({ where: { date: { gte: r.from, lte: r.to } }, select: { date: true, type: true, amount: true } });
  const daily = diffDays(r.to, r.from) <= 62;
  const map = new Map<string, { label: string; income: number; expense: number; sort: string }>();
  if (daily) for (let d = r.from; d <= r.to; d = addDays(d, 1)) map.set(iso(d), { label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, income: 0, expense: 0, sort: iso(d) });
  else for (let y = r.from.getUTCFullYear(), m = r.from.getUTCMonth(); y < r.to.getUTCFullYear() || (y === r.to.getUTCFullYear() && m <= r.to.getUTCMonth()); m++) {
    if (m > 11) { m = 0; y++; if (y > r.to.getUTCFullYear()) break; }
    const k = `${y}-${String(m + 1).padStart(2, "0")}`; map.set(k, { label: `${MONTHS[m]} ${String(y).slice(2)}`, income: 0, expense: 0, sort: k });
  }
  for (const t of tx) {
    const k = daily ? iso(t.date) : iso(t.date).slice(0, 7);
    const row = map.get(k); if (row) row[t.type === "INCOME" ? "income" : "expense"] += num(t.amount);
  }
  return { daily, rows: [...map.values()].sort((a, b) => a.sort.localeCompare(b.sort)).map((x) => ({ label: x.label, income: r2(x.income), expense: r2(x.expense), net: r2(x.income - x.expense) })) };
}

export async function financeOverview(r: Range, preset: Preset) {
  const len = diffDays(r.to, r.from) + 1;
  const prev: Range = preset !== "custom" && preset !== "today" ? previousRange(preset, r) : { from: addDays(r.from, -len), to: addDays(r.from, -1) };
  const [cur, pr, series, rev, exp, ledger] = await Promise.all([sumTx(r), sumTx(prev), timeSeries(r), revenueByCategory(r), expenseByCategory(r), invoiceLedger()]);
  // month-by-month summary with growth only where the previous month had income
  const monthly = series.daily ? [] : series.rows.map((m, i, a) => ({ month: m.label, income: m.income, expense: m.expense, net: m.net, growth: i > 0 && a[i - 1].income > 0 ? pctChange(m.income, a[i - 1].income) : null }));
  const hasPrev = pr.count > 0;
  return {
    range: { from: iso(r.from), to: iso(r.to) }, prevRange: { from: iso(prev.from), to: iso(prev.to) }, preset, daily: series.daily,
    totals: { income: cur.income, expense: cur.expense, net: cur.net, count: cur.count, prevIncome: pr.income, prevExpense: pr.expense, prevNet: pr.net, incomeChange: hasPrev ? pctChange(cur.income, pr.income) : null, expenseChange: hasPrev ? pctChange(cur.expense, pr.expense) : null },
    series: series.rows, monthly,
    revenueByCategory: rev, expenseByCategory: exp.map((e) => ({ ...e, label: catLabel.get(e.key) ?? e.key })),
    outstanding: ledger.filter((l) => l.outstanding > 0).sort((a, b) => b.overdueDays - a.overdueDays || b.outstanding - a.outstanding).slice(0, 15).map((l) => ({ id: l.id, number: l.number, customer: l.customerName, outstanding: l.outstanding, amount: l.amount, dueDate: iso(l.dueDate), overdueDays: l.overdueDays })),
  };
}

const METRICS: { key: keyof RangeMetrics; label: string; money?: boolean; goodUp?: boolean }[] = [
  { key: "revenue", label: "Revenue", money: true }, { key: "expenses", label: "Expenses", money: true }, { key: "cashFlow", label: "Net cash flow", money: true },
  { key: "newCustomers", label: "New customers" }, { key: "contractsSecured", label: "Contracts secured" }, { key: "projectsCompleted", label: "Projects completed" },
  { key: "satisfaction", label: "Customer satisfaction (avg /5)" }, { key: "problemsResolved", label: "Problems resolved" }, { key: "prioritiesAchieved", label: "Strategic priorities achieved" },
];

/** Period-over-period comparison (spec section 14). Percentages are null when mathematically meaningless. */
export async function compare(mode: "week" | "month" | "quarter" | "year", anchor = today()) {
  const cur = presetRange(mode, anchor); const prev = previousRange(mode, cur);
  const [a, b] = await Promise.all([rangeMetrics(cur), rangeMetrics(prev)]);
  const rows = METRICS.map((m) => {
    const c = a[m.key] as number | null, p = b[m.key] as number | null;
    let pct: number | null = null, note: string | null = null;
    if (c === null || p === null) note = "No data recorded in one of the periods";
    else if (p === 0) note = c === 0 ? "No change (both zero)" : "Previous period was zero, so no percentage can be calculated";
    else pct = pctChange(c, p);
    return { key: m.key, label: m.label, money: !!m.money, current: c, previous: p, change: c !== null && p !== null ? r2(c - p) : null, pct, note };
  });
  return { mode, current: { from: iso(cur.from), to: iso(cur.to) }, previous: { from: iso(prev.from), to: iso(prev.to) }, rows };
}

const money = (n: number) => ghs(n);

export async function buildReport(type: string, r: Range, preset: Preset): Promise<Report> {
  const base = { type, subtitle: sub(r) };
  switch (type) {
    case "weekly": case "monthly": case "quarterly": case "annual": {
      const mode = ({ weekly: "week", monthly: "month", quarterly: "quarter", annual: "year" } as const)[type];
      const cmp = await compare(mode, r.from);
      const fo = await financeOverview(parseRange(cmp.current), mode);
      const cur = cmp.rows;
      return { ...base, title: { weekly: "Weekly CEO performance", monthly: "Monthly business performance", quarterly: "Quarterly business performance", annual: "Annual business performance" }[type], subtitle: `${fmtDate(parseDate(cmp.current.from))} – ${fmtDate(parseDate(cmp.current.to))} compared with ${fmtDate(parseDate(cmp.previous.from))} – ${fmtDate(parseDate(cmp.previous.to))}`,
        kpis: [{ label: "Revenue", value: money(cur[0].current ?? 0) }, { label: "Expenses", value: money(cur[1].current ?? 0) }, { label: "Net cash flow", value: money(cur[2].current ?? 0) }, { label: "New customers", value: String(cur[3].current ?? 0) }],
        sections: [
          { title: "Income and expenses", chart: { kind: "bar", x: "label", money: true, series: [{ key: "income", label: "Income" }, { key: "expense", label: "Expenses" }], data: fo.series }, },
          { title: "Comparison with the previous period", note: "Percentages are shown only when the previous period had a non-zero value.", table: { columns: [{ key: "label", label: "Measure" }, { key: "current", label: "This period", type: "number" }, { key: "previous", label: "Previous", type: "number" }, { key: "pct", label: "Change", type: "percent" }, { key: "note", label: "Note" }], rows: cur.map((x) => ({ label: x.label, current: x.current, previous: x.previous, pct: x.pct, note: x.note })) } },
          { title: "Revenue by product or service", chart: { kind: "pie", x: "label", money: true, series: [{ key: "amount", label: "Revenue" }], data: fo.revenueByCategory.map((x) => ({ label: x.label, amount: x.amount })) }, table: { columns: [{ key: "label", label: "Category" }, { key: "amount", label: "Revenue", type: "money" }], rows: fo.revenueByCategory.map((x) => ({ label: x.label, amount: x.amount })) } },
        ] };
    }
    case "revenue-expense": {
      const fo = await financeOverview(r, preset);
      const tx = await db.financialTransaction.findMany({ where: { date: { gte: r.from, lte: r.to } }, include: { customer: { select: { name: true } } }, orderBy: { date: "asc" }, take: 1000 });
      return { ...base, title: "Revenue and expense analysis", kpis: [{ label: "Income received", value: money(fo.totals.income) }, { label: "Expenses paid", value: money(fo.totals.expense) }, { label: "Net cash flow", value: money(fo.totals.net), sub: "Cash in minus cash out (not profit)" }, { label: "Transactions", value: String(fo.totals.count) }],
        sections: [
          { title: "Income versus expenses", chart: { kind: "bar", x: "label", money: true, series: [{ key: "income", label: "Income" }, { key: "expense", label: "Expenses" }], data: fo.series } },
          { title: "Revenue by product or service", table: { columns: [{ key: "label", label: "Category" }, { key: "amount", label: "Income", type: "money" }], rows: fo.revenueByCategory.map((x) => ({ label: x.label, amount: x.amount })) } },
          { title: "Expenses by category", chart: { kind: "pie", x: "label", money: true, series: [{ key: "amount", label: "Expenses" }], data: fo.expenseByCategory.map((x) => ({ label: x.label, amount: x.amount })) }, table: { columns: [{ key: "label", label: "Category" }, { key: "amount", label: "Expenses", type: "money" }], rows: fo.expenseByCategory.map((x) => ({ label: x.label, amount: x.amount })) } },
          { title: "All transactions", table: { columns: [{ key: "date", label: "Date", type: "date" }, { key: "title", label: "Title" }, { key: "type", label: "Type" }, { key: "category", label: "Category" }, { key: "method", label: "Method" }, { key: "customer", label: "Customer" }, { key: "amount", label: "Amount", type: "money" }], rows: tx.map((t) => ({ date: iso(t.date), title: t.title, type: label(t.type), category: catLabel.get(t.category) ?? t.category, method: label(t.paymentMethod), customer: t.customer?.name ?? "", amount: num(t.amount) })) } },
        ] };
    }
    case "pipeline": {
      const [pl, leads] = await Promise.all([pipelineSummary(), db.salesLead.findMany({ orderBy: [{ stage: "asc" }, { value: "desc" }] })]);
      return { ...base, subtitle: "Current pipeline (as of today)", title: "Sales pipeline analysis", kpis: [{ label: "Open pipeline value", value: money(pl.pipelineValue) }, { label: "Open opportunities", value: String(pl.activeCount) }, { label: "Won", value: `${pl.wonCount} · ${money(pl.wonValue)}` }, { label: "Win rate", value: pl.conversion === null ? "No closed deals" : `${pl.conversion}%` }],
        sections: [{ title: "Opportunities by stage", chart: { kind: "bar", x: "label", series: [{ key: "count", label: "Opportunities" }], data: pl.stages.map((s) => ({ label: label(s.stage), count: s.count, value: s.value })) } },
          { title: "Value by stage", table: { columns: [{ key: "label", label: "Stage" }, { key: "count", label: "Count", type: "number" }, { key: "value", label: "Value", type: "money" }], rows: pl.stages.map((s) => ({ label: label(s.stage), count: s.count, value: s.value })) } },
          { title: "All opportunities", table: { columns: [{ key: "name", label: "Business" }, { key: "product", label: "Product" }, { key: "stage", label: "Stage" }, { key: "value", label: "Value", type: "money" }, { key: "followUp", label: "Next follow-up", type: "date" }], rows: leads.map((l) => ({ name: l.businessName, product: l.product ?? "", stage: label(l.stage), value: num(l.value), followUp: l.nextFollowUp ? iso(l.nextFollowUp) : null })) } }] };
    }
    case "satisfaction": {
      const fb = await db.customerFeedback.findMany({ where: { date: { gte: r.from, lte: r.to } }, include: { customer: { select: { name: true } } }, orderBy: { date: "asc" } });
      const rated = fb.filter((f) => f.rating != null);
      const dist = [1, 2, 3, 4, 5].map((n) => ({ label: `${n} star${n > 1 ? "s" : ""}`, count: rated.filter((f) => f.rating === n).length }));
      const byCat = [...new Set(fb.map((f) => f.category))].map((c) => ({ label: label(c), count: fb.filter((f) => f.category === c).length }));
      return { ...base, title: "Customer satisfaction", kpis: [{ label: "Feedback records", value: String(fb.length) }, { label: "Average rating", value: rated.length ? `${r2(rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length)}/5` : "No ratings recorded" }, { label: "Unresolved", value: String(fb.filter((f) => ["OPEN", "IN_PROGRESS"].includes(f.resolution)).length) }],
        sections: [{ title: "Rating distribution", chart: { kind: "bar", x: "label", series: [{ key: "count", label: "Ratings" }], data: dist } }, { title: "Feedback by category", chart: { kind: "pie", x: "label", series: [{ key: "count", label: "Feedback" }], data: byCat } },
          { title: "Feedback", table: { columns: [{ key: "date", label: "Date", type: "date" }, { key: "customer", label: "Customer" }, { key: "category", label: "Category" }, { key: "rating", label: "Rating", type: "number" }, { key: "status", label: "Status" }, { key: "comments", label: "Comments" }], rows: fb.map((f) => ({ date: iso(f.date), customer: f.customer.name, category: label(f.category), rating: f.rating, status: label(f.resolution), comments: f.comments })) } }] };
    }
    case "project-delivery": {
      const ps = await db.project.findMany({ include: { customer: { select: { name: true } } }, orderBy: { startDate: "desc" } });
      const t = today();
      const rows = ps.map((p) => { const end = p.completedAt ?? t; const planned = p.startDate && p.targetDate ? diffDays(p.targetDate, p.startDate) : null; const actual = p.startDate ? diffDays(end, p.startDate) : null; return { name: p.name, customer: p.customer?.name ?? "", status: label(p.status), start: p.startDate ? iso(p.startDate) : null, target: p.targetDate ? iso(p.targetDate) : null, done: p.completedAt ? iso(p.completedAt) : null, planned, actual, variance: planned !== null && actual !== null && p.status !== "PLANNING" ? actual - planned : null, budget: num(p.budget) }; });
      return { ...base, subtitle: "All projects (as of today)", title: "Project delivery", kpis: [{ label: "Active", value: String(ps.filter((p) => p.status === "ACTIVE").length) }, { label: "Completed", value: String(ps.filter((p) => p.status === "COMPLETED").length) }, { label: "Past target date", value: String(ps.filter((p) => p.status === "ACTIVE" && p.targetDate && p.targetDate < t).length) }],
        sections: [{ title: "Planned versus actual days", chart: { kind: "bar", x: "name", series: [{ key: "planned", label: "Planned days" }, { key: "actual", label: "Actual days" }], data: rows.filter((x) => x.planned !== null && x.actual !== null).slice(0, 12).map((x) => ({ name: x.name.slice(0, 18), planned: x.planned, actual: x.actual })) }, },
          { title: "Projects", table: { columns: [{ key: "name", label: "Project" }, { key: "customer", label: "Customer" }, { key: "status", label: "Status" }, { key: "target", label: "Target", type: "date" }, { key: "done", label: "Completed", type: "date" }, { key: "variance", label: "Days late (+) / early (−)", type: "number" }, { key: "budget", label: "Budget", type: "money" }], rows } }] };
    }
    case "priority-completion": {
      const ps = await db.strategicPriority.findMany({ where: { weekStart: { gte: r.from, lte: r.to } }, orderBy: { weekStart: "asc" } });
      const done = ps.filter((p) => p.status === "COMPLETED").length; const closed = ps.filter((p) => p.status !== "CANCELLED").length;
      const byStatus = [...new Set(ps.map((p) => p.status))].map((s) => ({ label: label(s), count: ps.filter((p) => p.status === s).length }));
      return { ...base, title: "Strategic priority completion", kpis: [{ label: "Priorities set", value: String(ps.length) }, { label: "Completed", value: String(done) }, { label: "Completion rate", value: closed ? `${r2((done / closed) * 100)}%` : "No priorities in range" }],
        sections: [{ title: "Status of priorities", chart: { kind: "pie", x: "label", series: [{ key: "count", label: "Priorities" }], data: byStatus } }, { title: "Priorities", table: { columns: [{ key: "week", label: "Week of", type: "date" }, { key: "title", label: "Priority" }, { key: "category", label: "Category" }, { key: "status", label: "Status" }, { key: "outcome", label: "Outcome" }, { key: "note", label: "Explanation" }], rows: ps.map((p) => ({ week: iso(p.weekStart), title: p.title, category: label(p.category), status: label(p.status), outcome: p.outcome ? label(p.outcome) : "", note: p.outcomeNote ?? "" })) } }] };
    }
    case "outstanding-invoices": {
      const led = (await invoiceLedger()).filter((l) => l.outstanding > 0);
      const bucket = (d: number) => (d <= 0 ? "Not yet due" : d <= 30 ? "1–30 days" : d <= 60 ? "31–60 days" : d <= 90 ? "61–90 days" : "Over 90 days");
      const order = ["Not yet due", "1–30 days", "31–60 days", "61–90 days", "Over 90 days"];
      const ageing = order.map((b) => ({ label: b, amount: r2(led.filter((l) => bucket(l.overdueDays) === b).reduce((s, l) => s + l.outstanding, 0)) }));
      return { ...base, subtitle: "As of today", title: "Outstanding invoices", kpis: [{ label: "Total outstanding", value: money(r2(led.reduce((s, l) => s + l.outstanding, 0))) }, { label: "Unpaid invoices", value: String(led.length) }, { label: "Overdue", value: money(r2(led.filter((l) => l.overdueDays > 0).reduce((s, l) => s + l.outstanding, 0))) }],
        sections: [{ title: "Ageing", chart: { kind: "bar", x: "label", money: true, series: [{ key: "amount", label: "Outstanding" }], data: ageing }, }, { title: "Invoices", table: { columns: [{ key: "number", label: "Invoice" }, { key: "customer", label: "Customer" }, { key: "issue", label: "Issued", type: "date" }, { key: "due", label: "Due", type: "date" }, { key: "days", label: "Days overdue", type: "number" }, { key: "amount", label: "Invoice", type: "money" }, { key: "paid", label: "Paid", type: "money" }, { key: "outstanding", label: "Outstanding", type: "money" }], rows: led.sort((a, b) => b.overdueDays - a.overdueDays).map((l) => ({ number: l.number, customer: l.customerName, issue: iso(l.issueDate), due: iso(l.dueDate), days: l.overdueDays, amount: l.amount, paid: l.paid, outstanding: l.outstanding })) } }] };
    }
    default: throw new Error("Unknown report");
  }
}
const parseRange = (x: { from: string; to: string }): Range => ({ from: parseDate(x.from), to: parseDate(x.to) });

export const REPORT_TYPES = [
  { id: "weekly", label: "Weekly CEO performance", period: true }, { id: "monthly", label: "Monthly business performance", period: true }, { id: "quarterly", label: "Quarterly business performance", period: true }, { id: "annual", label: "Annual business performance", period: true },
  { id: "revenue-expense", label: "Revenue and expense analysis" }, { id: "pipeline", label: "Sales pipeline analysis" }, { id: "satisfaction", label: "Customer satisfaction" }, { id: "project-delivery", label: "Project delivery" }, { id: "priority-completion", label: "Priority completion" }, { id: "outstanding-invoices", label: "Outstanding invoices" },
];

const fmtCell = (v: string | number | null, t?: Column["type"]): string => {
  if (v === null || v === undefined || v === "") return "";
  if (t === "money") return money(Number(v));
  if (t === "date") return fmtDate(String(v));
  if (t === "percent") return `${Number(v) > 0 ? "+" : ""}${v}%`;
  return String(v);
};

export function reportToCsv(rep: Report): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines: string[] = [esc("WAGNOVATE Technologies"), esc(rep.title), esc(rep.subtitle), "", ...rep.kpis.map((k) => `${esc(k.label)},${esc(k.value)}`)];
  for (const s of rep.sections) {
    if (!s.table) continue;
    lines.push("", esc(s.title), s.table.columns.map((c) => esc(c.label)).join(","));
    for (const row of s.table.rows) lines.push(s.table.columns.map((c) => esc(c.type === "money" || c.type === "number" || c.type === "percent" ? String(row[c.key] ?? "") : fmtCell(row[c.key], c.type))).join(","));
  }
  return "﻿" + lines.join("\r\n"); // BOM so Excel opens UTF-8 correctly
}

export function reportToPdf(rep: Report): PdfSpec {
  const blocks: Block[] = [{ t: "kv", rows: rep.kpis.map((k) => [k.label, k.sub ? `${k.value}  (${k.sub})` : k.value] as [string, string]) }];
  for (const s of rep.sections) {
    blocks.push({ t: "h2", text: s.title });
    if (s.note) blocks.push({ t: "p", text: s.note });
    if (s.table) blocks.push({ t: "table", columns: s.table.columns.map((c) => ({ label: c.label, align: c.type === "money" || c.type === "number" || c.type === "percent" ? "right" : "left", width: c.key === "comments" || c.key === "title" || c.key === "name" ? 2 : 1 })), rows: s.table.rows.map((row) => s.table!.columns.map((c) => fmtCell(row[c.key], c.type))) });
    else if (s.chart) blocks.push({ t: "table", columns: [{ label: s.chart.x === "label" ? "Item" : s.chart.x }, ...s.chart.series.map((x) => ({ label: x.label, align: "right" as const }))], rows: s.chart.data.map((d) => [String(d[s.chart!.x] ?? ""), ...s.chart!.series.map((x) => (s.chart!.money ? money(Number(d[x.key] ?? 0)) : String(d[x.key] ?? 0)))]) });
  }
  return { title: rep.title, subtitle: rep.subtitle, blocks };
}
