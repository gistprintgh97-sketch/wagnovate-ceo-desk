import { z } from "zod";
import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth";

const body = z.object({ current: z.string(), next: z.string() });

export const POST = route({ body, limit: { key: "chpw", max: 8, windowMs: 900_000 } }, async ({ user, body }) => {
  if (!(await verifyPassword(user.passwordHash, body.current))) throw new AppError(400, "Your current password is not correct.");
  const problem = passwordProblem(body.next);
  if (problem) throw new AppError(400, problem);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.next) } });
  return { ok: true };
});
