import { z } from "zod";
import { route } from "@/server/api";
import { db } from "@/server/db";

export const GET = route({}, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(100, Number(sp.get("limit") ?? 20));
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const where = sp.get("unread") ? { readAt: null } : {};
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: (page - 1) * limit }),
    db.notification.count({ where }),
    db.notification.count({ where: { readAt: null } }),
  ]);
  return { items, total, unread, page, pageSize: limit };
});

const body = z.object({ action: z.enum(["read", "unread", "readAll"]), id: z.string().optional() });
export const POST = route({ body }, async ({ body }) => {
  if (body.action === "readAll") await db.notification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
  else if (body.id) await db.notification.update({ where: { id: body.id }, data: { readAt: body.action === "read" ? new Date() : null } });
  return { ok: true };
});
