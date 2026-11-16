import { z } from "zod";
import { route } from "@/server/api";
import { db } from "@/server/db";
import { today } from "@/lib/dates";

export const GET = route({}, async ({ req }) => {
  const year = Number(req.nextUrl.searchParams.get("year") ?? today().getUTCFullYear());
  const rows = await db.target.findMany({ where: { year } });
  return { year, targets: Object.fromEntries(rows.map((r) => [r.category, Number(r.annual)])) };
});

const body = z.object({ year: z.number().int().min(2020).max(2100), category: z.string().min(1).max(60), annual: z.number().min(0).max(1e12) });
// An annual target per product or service. Setting it to 0 removes it.
export const PUT = route({ body }, async ({ body }) => {
  if (body.annual === 0) await db.target.deleteMany({ where: { year: body.year, category: body.category } });
  else await db.target.upsert({ where: { year_category: { year: body.year, category: body.category } }, update: { annual: body.annual }, create: body });
  return { ok: true };
});
