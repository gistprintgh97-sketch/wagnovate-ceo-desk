import { z } from "zod";
import { route } from "@/server/api";
import { db } from "@/server/db";
import { createOrGetReview } from "@/server/review";

export const GET = route({}, async () => {
  const rows = await db.cEOReview.findMany({ orderBy: { weekStart: "desc" }, take: 200, select: { id: true, weekStart: true, weekEnd: true, status: true, currentStep: true, completedAt: true, summarySource: true, priorOutcome: true } });
  const prios = await db.strategicPriority.findMany({ where: { weekStart: { in: rows.map((r) => new Date(r.weekStart.getTime() + 7 * 864e5)) } }, select: { weekStart: true, title: true } });
  return { items: rows.map((r) => ({ ...r, nextPriority: prios.find((p) => p.weekStart.getTime() === r.weekStart.getTime() + 7 * 864e5)?.title ?? null })) };
});

const body = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
export const POST = route({ body }, async ({ body }) => createOrGetReview(body.weekStart));
