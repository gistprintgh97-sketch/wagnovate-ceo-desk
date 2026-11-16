import { z } from "zod";
import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { sha256 } from "@/server/crypto";
import { hashPassword, passwordProblem } from "@/server/auth";

const body = z.object({ token: z.string().min(10), password: z.string() });

export const POST = route({ public: true, body, limit: { key: "reset", max: 10, windowMs: 900_000 } }, async ({ body }) => {
  const t = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(body.token) } });
  if (!t || t.usedAt || t.expiresAt < new Date()) throw new AppError(400, "This reset link is invalid or has expired. Ask for a new one.");
  const problem = passwordProblem(body.password);
  if (problem) throw new AppError(400, problem);
  await db.$transaction([
    db.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(body.password), failedLogins: 0, lockedUntil: null } }),
    db.passwordResetToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: t.userId } }),
  ]);
  return { ok: true };
});
