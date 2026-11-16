import { z } from "zod";
import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { pushConfigured } from "@/server/reminders";

const sub = z.object({ endpoint: z.string().url().max(600), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });
export const POST = route({ body: sub }, async ({ user, body }) => {
  if (!pushConfigured()) throw new AppError(400, "Background push is not set up on the server (VAPID keys missing). In-app and open-browser notifications still work.");
  await db.pushSubscription.upsert({ where: { endpoint: body.endpoint }, update: { userId: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth }, create: { userId: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth } });
  return { ok: true };
});
export const DELETE = route({ body: z.object({ endpoint: z.string().url() }) }, async ({ body }) => { await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint } }); return { ok: true }; });
