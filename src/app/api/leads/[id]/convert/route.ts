import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { today } from "@/lib/dates";

// Turns a prospect into a customer record (once). The lead keeps a link to the customer it became.
export const POST = route({}, async ({ params }) => {
  const lead = await db.salesLead.findUnique({ where: { id: params.id } });
  if (!lead) throw new AppError(404, "That opportunity no longer exists.");
  if (lead.customerId) throw new AppError(409, "This opportunity has already been converted to a customer.");
  const customer = await db.customer.create({ data: { name: lead.businessName, contactPerson: lead.contactPerson, phone: lead.phone, email: lead.email, product: lead.product, status: "ACTIVE", since: today(), notes: lead.notes } });
  await db.salesLead.update({ where: { id: lead.id }, data: { customerId: customer.id, ...(lead.stage !== "WON" ? { stage: "WON", stageChangedAt: new Date() } : {}) } });
  return { customerId: customer.id };
});
