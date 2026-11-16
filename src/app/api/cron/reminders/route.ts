import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/server/reminders";

// For an external cron service (optional). Authenticated by CRON_SECRET, not by a login cookie.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  return NextResponse.json(await runReminders());
}
