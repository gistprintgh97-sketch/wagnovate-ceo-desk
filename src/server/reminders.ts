// Server-side reminders (spec section 9). Runs on a schedule inside the server (node-cron) or from an external cron call,
// so it never depends on a browser tab being open. Each reminder carries a unique key, so it can never be sent twice.
import webpush from "web-push";
import { db } from "./db";
import { getSettings } from "./settings";
import { invoiceLedger } from "./ledger";
import { weekIsReviewWeek, reviewInstantForWeek } from "./schedule";
import { accraParts, addDays, diffDays, fmtDate, iso, isoWeekKey, today, weekStart } from "@/lib/dates";
import { ghs, r2 } from "@/lib/money";

const LOCK_ID = 727_001;
let vapidReady = false;
export function pushConfigured(): boolean {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  if (!vapidReady) { webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:ceo@wagnovate.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY); vapidReady = true; }
  return true;
}

export async function sendPush(payload: { title: string; body: string; url?: string; tag?: string }): Promise<number> {
  if (!pushConfigured()) return 0;
  const subs = await db.pushSubscription.findMany();
  let sent = 0;
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload)); sent++; }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {}); }
  }
  return sent;
}

/** Creates a notification once per dedupe key. Returns true if it was newly created. */
export async function notify(n: { type: string; title: string; body: string; link?: string; dedupeKey: string }): Promise<boolean> {
  const r = await db.notification.createMany({ data: [{ type: n.type, title: n.title, body: n.body, link: n.link ?? null, dedupeKey: n.dedupeKey }], skipDuplicates: true });
  if (r.count === 0) return false;
  const sent = await sendPush({ title: n.title, body: n.body, url: n.link ?? "/", tag: n.dedupeKey });
  if (sent) await db.notification.updateMany({ where: { dedupeKey: n.dedupeKey }, data: { pushedAt: new Date() } });
  return true;
}

export const REVIEW_MESSAGE = "Your WAGNOVATE weekly CEO review is due. Review your engineering progress, sales, customer feedback, finances, problems and lessons. Choose your single most important priority for next week.";

export async function runReminders(now = new Date()): Promise<{ ran: boolean; created: string[] }> {
  return db.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${LOCK_ID}) AS locked`;
    if (!locked) return { ran: false, created: [] }; // another instance is already running this job
    return { ran: true, created: await doReminders(now) };
  }, { timeout: 60_000 });
}

async function doReminders(now: Date): Promise<string[]> {
  const s = await getSettings();
  const t = today(now); const created: string[] = [];
  const hour = accraParts(now).hh;
  const wk = isoWeekKey(t);
  const add = async (ok: Promise<boolean>, key: string) => { if (await ok) created.push(key); };

  // Weekly CEO review
  if (s.notifyReview) {
    const ws = weekStart(t);
    if (weekIsReviewWeek(ws, s) && now >= reviewInstantForWeek(ws, s)) {
      const done = await db.cEOReview.findFirst({ where: { weekStart: ws, status: "COMPLETED" } });
      if (!done) await add(notify({ type: "WEEKLY_REVIEW", title: "Weekly CEO review is due", body: REVIEW_MESSAGE, link: "/review", dedupeKey: `weekly-review:${iso(ws)}` }), `weekly-review:${iso(ws)}`);
    }
  }
  if (hour < 8) return created; // daily digests start at 08:00 Accra time

  if (s.notifyTasks) {
    const soon = await db.task.findMany({ where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { gte: t, lte: addDays(t, 1) } } });
    for (const x of soon) { const k = `task-due:${x.id}:${iso(x.dueDate!)}`; await add(notify({ type: "TASK_DUE", title: `Task due ${diffDays(x.dueDate!, t) === 0 ? "today" : "tomorrow"}`, body: x.title, link: "/priorities?tab=tasks", dedupeKey: k }), k); }
    const late = await db.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: t } } });
    if (late) { const k = `tasks-overdue:${iso(t)}`; await add(notify({ type: "TASK_OVERDUE", title: `${late} overdue task${late > 1 ? "s" : ""}`, body: "Complete, reschedule or delete them.", link: "/priorities?tab=tasks&overdue=1", dedupeKey: k }), k); }
  }
  if (s.notifyFollowUps) {
    const [a, b] = await Promise.all([db.salesLead.count({ where: { stage: { notIn: ["WON", "LOST"] }, nextFollowUp: { lte: t } } }), db.customerFeedback.count({ where: { resolution: { in: ["OPEN", "IN_PROGRESS"] }, followUpDate: { lte: t } } })]);
    if (a + b) { const k = `followups:${iso(t)}`; await add(notify({ type: "FOLLOW_UP", title: `${a + b} customer follow-up${a + b > 1 ? "s" : ""} due`, body: `${a} sales and ${b} feedback follow-ups are waiting.`, link: "/sales?followUpDue=1", dedupeKey: k }), k); }
  }
  if (s.notifyInvoices) {
    const od = (await invoiceLedger()).filter((r) => r.overdueDays > 0);
    if (od.length) { const k = `invoices-overdue:${wk}`; await add(notify({ type: "INVOICE", title: `${od.length} unpaid invoice${od.length > 1 ? "s are" : " is"} overdue`, body: `${ghs(r2(od.reduce((x, r) => x + r.outstanding, 0)))} is owed past the due date.`, link: "/finance?tab=invoices&state=overdue", dedupeKey: k }), k); }
  }
  if (s.notifyProblems) {
    const crit = await db.businessProblem.count({ where: { severity: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } });
    if (crit) { const k = `critical-problems:${wk}`; await add(notify({ type: "PROBLEM", title: `${crit} critical problem${crit > 1 ? "s" : ""} unresolved`, body: "Critical problems block progress. Assign an owner and fix date.", link: "/problems", dedupeKey: k }), k); }
  }
  if (s.notifyPriority) {
    const ps = await db.strategicPriority.findMany({ where: { status: { in: ["NOT_STARTED", "IN_PROGRESS", "DELAYED"] }, deadline: { lte: addDays(t, 1) } } });
    for (const p of ps) { const over = p.deadline < t; const k = `priority:${p.id}:${over ? "overdue" : "soon"}`; await add(notify({ type: "PRIORITY", title: over ? "Strategic priority is overdue" : "Strategic priority deadline is near", body: `${p.title} — deadline ${fmtDate(p.deadline)}.`, link: "/priorities", dedupeKey: k }), k); }
  }
  if (s.notifyContracts) {
    const cs = await db.contract.findMany({ where: { status: "ACTIVE", endDate: { gte: t, lte: addDays(t, 30) } }, include: { customer: { select: { name: true } } } });
    for (const c of cs) { const k = `contract:${c.id}:${iso(c.endDate!)}`; await add(notify({ type: "CONTRACT", title: `Contract expires in ${diffDays(c.endDate!, t)} days`, body: `${c.customer.name}: ${c.title}`, link: "/sales?tab=contracts", dedupeKey: k }), k); }
  }
  return created;
}
