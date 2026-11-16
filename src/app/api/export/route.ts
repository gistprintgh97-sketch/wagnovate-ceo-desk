import { NextResponse } from "next/server";
import { route } from "@/server/api";
import { db } from "@/server/db";

// Full company data export (JSON). Password hashes, sessions and the AI key are never included.
export const GET = route({}, async () => {
  const [company, settings, targets, customers, contracts, invoices, transactions, feedback, leads, projects, milestones, tasks, achievements, problems, lessons, priorities, reviews, notifications, documents] = await Promise.all([
    db.company.findMany(), db.applicationSettings.findMany(), db.target.findMany(), db.customer.findMany(), db.contract.findMany(), db.invoice.findMany(), db.financialTransaction.findMany(), db.customerFeedback.findMany(),
    db.salesLead.findMany(), db.project.findMany(), db.projectMilestone.findMany(), db.task.findMany(), db.engineeringAchievement.findMany(), db.businessProblem.findMany(), db.lessonLearned.findMany(),
    db.strategicPriority.findMany(), db.cEOReview.findMany(), db.notification.findMany(), db.uploadedDocument.findMany(),
  ]);
  const safeSettings = settings.map(({ aiKeyEnc, ...s }) => { void aiKeyEnc; return s; });
  const data = { exportedAt: new Date().toISOString(), note: "Soft-deleted records have deletedAt hidden from the app but are excluded here. Uploaded files are in the storage folder.", company, settings: safeSettings, targets, customers, contracts, invoices, transactions, feedback, leads, projects, milestones, tasks, achievements, problems, lessons, priorities, reviews, notifications, documents };
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 2);
  return new NextResponse(body, { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="wagnovate-ceo-desk-export-${new Date().toISOString().slice(0, 10)}.json"` } });
});
