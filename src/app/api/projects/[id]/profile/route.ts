import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { r2 } from "@/lib/money";
import { incomeBy } from "@/server/ledger";

export const GET = route({}, async ({ params }) => {
  const project = await db.project.findUnique({ where: { id: params.id }, include: { customer: { select: { id: true, name: true } } } });
  if (!project) throw new AppError(404, "That project no longer exists.");
  const [milestones, tasks, tx, problems, achievements, received] = await Promise.all([
    db.projectMilestone.findMany({ where: { projectId: project.id }, orderBy: { dueDate: "asc" } }),
    db.task.findMany({ where: { projectId: project.id }, orderBy: { dueDate: "asc" } }),
    db.financialTransaction.findMany({ where: { projectId: project.id }, orderBy: { date: "desc" }, take: 50 }),
    db.businessProblem.findMany({ where: { projectId: project.id } }),
    db.engineeringAchievement.findMany({ where: { projectId: project.id }, orderBy: { completedAt: "desc" } }),
    incomeBy("project", [project.id]),
  ]);
  const income = received.get(project.id) ?? 0;
  const expenses = r2(tx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0));
  const budget = Number(project.budget);
  const mDone = milestones.filter((m) => m.doneAt).length;
  const tDone = tasks.filter((t) => t.status === "DONE").length, tTotal = tasks.filter((t) => t.status !== "CANCELLED").length;
  return {
    project, milestones, tasks, transactions: tx, problems, achievements,
    finance: { budget, received: income, outstanding: Math.max(0, r2(budget - income)), expenses, margin: r2(income - expenses) },
    progress: project.status === "COMPLETED" ? 100 : milestones.length ? Math.round((mDone / milestones.length) * 100) : tTotal ? Math.round((tDone / tTotal) * 100) : 0,
  };
});
