import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";

export const COOKIE = "ceo_session";
const SESSION_DAYS = 14;

export const hashPassword = (p: string) => hash(p, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (h: string, p: string) => verify(h, p).catch(() => false);

export function passwordProblem(p: string): string | null {
  if (p.length < 10) return "Use at least 10 characters.";
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/\d/.test(p)) return "Use upper-case, lower-case letters and a number.";
  return null;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const h = await headers();
  await db.session.create({ data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5), userAgent: h.get("user-agent")?.slice(0, 200), ip: await clientIp() } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: (process.env.APP_URL ?? "").startsWith("https"), path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function destroySession() {
  const jar = await cookies(); const t = jar.get(COOKIE)?.value;
  if (t) await db.session.deleteMany({ where: { tokenHash: sha256(t) } });
  jar.delete(COOKIE);
}

export async function getUser() {
  const t = (await cookies()).get(COOKIE)?.value; if (!t) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(t) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.user;
}
/** For pages: redirect to login if not signed in. */
export async function requireUser() { const u = await getUser(); if (!u) redirect("/login"); return u; }
export async function anyUserExists() { return (await db.user.count()) > 0; }
