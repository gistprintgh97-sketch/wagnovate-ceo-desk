import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { anyUserExists, createSession, hashPassword, passwordProblem } from "@/server/auth";
import { ensureInitialProjects, getCompany, getSettings } from "@/server/settings";

const body = z.object({
  token: z.string().min(1, "Enter the setup token from your .env file."),
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string(),
});

export const POST = route({ public: true, body, limit: { key: "setup", max: 10, windowMs: 600_000 } }, async ({ body }) => {
  if (await anyUserExists()) throw new AppError(403, "Setup is already complete. Please sign in.");
  const expected = process.env.SETUP_TOKEN ?? "";
  const a = Buffer.from(body.token);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError(403, "The setup token is not correct. Check SETUP_TOKEN in your .env file.");
  }
  const problem = passwordProblem(body.password);
  if (problem) throw new AppError(400, problem);
  const user = await db.user.create({
    data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password), role: "OWNER" },
  });
  await getCompany();
  await getSettings();
  await ensureInitialProjects();
  await createSession(user.id);
  return { ok: true };
});
