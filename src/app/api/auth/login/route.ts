import { z } from "zod";
import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { createSession, hashPassword, verifyPassword } from "@/server/auth";

const body = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});
let dummy: Promise<string> | null = null;

export const POST = route({ public: true, body, limit: { key: "login", max: 10, windowMs: 600_000 } }, async ({ body }) => {
  const user = await db.user.findUnique({ where: { email: body.email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(429, "Too many wrong passwords. This account is locked for 15 minutes.");
  }
  dummy ??= hashPassword("dummy-password-for-timing");
  const ok = await verifyPassword(user?.passwordHash ?? (await dummy), body.password);
  if (!user || !ok) {
    if (user) {
      const fails = user.failedLogins + 1;
      await db.user.update({
        where: { id: user.id },
        data: { failedLogins: fails, lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
      });
    }
    throw new AppError(401, "Email or password is not correct.");
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  return { ok: true };
});
