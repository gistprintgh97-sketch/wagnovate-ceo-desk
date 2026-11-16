// Everything the weekly review shows is gathered here, from recorded data only.
import { db } from "./db";
import { invoiceLedger } from "./ledger";
import { expenseByCategory, pipelineSummary, revenueByCategory, sumTx } from "./metrics";
import { r2, pctChange } from "@/lib/money";
import { addDays, iso, today } from "@/lib/dates";

const num = (d: unknown) => Number(d ?? 0);

export async function buildContext(ws: Date) {
  const we = addDays(ws, 6);
  const range = { from: ws, to: we };
  const prev = { from: addDays(ws, -7), to: addDays(ws, -1) };
  const between = { gte: ws, lte: we };
  const t = today();

  const [ach, newLeads, closedLeads, signed, pipeline, fbWeek, unresolved, techRows, followUps, atRisk, thisTx, prevTx, revCat, expCat, ledger,
    newProblems, resolvedProblems, openProblems, lessons, doneTasks] = await Promise.all([
    db.engineeringAchievement.findMany({ where: { completedAt: between }, orderBy: { completedAt: "asc" } }),
    db.salesLead.count({ where: { createdAt: { gte: ws, lt: addDays(we, 1) } } }),
    db.salesLead.findMany({ where: { stage: { in: ["WON", "LOST"] }, stageChangedAt: { gte: ws, lt: addDays(we, 1) } }, select: { businessName: true, stage: true, value: true } }),
    db.contract.findMany({ where: { OR: [{ signedDate: between }, { signedDate: null, startDate: between }] }, include: { customer: { select: { name: true } } } }),
    pipelineSummary(),
    db.customerFeedback.findMany({ where: { date: between }, include: { customer: { select: { name: true } } }, orderBy: { date: "asc" } }),
    db.customerFeedback.findMany({ where: { category: { in: ["COMPLAINT", "BILLING_ISSUE", "TECHNICAL_ISSUE"] }, resolution: { in: ["OPEN", "IN_PROGRESS"] } }, include: { customer: { select: { name: true, id: true } } } }),
    db.customerFeedback.groupBy({ by: ["customerId"], where: { category: "TECHNICAL_ISSUE", date: { gte: addDays(we, -90) } }, _count: true }),
    db.customerFeedback.findMany({ where: { resolution: { in: ["OPEN", "IN_PROGRESS"] }, followUpDate: { lte: we } }, include: { customer: { select: { name: true } } } }),
    db.customer.findMany({ where: { status: "AT_RISK" }, select: { id: true, name: true } }),
    sumTx(range), sumTx(prev), revenueByCategory(range), expenseByCategory(range), invoiceLedger(),
    db.businessProblem.findMany({ where: { identifiedAt: between }, orderBy: { identifiedAt: "asc" } }),
    db.businessProblem.findMany({ where: { resolvedAt: between } }),
    db.businessProblem.findMany({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, orderBy: [{ severity: "desc" }, { identifiedAt: "asc" }] }),
    db.lessonLearned.findMany({ where: { date: between } }),
    db.task.count({ where: { completedAt: { gte: ws, lt: addDays(we, 1) } } }),
  ]);

  const names = new Map((await db.customer.findMany({ where: { id: { in: techRows.map((x) => x.customerId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const rated = fbWeek.filter((f) => f.rating != null);
  const overdue = ledger.filter((r) => r.overdueDays > 0);

  return {
    week: { start: iso(ws), end: iso(we) },
    engineering: {
      completed: ach.filter((a) => a.status === "COMPLETED").length, total: ach.length, tasksCompleted: doneTasks,
      items: ach.map((a) => ({ title: a.title, product: a.projectName, category: a.category, kind: a.kind, status: a.status, date: a.completedAt ? iso(a.completedAt) : null, hours: a.hours ? num(a.hours) : null, impact: a.impact })),
      hours: r2(ach.reduce((s, a) => s + num(a.hours), 0)),
    },
    sales: {
      newLeads, won: closedLeads.filter((l) => l.stage === "WON").map((l) => ({ name: l.businessName, value: num(l.value) })), lost: closedLeads.filter((l) => l.stage === "LOST").map((l) => ({ name: l.businessName, value: num(l.value) })),
      contractsSigned: signed.map((c) => ({ customer: c.customer.name, title: c.title, value: num(c.value) })), contractValue: r2(signed.reduce((s, c) => s + num(c.value), 0)), pipeline,
    },
    feedback: {
      count: fbWeek.length, avgRating: rated.length ? r2(rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length) : null, ratedCount: rated.length,
      items: fbWeek.map((f) => ({ customer: f.customer.name, category: f.category, rating: f.rating, comments: f.comments.slice(0, 160) })),
      unresolved: unresolved.map((f) => ({ customer: f.customer.name, customerId: f.customer.id, category: f.category, severity: f.severity, comments: f.comments.slice(0, 120) })),
      repeatedTechnical: techRows.filter((x) => x._count >= 2).map((x) => ({ customer: names.get(x.customerId) ?? "Customer", count: x._count })),
      followUps: followUps.map((f) => ({ customer: f.customer.name, due: f.followUpDate ? iso(f.followUpDate) : null, action: f.actionRequired })),
      atRisk: atRisk.map((c) => c.name),
    },
    finance: {
      income: thisTx.income, expenses: thisTx.expense, net: thisTx.net, transactions: thisTx.count,
      prevIncome: prevTx.income, prevExpenses: prevTx.expense, prevNet: prevTx.net, prevTransactions: prevTx.count,
      incomeChangePct: prevTx.count ? pctChange(thisTx.income, prevTx.income) : null, expenseChangePct: prevTx.count ? pctChange(thisTx.expense, prevTx.expense) : null,
      revenueByCategory: revCat, expensesByCategory: expCat,
      outstanding: r2(ledger.reduce((s, r) => s + r.outstanding, 0)), outstandingCount: ledger.filter((r) => r.outstanding > 0).length,
      overdueAmount: r2(overdue.reduce((s, r) => s + r.outstanding, 0)), overdueCount: overdue.length,
    },
    problems: {
      newThisWeek: newProblems.map((p) => ({ title: p.title, severity: p.severity, department: p.department, status: p.status })),
      resolvedThisWeek: resolvedProblems.map((p) => ({ title: p.title, lessons: p.lessons })),
      open: openProblems.map((p) => ({ title: p.title, severity: p.severity, status: p.status, department: p.department, daysOpen: Math.round((t.getTime() - p.identifiedAt.getTime()) / 864e5) })),
    },
    lessons: lessons.map((l) => ({ title: l.title, category: l.category, description: l.description.slice(0, 200), action: l.proposedAction })),
  };
}
export type ReviewContext = Awaited<ReturnType<typeof buildContext>>;
