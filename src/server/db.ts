import { PrismaClient } from "@prisma/client";

// Models that are soft-deleted. The extension below hides deleted rows from every read automatically,
// so a forgotten "deletedAt: null" can never make removed records leak into totals.
const SOFT = new Set([
  "EngineeringAchievement", "SalesLead", "Customer", "Contract", "CustomerFeedback", "FinancialTransaction", "Invoice",
  "Project", "ProjectMilestone", "Task", "BusinessProblem", "LessonLearned", "StrategicPriority", "UploadedDocument",
]);

function make() {
  const base = new PrismaClient();
  type A = { where?: Record<string, unknown> };
  const hide = <T extends A>(model: string, args: T): T => (SOFT.has(model) ? { ...args, where: { ...(args.where ?? {}), deletedAt: null } } : args);
  return base.$extends({
    query: {
      $allModels: {
        findMany: ({ model, args, query }) => query(hide(model, args)),
        findFirst: ({ model, args, query }) => query(hide(model, args)),
        findUnique: ({ model, args, query }) => query(hide(model, args)),
        count: ({ model, args, query }) => query(hide(model, args)),
        aggregate: ({ model, args, query }) => query(hide(model, args)),
        groupBy: ({ model, args, query }) => query(hide(model, args) as typeof args),
      },
    },
  });
}
const g = globalThis as unknown as { prisma?: ReturnType<typeof make> };
export const db = g.prisma ?? make();
if (process.env.NODE_ENV !== "production") g.prisma = db;
export type DB = typeof db;
