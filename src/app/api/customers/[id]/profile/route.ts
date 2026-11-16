import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { incomeBy, invoiceLedger } from "@/server/ledger";
import { r2 } from "@/lib/money";

export const GET = route({}, async ({ params }) => {
  const customer = await db.customer.findUnique({ where: { id: params.id } });
  if (!customer) throw new AppError(404, "That customer no longer exists.");
  const [contracts, invoices, payments, projects, feedback, documents, contractPaid] = await Promise.all([
    db.contract.findMany({ where: { customerId: customer.id }, orderBy: { startDate: "desc" } }),
    invoiceLedger({ customerId: customer.id }),
    db.financialTransaction.findMany({ where: { customerId: customer.id, type: "INCOME" }, orderBy: { date: "desc" }, take: 50, include: { invoice: { select: { number: true } } } }),
    db.project.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" } }),
    db.customerFeedback.findMany({ where: { customerId: customer.id }, orderBy: { date: "desc" }, take: 50 }),
    db.uploadedDocument.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" } }),
    incomeBy("contract", (await db.contract.findMany({ where: { customerId: params.id }, select: { id: true } })).map((c) => c.id)),
  ]);
  const paid = await incomeBy("customer", [customer.id]);
  return {
    customer,
    totals: { paid: paid.get(customer.id) ?? 0, outstanding: r2(invoices.reduce((s, i) => s + i.outstanding, 0)), contractValue: r2(contracts.filter((c) => c.status === "ACTIVE").reduce((s, c) => s + Number(c.value), 0)) },
    contracts: contracts.map((c) => ({ ...c, paid: contractPaid.get(c.id) ?? 0, balance: Math.max(0, r2(Number(c.value) - (contractPaid.get(c.id) ?? 0))) })),
    invoices, payments, projects, feedback,
    support: feedback.filter((f) => ["COMPLAINT", "TECHNICAL_ISSUE", "BILLING_ISSUE"].includes(f.category)),
    documents,
  };
});
