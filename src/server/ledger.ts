// The ONE place that computes who owes what. Every screen and report calls these functions,
// so totals can never disagree between pages.
import { db } from "./db";
import { r2 } from "@/lib/money";
import { today } from "@/lib/dates";

const num = (d: unknown) => Number(d ?? 0);

export type InvoiceRow = {
  id: string; number: string; customerId: string; customerName: string; contractId: string | null; projectId: string | null;
  amount: number; paid: number; outstanding: number; issueDate: Date; dueDate: Date; overdueDays: number; status: string; category: string;
};

/** All invoices with payments applied. Only SENT invoices create a receivable; DRAFT and CANCELLED never do. */
export async function invoiceLedger(opts: { customerId?: string } = {}): Promise<InvoiceRow[]> {
  const invoices = await db.invoice.findMany({ where: opts.customerId ? { customerId: opts.customerId } : {}, include: { customer: { select: { name: true } } }, orderBy: { issueDate: "desc" } });
  if (!invoices.length) return [];
  const paid = await db.financialTransaction.groupBy({ by: ["invoiceId"], where: { type: "INCOME", invoiceId: { in: invoices.map((i) => i.id) } }, _sum: { amount: true } });
  const paidMap = new Map(paid.map((p) => [p.invoiceId, num(p._sum.amount)]));
  const t = today();
  return invoices.map((i) => {
    const p = paidMap.get(i.id) ?? 0;
    const amount = num(i.amount);
    const outstanding = i.status === "SENT" ? Math.max(0, r2(amount - p)) : 0;
    const overdueDays = outstanding > 0 && i.dueDate < t ? Math.round((t.getTime() - i.dueDate.getTime()) / 864e5) : 0;
    return { id: i.id, number: i.number, customerId: i.customerId, customerName: i.customer.name, contractId: i.contractId, projectId: i.projectId, amount, paid: r2(p), outstanding, issueDate: i.issueDate, dueDate: i.dueDate, overdueDays, status: i.status, category: i.category };
  });
}
export const totalOutstanding = (rows: InvoiceRow[]) => r2(rows.reduce((s, r) => s + r.outstanding, 0));

/** Income received, grouped by a link (customer / contract / project), counting both direct links and links through an invoice. */
export async function incomeBy(kind: "customer" | "contract" | "project", ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const key = (kind + "Id") as "customerId" | "contractId" | "projectId";
  const rows = await db.financialTransaction.findMany({
    where: { type: "INCOME", OR: [{ [key]: { in: ids } }, { invoice: { [key]: { in: ids } } }] },
    select: { id: true, amount: true, customerId: true, contractId: true, projectId: true, invoice: { select: { customerId: true, contractId: true, projectId: true } } },
  });
  for (const r of rows) {
    const k = (r[key] ?? r.invoice?.[key]) as string | null | undefined;
    if (k && ids.includes(k)) out.set(k, r2((out.get(k) ?? 0) + num(r.amount)));
  }
  return out;
}

/** Allowed payment for an invoice (outstanding), excluding one existing transaction when editing it. */
export async function invoiceRemaining(invoiceId: string, excludeTxId?: string): Promise<{ amount: number; paid: number; status: string } | null> {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return null;
  const agg = await db.financialTransaction.aggregate({ where: { type: "INCOME", invoiceId, ...(excludeTxId ? { id: { not: excludeTxId } } : {}) }, _sum: { amount: true } });
  return { amount: num(inv.amount), paid: num(agg._sum.amount), status: inv.status };
}
