import { NextResponse, type NextRequest } from "next/server";

// Fast gate: no session cookie means login. The real check (valid, unexpired session) happens on the server in every page and API route.
const PUBLIC = ["/login", "/setup", "/forgot-password", "/reset-password", "/offline.html", "/manifest.webmanifest", "/sw.js"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC.includes(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/branding/logo" ||
    pathname.startsWith("/icons/")
  ) return NextResponse.next();
  if (!req.cookies.get("ceo_session")?.value) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
