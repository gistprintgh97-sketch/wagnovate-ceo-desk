// Business-intelligence warnings (spec section 21). Every alert comes from recorded data, carries a plain explanation and a recommended next action.
// Empty data never raises a warning on its own, except clearly labelled "Missing information" notices.
import { db } from "./db";
import { invoiceLedger } from "./ledger";
import { monthlySeries, outstandingAt, targetsFor } from "./metrics";
import { getSettings } from "./settings";
import { nextReview, describeSchedule } from "./schedule";
import { ghs, r2 } from "@/lib/money";
import { addDays, diffDays, fmtDate, iso, monthStart, today, weekStart } from "@/lib/dates";
import { label } from "@/config/enums";

export type Alert = { id: string; level: "HIGH" | "MEDIUM" | "INFO"; title: string; explanation: string; action: string; link: string; at: string; missing?: boolean };
const num = (d: unknown) => Number(d ?? 0);
const OPEN_PROBLEM = { status: { notIn: ["RESOLVED", "CLOSED"] as ("RESOLVED" | "CLOSED")[] } };

export async function buildAlerts(now = new Date()): Promise<Alert[]> {
  const t = today(now);
  const out: Alert[] = [];
  const nowIso = now.toISOString();
  const settings = await getSettings();
  const [ledger, monthly, out30, critical, complaints, prios, closedLeads, lateProjects, overdueTasks, contracts, followUps, targets, monthTx, reviews] = await Promise.all([
    invoiceLedger(), monthlySeries(t.getUTCFullYear()), outstandingAt(addDays(t, -30)),
    db.businessProblem.findMany({ where: { severity: "CRITICAL", ...OPEN_PROBLEM }, orderBy: { identifiedAt: "asc" } }),
    db.customerFeedback.findMany({ where: { category: { in: ["COMPLAINT", "TECHNICAL_ISSUE", "BILLING_ISSUE"] }, resolution: { in: ["OPEN", "IN_PROGRESS"] }, date: { gte: addDays(t, -60) } }, include: { customer: { select: { name: true, id: true } } } }),
    db.strategicPriority.findMany({ where: { deadline: { lt: t }, status: { notIn: ["COMPLETED", "CANCELLED"] } }, orderBy: { deadline: "asc" } }),
    db.salesLead.findMany({ where: { stage: { in: ["WON", "LOST"] }, stageChangedAt: { gte: addDays(now, -90) } }, select: { stage: true } }),
    db.project.findMany({ where: { status: "ACTIVE", targetDate: { lt: t } }, orderBy: { targetDate: "asc" } }),
    db.task.findMany({ where: { dueDate: { lt: t }, status: { in: ["TODO", "IN_PROGRESS"] } }, select: { priority: true } }),
    db.contract.findMany({ where: { status: "ACTIVE", endDate: { lte: addDays(t, 30) } }, include: { customer: { select: { name: true } } }, orderBy: { endDate: "asc" } }),
    db.salesLead.count({ where: { stage: { notIn: ["WON", "LOST"] }, nextFollowUp: { lte: t } } }),
    targetsFor(t.getUTCFullYear()),
    db.financialTransaction.count({ where: { date: { gte: monthStart(t), lte: t } } }),
    db.cEOReview.findMany({ where: { status: "COMPLETED" }, select: { weekStart: true } }),
  ]);

  // 1 & 2. Receivables
  const overdue = ledger.filter((r) => r.overdueDays > 0);
  if (overdue.length) {
    const sum = r2(overdue.reduce((s, r) => s + r.outstanding, 0));
    const worst = Math.max(...overdue.map((r) => r.overdueDays));
    out.push({ id: "inv-overdue", level: worst > 30 ? "HIGH" : "MEDIUM", title: `${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} totalling ${ghs(sum)}`,
      explanation: `The oldest is ${worst} days past its due date.`, action: "Call or message the customers today and agree a payment date.", link: "/finance?tab=invoices&state=overdue", at: nowIso });
  }
  const outNow = ledger.reduce((s, r) => s + r.outstanding, 0);
  if (out30.amount > 0 && outNow > out30.amount * 1.2) {
    out.push({ id: "inv-rising", level: "MEDIUM", title: "Outstanding invoices are rising",
      explanation: `Unpaid invoices grew from ${ghs(out30.amount)} thirty days ago to ${ghs(r2(outNow))} now.`, action: "Review which customers are slow to pay and tighten follow-up.", link: "/finance?tab=invoices&state=outstanding", at: nowIso });
  }

  // 3. Expenses exceeding income (this month, and year to date)
  const cm = monthly[t.getUTCMonth()];
  const ytdIncome = monthly.reduce((s, m) => s + m.income, 0), ytdExpense = monthly.reduce((s, m) => s + m.expense, 0);
  if (cm.expense > 0 && cm.expense > cm.income) {
    out.push({ id: "exp-gt-inc", level: ytdExpense > ytdIncome ? "HIGH" : "MEDIUM", title: "Expenses are higher than income this month",
      explanation: `Money paid out is ${ghs(cm.expense)} against ${ghs(cm.income)} received${ytdExpense > ytdIncome ? ", and the same is true for the year so far" : ""}.`,
      action: "Check the largest expense categories and chase unpaid invoices to bring cash in.", link: "/finance?tab=overview", at: nowIso });
  }

  // 4. Declining revenue (last two complete months)
  const m = t.getUTCMonth();
  if (m >= 2) {
    const last = monthly[m - 1].income, before = monthly[m - 2].income;
    if (before > 0 && last < before * 0.85) {
      out.push({ id: "rev-decline", level: "MEDIUM", title: "Revenue declined month over month",
        explanation: `Last month's revenue was ${ghs(last)}, down ${Math.round(((before - last) / before) * 100)}% from ${ghs(before)}.`, action: "Look at which product or customer drove the drop, and plan sales actions for this month.", link: "/finance?tab=overview", at: nowIso });
    }
  }
  // Positive trend (information)
  if (m >= 2 && monthly[m - 1].net > 0 && monthly[m - 2].net > 0) {
    out.push({ id: "cash-positive", level: "INFO", title: "Net cash flow has been positive for 2 consecutive months",
      explanation: `Last two months: ${ghs(monthly[m - 2].net)} and ${ghs(monthly[m - 1].net)}.`, action: "Consider setting aside part of it as a reserve.", link: "/finance?tab=overview", at: nowIso });
  }

  // 5. Critical problems
  for (const p of critical.slice(0, 3)) {
    out.push({ id: `prob-${p.id}`, level: "HIGH", title: `Critical problem unresolved: ${p.title}`, explanation: `Open for ${diffDays(t, p.identifiedAt)} days${p.deadline ? `; resolution deadline ${fmtDate(p.deadline)}` : ""}.`, action: p.solution ? `Proposed solution: ${p.solution.slice(0, 100)}` : "Assign an owner and decide the fix this week.", link: "/problems", at: p.updatedAt.toISOString() });
  }
  if (critical.length > 3) out.push({ id: "prob-more", level: "HIGH", title: `${critical.length - 3} more critical problems are unresolved`, explanation: "Critical items block progress.", action: "Open Problems and resolve or reprioritise them.", link: "/problems", at: nowIso });

  // 6. Repeated customer complaints
  const byCust = new Map<string, { name: string; n: number; latest: Date }>();
  for (const f of complaints) { const x = byCust.get(f.customerId) ?? { name: f.customer.name, n: 0, latest: f.date }; x.n++; if (f.date > x.latest) x.latest = f.date; byCust.set(f.customerId, x); }
  for (const [id, c] of byCust) if (c.n >= 2) out.push({ id: `fb-${id}`, level: "HIGH", title: `${c.name} has ${c.n} unresolved complaints or issues`, explanation: "Repeated unresolved issues in the last 60 days put this customer at risk of leaving.", action: "Call the customer personally and agree a fix date.", link: `/customers?customer=${id}`, at: c.latest.toISOString() });

  // 7. Overdue strategic priority
  for (const p of prios.slice(0, 2)) out.push({ id: `prio-${p.id}`, level: "HIGH", title: `Strategic priority is overdue: ${p.title}`, explanation: `Deadline was ${fmtDate(p.deadline)} and it is marked ${label(p.status).toLowerCase()}.`, action: "Finish it, reschedule it or cancel it at your weekly review.", link: "/priorities", at: nowIso });

  // 8. Low sales conversion
  const won = closedLeads.filter((l) => l.stage === "WON").length;
  if (closedLeads.length >= 5 && (won / closedLeads.length) * 100 < settings.lowConversionPct) {
    out.push({ id: "conv-low", level: "MEDIUM", title: "Sales conversion is low", explanation: `Only ${won} of ${closedLeads.length} deals closed in the last 90 days were won (${Math.round((won / closedLeads.length) * 100)}%, below your ${settings.lowConversionPct}% alert level).`, action: "Review why deals are being lost and adjust the pitch or pricing.", link: "/sales", at: nowIso });
  }

  // 9. Project delays
  for (const p of lateProjects.slice(0, 3)) {
    const late = diffDays(t, p.targetDate!);
    out.push({ id: `proj-${p.id}`, level: late > 30 ? "HIGH" : "MEDIUM", title: `Project is ${late} days past its target date: ${p.name}`, explanation: `Target date was ${fmtDate(p.targetDate)} and the project is still active.`, action: "Update the target date with the customer or add resources.", link: "/engineering?tab=projects", at: nowIso });
  }

  // Tasks, contracts, follow-ups
  if (overdueTasks.length) out.push({ id: "tasks-overdue", level: overdueTasks.some((x) => x.priority === "URGENT") ? "HIGH" : "MEDIUM", title: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}`, explanation: "These tasks passed their due date and are not done.", action: "Complete, reschedule or delete them.", link: "/priorities?tab=tasks&overdue=1", at: nowIso });
  for (const c of contracts.slice(0, 3)) {
    const d = diffDays(c.endDate!, t);
    out.push({ id: `ctr-${c.id}`, level: "MEDIUM", title: d < 0 ? `Contract expired: ${c.customer.name}` : `Contract expires in ${d} days: ${c.customer.name}`, explanation: `"${c.title}" ends ${fmtDate(c.endDate)}.`, action: "Start the renewal conversation.", link: "/sales?tab=contracts", at: nowIso });
  }
  if (followUps) out.push({ id: "followups", level: followUps >= 5 ? "MEDIUM" : "INFO", title: `${followUps} sales follow-up${followUps > 1 ? "s" : ""} due`, explanation: "Prospects are waiting for your next contact.", action: "Work through the follow-ups, starting with the highest value.", link: "/sales?followUpDue=1", at: nowIso });

  // Review reminder
  const done = new Set(reviews.map((r) => iso(r.weekStart)));
  const nr = nextReview(settings, done, now);
  if (nr.overdue) out.push({ id: "review-due", level: "INFO", title: "Your weekly CEO review is due", explanation: `Scheduled ${describeSchedule(settings)}.`, action: "Complete the seven-step review and choose next week's priority.", link: "/review", at: nr.at.toISOString() });

  // Clearly labelled missing information (never a false alarm)
  if (t.getUTCDate() >= 7 && monthTx === 0) out.push({ id: "missing-tx", level: "INFO", missing: true, title: "Missing information: no transactions recorded this month", explanation: "Income and expense figures may be incomplete.", action: "Record this month's income and expenses.", link: "/finance?tab=transactions", at: nowIso });
  if (!targets.total) out.push({ id: "missing-targets", level: "INFO", missing: true, title: "Missing information: no revenue targets set", explanation: "Achievement-versus-target charts cannot be calculated.", action: "Set annual targets in Settings.", link: "/settings?tab=targets", at: nowIso });

  const rank = { HIGH: 0, MEDIUM: 1, INFO: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level] || b.at.localeCompare(a.at));
}

type Item = { id: string; title: string; sub?: string; link: string; tone?: "red" | "orange" | "blue" };
export async function getActionCentre(now = new Date()) {
  const t = today(now);
  const ws = weekStart(t);
  const settings = await getSettings();
  const [todayTasks, overdue, upcomingTasks, milestones, followLeads, followFb, ledger, problems, reviews, draft, current] = await Promise.all([
    db.task.findMany({ where: { dueDate: t, status: { in: ["TODO", "IN_PROGRESS"] } }, orderBy: { priority: "desc" }, take: 6 }),
    db.task.findMany({ where: { dueDate: { lt: t }, status: { in: ["TODO", "IN_PROGRESS"] } }, orderBy: { dueDate: "asc" }, take: 6 }),
    db.task.findMany({ where: { dueDate: { gt: t, lte: addDays(t, 7) }, status: { in: ["TODO", "IN_PROGRESS"] } }, orderBy: { dueDate: "asc" }, take: 6 }),
    db.projectMilestone.findMany({ where: { doneAt: null, dueDate: { gte: t, lte: addDays(t, 14) } }, include: { project: { select: { name: true } } }, orderBy: { dueDate: "asc" }, take: 4 }),
    db.salesLead.findMany({ where: { stage: { notIn: ["WON", "LOST"] }, nextFollowUp: { lte: t } }, orderBy: { nextFollowUp: "asc" }, take: 6 }),
    db.customerFeedback.findMany({ where: { resolution: { in: ["OPEN", "IN_PROGRESS"] }, followUpDate: { lte: t } }, include: { customer: { select: { name: true } } }, orderBy: { followUpDate: "asc" }, take: 6 }),
    invoiceLedger(),
    db.businessProblem.findMany({ where: { severity: { in: ["HIGH", "CRITICAL"] }, ...OPEN_PROBLEM }, orderBy: [{ severity: "desc" }, { identifiedAt: "asc" }], take: 6 }),
    db.cEOReview.findMany({ where: { status: "COMPLETED" }, select: { weekStart: true } }),
    db.cEOReview.findFirst({ where: { status: "DRAFT" }, orderBy: { weekStart: "desc" } }),
    db.strategicPriority.findFirst({ where: { OR: [{ weekStart: ws }, { weekStart: { lt: ws }, deadline: { gte: t }, status: { in: ["NOT_STARTED", "IN_PROGRESS", "DELAYED"] } }] }, orderBy: { weekStart: "desc" } }),
  ]);
  const nr = nextReview(settings, new Set(reviews.map((r) => iso(r.weekStart))), now);
  const unpaid = ledger.filter((r) => r.outstanding > 0);
  const overdueInv = unpaid.filter((r) => r.overdueDays > 0);
  const deadlines: Item[] = [
    ...upcomingTasks.map((x) => ({ id: x.id, title: x.title, sub: `Task · due ${fmtDate(x.dueDate)}`, link: "/priorities?tab=tasks" })),
    ...milestones.map((x) => ({ id: x.id, title: `${x.title} — ${x.project.name}`, sub: `Milestone · due ${fmtDate(x.dueDate)}`, link: "/engineering?tab=projects" })),
  ];
  const followUps: Item[] = [
    ...followLeads.map((x) => ({ id: x.id, title: x.businessName, sub: `Lead follow-up since ${fmtDate(x.nextFollowUp)}`, link: "/sales" })),
    ...followFb.map((x) => ({ id: x.id, title: x.customer.name, sub: `Feedback follow-up since ${fmtDate(x.followUpDate)}`, link: "/customers?tab=feedback" })),
  ];
  return {
    today: todayTasks.map((x): Item => ({ id: x.id, title: x.title, sub: `${label(x.priority)} priority`, link: "/priorities?tab=tasks" })),
    overdue: overdue.map((x): Item => ({ id: x.id, title: x.title, sub: `Due ${fmtDate(x.dueDate)} · ${diffDays(t, x.dueDate!)} days late`, link: "/priorities?tab=tasks&overdue=1", tone: "red" })),
    deadlines, followUps,
    invoices: { unpaidCount: unpaid.length, unpaidAmount: r2(unpaid.reduce((s, r) => s + r.outstanding, 0)), overdueCount: overdueInv.length, overdueAmount: r2(overdueInv.reduce((s, r) => s + r.outstanding, 0)) },
    problems: problems.map((x): Item => ({ id: x.id, title: x.title, sub: `${label(x.severity)} · ${label(x.status)} · ${diffDays(t, x.identifiedAt)} days open`, link: "/problems", tone: x.severity === "CRITICAL" ? "red" : "orange" })),
    review: { at: nr.at.toISOString(), overdue: nr.overdue, weekStart: iso(nr.weekStart), schedule: describeSchedule(settings), draftId: draft?.id ?? null },
    priority: current ? { id: current.id, title: current.title, category: current.category, status: current.status, deadline: iso(current.deadline), objective: current.objective, firstAction: current.firstAction, weekStart: iso(current.weekStart), overdue: current.deadline < t && !["COMPLETED", "CANCELLED"].includes(current.status) } : null,
  };
}
export { num };
