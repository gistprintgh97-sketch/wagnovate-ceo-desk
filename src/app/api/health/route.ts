import { NextResponse } from "next/server";
import { db } from "@/server/db";

// Public on purpose (Render's health check calls it without a login). It reveals nothing except "up" or "down".
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
