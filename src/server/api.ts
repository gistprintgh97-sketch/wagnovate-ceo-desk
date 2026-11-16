import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { Prisma } from "@prisma/client";
import { getUser } from "./auth";
import { rateLimit } from "./rate-limit";

export class AppError extends Error { constructor(public status: number, message: string) { super(message); } }

export function json(data: unknown, status = 200): NextResponse {
  const body = JSON.stringify(data, function (this: Record<string, unknown>, k, v) {
    const raw = this[k] as { constructor?: { name?: string } } | undefined;
    if (raw && typeof raw === "object" && raw.constructor?.name === "Decimal") return Number(raw as unknown as string);
    return typeof v === "bigint" ? Number(v) : v;
  });
  return new NextResponse(body, { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

function friendly(e: ZodError): string {
  return e.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message).join("; ");
}

function sameOrigin(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.get("origin"); if (!origin) return true; // non-browser clients carry no cookie
  const host = req.headers.get("host");
  try { return new URL(origin).host === host; } catch { return false; }
}

type Ctx = { params: Promise<Record<string, string>> };
export type Handler<S extends ZodTypeAny | undefined> = (a: {
  req: NextRequest; user: NonNullable<Awaited<ReturnType<typeof getUser>>>; params: Record<string, string>;
  body: S extends ZodTypeAny ? z.infer<S> : undefined;
}) => Promise<NextResponse | unknown>;

/** Wraps an API route: auth, origin check, rate limit, zod validation, friendly errors. */
export function route<S extends ZodTypeAny | undefined = undefined>(opts: { body?: S; public?: boolean; limit?: { max: number; windowMs: number; key: string } }, handler: Handler<S>) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      if (!sameOrigin(req)) throw new AppError(403, "Request blocked: it did not come from this application.");
      const user = opts.public ? (await getUser()) : await getUser();
      if (!opts.public && !user) throw new AppError(401, "Please sign in again.");
      if (opts.limit) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
        const r = rateLimit(`${opts.limit.key}:${ip}`, opts.limit.max, opts.limit.windowMs);
        if (!r.ok) throw new AppError(429, `Too many attempts. Try again in ${r.retryAfterSec} seconds.`);
      }
      let body: unknown = undefined;
      if (opts.body) {
        let raw: unknown; try { raw = await req.json(); } catch { throw new AppError(400, "The request body was not valid JSON."); }
        body = opts.body.parse(raw);
      }
      const out = await handler({ req, user: user as never, params: await ctx.params, body: body as never });
      return out instanceof NextResponse ? out : json(out);
    } catch (e) {
      if (e instanceof AppError) return json({ error: e.message }, e.status);
      if (e instanceof ZodError) return json({ error: friendly(e) }, 400);
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") return json({ error: "A record with the same unique value already exists." }, 409);
        if (e.code === "P2025") return json({ error: "That record no longer exists." }, 404);
        if (e.code === "P2003") return json({ error: "That record is linked to others and cannot be changed this way." }, 409);
      }
      console.error("[api]", e);
      return json({ error: "Something went wrong on the server. Nothing was saved." }, 500);
    }
  };
}
