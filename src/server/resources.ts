/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma delegates are looked up by name from the resource config */
import { db } from "./db";
import { AppError } from "./api";
import { RESOURCES, REL_TITLE, buildSchema, type ResourceDef } from "@/config/resources";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/config/enums";
import { invoiceLedger, incomeBy, invoiceRemaining } from "./ledger";
import { r2 } from "@/lib/money";
import { parseDate, today, weekStart, iso } from "@/lib/dates";

export function getDef(key: string): ResourceDef {
  const d = RESOURCES[key];
  if (!d) throw new AppError(404, "Unknown record type.");
  return d;
}
const delegate = (def: ResourceDef) => (db as any)[def.model];
const relIncludes = (def: ResourceDef) =>
  Object.fromEntries(def.fields.filter((f) => f.type === "relation").map((f) => [f.rel!, { select: { id: true, [REL_TITLE[f.relation!]]: true } }]));

/** Convert validated form values into what Prisma expects. */
function toPrisma(def: ResourceDef, data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (!(f.key in data)) continue;
    let v = data[f.key];
    if (v === null && f.default !== undefined && f.type !== "relation") v = f.default;
    if (f.type === "date" && typeof v === "string") v = parseDate(v);
    out[f.key] = v;
  }
  return out;
}

function decorateLabels(def: ResourceDef, item: any) {
  const labels: Record<string, string> = {};
  for (const f of def.fields) if (f.type === "relation" && item[f.rel!]) labels[f.key] = item[f.rel!][REL_TITLE[f.relation!]];
  const { ...rest } = item;
  for (const f of def.fields) if (f.type === "relation") delete rest[f.rel!];
  return { ...rest, _labels: labels };
}

/** Adds computed money columns (paid / outstanding / progress) for list screens. */
async function addComputed(def: ResourceDef, items: any[]) {
  if (!items.length || !def.computed) return items;
  const ids = items.map((i) => i.id);
  if (def.key === "invoices") {
    const led = new Map((await invoiceLedger()).map((r) => [r.id, r]));
    const t = today();
    return items.map((i) => {
      const r = led.get(i.id);
      const state = i.status === "DRAFT" ? "Draft" : i.status === "CANCELLED" ? "Cancelled" : !r ? "—" : r.outstanding === 0 ? "Paid" : r.overdueDays > 0 ? `Overdue ${r.overdueDays}d` : new Date(i.dueDate) < t ? "Due" : "Awaiting payment";
      return { ...i, _paid: r?.paid ?? 0, _outstanding: r?.outstanding ?? 0, _state: state };
    });
  }
  if (def.key === "contracts") {
    const paid = await incomeBy("contract", ids);
    return items.map((i) => { const p = paid.get(i.id) ?? 0; return { ...i, _paid: p, _outstanding: Math.max(0, r2(Number(i.value) - p)) }; });
  }
  if (def.key === "customers") {
    const paid = await incomeBy("customer", ids);
    const led = await invoiceLedger();
    return items.map((i) => ({ ...i, _received: paid.get(i.id) ?? 0, _paid: paid.get(i.id) ?? 0, _outstanding: r2(led.filter((r) => r.customerId === i.id).reduce((s, r) => s + r.outstanding, 0)) }));
  }
  if (def.key === "projects") {
    const rec = await incomeBy("project", ids);
    const ms = await db.projectMilestone.groupBy({ by: ["projectId", "doneAt"], where: { projectId: { in: ids } }, _count: true });
    const tk = await db.task.groupBy({ by: ["projectId", "status"], where: { projectId: { in: ids } }, _count: true });
    return items.map((i) => {
      const r = rec.get(i.id) ?? 0;
      const mTotal = ms.filter((m) => m.projectId === i.id).reduce((s, m) => s + m._count, 0);
      const mDone = ms.filter((m) => m.projectId === i.id && m.doneAt).reduce((s, m) => s + m._count, 0);
      const tTotal = tk.filter((m) => m.projectId === i.id && m.status !== "CANCELLED").reduce((s, m) => s + m._count, 0);
      const tDone = tk.filter((m) => m.projectId === i.id && m.status === "DONE").reduce((s, m) => s + m._count, 0);
      const progress = i.status === "COMPLETED" ? 100 : mTotal ? Math.round((mDone / mTotal) * 100) : tTotal ? Math.round((tDone / tTotal) * 100) : 0;
      return { ...i, _received: r, _outstanding: Math.max(0, r2(Number(i.budget) - r)), _progress: progress };
    });
  }
  return items;
}

export async function listRecords(def: ResourceDef, sp: URLSearchParams) {
  const where: Record<string, unknown> = {};
  const and: any[] = [];
  const q = sp.get("q")?.trim();
  if (q) {
    const textKeys = def.search.filter((k) => ["text", "textarea", "email", "phone"].includes(def.fields.find((f) => f.key === k)?.type ?? "text"));
    and.push({ OR: textKeys.map((k) => ({ [k]: { contains: q, mode: "insensitive" } })) });
  }
  for (const f of def.fields) {
    const v = sp.get(`f_${f.key}`);
    if (v && (f.filter || f.type === "relation" || f.type === "select")) and.push({ [f.key]: v.includes(",") ? { in: v.split(",") } : v });
  }
  const from = sp.get("from"), to = sp.get("to");
  if (def.dateField && (from || to)) and.push({ [def.dateField]: { ...(from ? { gte: parseDate(from) } : {}), ...(to ? { lte: parseDate(to) } : {}) } });
  const t = today();
  if (def.key === "tasks") {
    if (sp.get("overdue")) and.push({ dueDate: { lt: t }, status: { in: ["TODO", "IN_PROGRESS"] } });
    if (sp.get("open")) and.push({ status: { in: ["TODO", "IN_PROGRESS"] } });
  }
  if (def.key === "problems" && sp.get("open")) and.push({ status: { notIn: ["RESOLVED", "CLOSED"] } });
  if (def.key === "leads" && sp.get("active")) and.push({ stage: { notIn: ["WON", "LOST"] } });
  if (def.key === "leads" && sp.get("followUpDue")) and.push({ nextFollowUp: { lte: t }, stage: { notIn: ["WON", "LOST"] } });
  if (def.key === "feedback" && sp.get("open")) and.push({ resolution: { in: ["OPEN", "IN_PROGRESS"] } });
  if (and.length) where.AND = and;

  const sortKey = sp.get("sort");
  const allowed = new Set([...def.fields.map((f) => f.key), "createdAt", "updatedAt"]);
  const orderBy = sortKey && allowed.has(sortKey) ? { [sortKey]: sp.get("dir") === "desc" ? "desc" : "asc" } : def.orderBy;
  const include = relIncludes(def);

  if (sp.get("options")) {
    const rows = await delegate(def).findMany({ where, select: { id: true, [def.titleField]: true }, orderBy: { [def.titleField]: "asc" }, take: 500 });
    return { options: rows.map((r: any) => ({ id: r.id, label: String(r[def.titleField]).slice(0, 80) })) };
  }

  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? 25)));

  // Invoice "state" filter depends on payments, so it is applied on the computed ledger.
  const state = def.key === "invoices" ? sp.get("state") : null;
  if (state) {
    const led = await invoiceLedger();
    const ids = led.filter((r) => (state === "outstanding" ? r.outstanding > 0 : state === "overdue" ? r.overdueDays > 0 : state === "paid" ? r.status === "SENT" && r.outstanding === 0 : true)).map((r) => r.id);
    and.push({ id: { in: ids } }); where.AND = and;
  }
  const [total, rows] = await Promise.all([
    delegate(def).count({ where }),
    delegate(def).findMany({ where, include, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const items = (await addComputed(def, rows)).map((r: any) => decorateLabels(def, r));
  return { items, total, page, pageSize };
}

export async function getRecord(def: ResourceDef, id: string) {
  const r = await delegate(def).findUnique({ where: { id }, include: relIncludes(def) });
  if (!r) throw new AppError(404, "That record no longer exists.");
  return decorateLabels(def, (await addComputed(def, [r]))[0]);
}

// ───────── business rules (run before create/update) ─────────
async function applyRules(def: ResourceDef, data: Record<string, any>, existing: any | null) {
  const merged = { ...(existing ?? {}), ...data };
  const now = new Date();
  switch (def.key) {
    case "tasks":
      if ("status" in data) data.completedAt = data.status === "DONE" ? existing?.completedAt ?? now : null;
      break;
    case "projects":
      if (merged.status === "COMPLETED" && !merged.completedAt) data.completedAt = today();
      if (merged.startDate && merged.targetDate && merged.targetDate < merged.startDate) throw new AppError(400, "The target completion date cannot be before the start date.");
      break;
    case "problems":
      if (["RESOLVED", "CLOSED"].includes(merged.status) && !merged.resolvedAt) data.resolvedAt = today();
      if (merged.resolvedAt && merged.resolvedAt < merged.identifiedAt) throw new AppError(400, "The resolution date cannot be before the date identified.");
      break;
    case "leads":
      if (!existing || ("stage" in data && data.stage !== existing.stage)) data.stageChangedAt = now;
      break;
    case "contracts":
      if (merged.endDate && merged.endDate < merged.startDate) throw new AppError(400, "The contract end date cannot be before the start date.");
      break;
    case "feedback":
      if (merged.rating != null && (merged.rating < 1 || merged.rating > 5)) throw new AppError(400, "Rating must be between 1 and 5.");
      break;
    case "priorities": {
      const ws = weekStart(merged.weekStart);
      data.weekStart = ws;
      if (merged.deadline < ws) throw new AppError(400, "The deadline cannot be before the week starts.");
      break;
    }
    case "invoices": {
      if (merged.dueDate < merged.issueDate) throw new AppError(400, "The due date cannot be before the issue date.");
      if (!merged.number) {
        const year = merged.issueDate.getUTCFullYear();
        const last = await db.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } });
        let n = last + 1, num = "";
        do { num = `INV-${year}-${String(n++).padStart(4, "0")}`; } while (await db.invoice.findFirst({ where: { number: num } }));
        data.number = num;
      }
      if (existing) {
        const rem = await invoiceRemaining(existing.id);
        if (rem && Number(merged.amount) < rem.paid) throw new AppError(400, `This invoice already has GHS ${rem.paid.toFixed(2)} paid against it. The amount cannot be lower than that.`);
      }
      break;
    }
    case "transactions": {
      const valid = (merged.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => c.value);
      if (!valid.includes(merged.category)) throw new AppError(400, `That category belongs to ${merged.type === "INCOME" ? "expenses" : "income"}. Choose ${merged.type === "INCOME" ? "an income" : "an expense"} category.`);
      if (merged.invoiceId) {
        if (merged.type !== "INCOME") throw new AppError(400, "Only income can be linked to an invoice.");
        const rem = await invoiceRemaining(merged.invoiceId, existing?.id);
        if (!rem) throw new AppError(400, "That invoice does not exist.");
        if (rem.status !== "SENT") throw new AppError(400, "Payments can only be recorded against invoices that have been sent.");
        if (r2(Number(merged.amount)) > r2(rem.amount - rem.paid) + 0.001) throw new AppError(400, `This payment (GHS ${Number(merged.amount).toFixed(2)}) is more than the invoice balance (GHS ${r2(rem.amount - rem.paid).toFixed(2)}). Record the extra as separate income.`);
        if (!merged.customerId) { const inv = await db.invoice.findUnique({ where: { id: merged.invoiceId } }); if (inv) data.customerId = inv.customerId; }
      }
      if (Number(merged.amount) <= 0) throw new AppError(400, "The amount must be more than zero.");
      break;
    }
  }
}

async function checkDelete(def: ResourceDef, id: string) {
  if (def.key === "invoices") {
    if (await db.financialTransaction.count({ where: { invoiceId: id } })) throw new AppError(409, "This invoice has payments recorded against it. Remove or re-link those payments first, or set the invoice to Cancelled.");
  }
  if (def.key === "customers") {
    const [c, i, t] = await Promise.all([db.contract.count({ where: { customerId: id } }), db.invoice.count({ where: { customerId: id } }), db.financialTransaction.count({ where: { customerId: id } })]);
    if (c + i + t) throw new AppError(409, "This customer has contracts, invoices or payments, so it cannot be deleted. Set the status to Churned instead.");
  }
  if (def.key === "projects") {
    if (await db.financialTransaction.count({ where: { projectId: id } })) throw new AppError(409, "This project has income or expenses recorded. Set its status to Cancelled or Completed instead of deleting it.");
  }
}

export async function createRecord(def: ResourceDef, raw: unknown) {
  const parsed = buildSchema(def).parse(raw) as Record<string, any>;
  const data = toPrisma(def, parsed);
  await applyRules(def, data, null);
  try {
    const created = await delegate(def).create({ data, include: relIncludes(def) });
    return decorateLabels(def, created);
  } catch (e: any) {
    if (e?.code === "P2002" && def.uniqueMessage) throw new AppError(409, def.uniqueMessage);
    throw e;
  }
}

export async function updateRecord(def: ResourceDef, id: string, raw: unknown) {
  const existing = await delegate(def).findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "That record no longer exists.");
  const parsed = buildSchema(def, true).parse(raw) as Record<string, any>;
  const data = toPrisma(def, parsed);
  await applyRules(def, data, existing);
  try {
    const updated = await delegate(def).update({ where: { id }, data, include: relIncludes(def) });
    return decorateLabels(def, updated);
  } catch (e: any) {
    if (e?.code === "P2002" && def.uniqueMessage) throw new AppError(409, def.uniqueMessage);
    throw e;
  }
}

export async function deleteRecord(def: ResourceDef, id: string) {
  const existing = await delegate(def).findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "That record no longer exists.");
  await checkDelete(def, id);
  await delegate(def).update({ where: { id }, data: { deletedAt: new Date() } }); // soft delete: history is preserved
  return { ok: true };
}
export { iso };
