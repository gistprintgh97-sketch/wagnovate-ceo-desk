"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, MoreHorizontal, WifiOff } from "lucide-react";
import { NAV } from "@/config/nav";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Clock } from "./clock";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { Modal } from "./ui";
import { useOnline } from "@/lib/use-online";
import { InstallPrompt } from "./install-prompt";

function active(pathname: string, href: string) { return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"); }

function Brand({ company, collapsed, rail }: { company: { name: string; hasLogo: boolean }; collapsed?: boolean; rail?: boolean }) {
  return (
    <Link href="/" className="flex h-12 items-center gap-3 px-[14px]" aria-label="WAGNOVATE CEO Desk home">
      {company.hasLogo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src="/api/branding/logo" alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
        : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/50 bg-accent/15 text-sm font-bold text-accent">W</span>}
      {!collapsed && <span className={cn("whitespace-nowrap text-sm font-bold tracking-[0.14em]", rail && "opacity-0 transition-opacity duration-150 group-hover/side:opacity-100 group-focus-within/side:opacity-100")}>WAGNOVATE</span>}
    </Link>
  );
}

export function AppShell({ children, company, user }: { children: ReactNode; company: { name: string; hasLogo: boolean }; user: { name: string; email: string } }) {
  const pathname = usePathname(); const router = useRouter();
  const [more, setMore] = useState(false);
  const online = useOnline();
  const mobileItems = NAV.filter((n) => n.mobile); const rest = NAV.filter((n) => !n.mobile);
  const current = NAV.find((n) => active(pathname, n.href));

  async function logout() { await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {}); router.replace("/login"); router.refresh(); }

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar: a slim 68px icon rail that slides open to 240px over the page on hover or keyboard focus, then closes itself. Content keeps a fixed 68px gutter, so nothing shifts or hides. */}
      <aside className="group/side no-print fixed inset-y-0 left-0 z-40 hidden w-[68px] flex-col overflow-hidden border-r border-line bg-panel transition-[width,box-shadow] duration-200 ease-out hover:w-[240px] hover:shadow-[8px_0_32px_-8px_rgb(0_0_0/0.6)] focus-within:w-[240px] focus-within:shadow-[8px_0_32px_-8px_rgb(0_0_0/0.6)] motion-reduce:transition-none lg:flex" aria-label="Main navigation">
        <Brand company={company} rail />
        <nav className="mt-2 flex flex-1 flex-col gap-1 px-2">
          {NAV.map((n) => {
            const on = active(pathname, n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} title={n.label}
                onClick={(e) => e.currentTarget.blur()} className={cn("relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition", on ? "text-fg" : "text-muted hover:text-fg")}>
                {on && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-accent/15 ring-1 ring-accent/40" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <n.icon className={cn("relative h-[18px] w-[18px] shrink-0", on && "text-accent")} strokeWidth={1.75} />
                <span className="relative whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/side:opacity-100 group-focus-within/side:opacity-100">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-2">
          <button onClick={logout} className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted transition hover:bg-bad/10 hover:text-bad" title="Sign out" aria-label="Sign out">
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} /><span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/side:opacity-100 group-focus-within/side:opacity-100">Sign out · {user.name.split(" ")[0]}</span>
          </button>
        </div>
      </aside>

      <div className="lg:pl-[68px]">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex max-w-[1760px] items-center gap-3 px-3 py-2 md:px-5">
            <div className="lg:hidden"><Brand company={company} collapsed /></div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold tracking-tight md:text-xl">{current && current.href !== "/" ? current.label : "WAGNOVATE CEO DESK"}</h1>
              <p className="eyebrow hidden truncate sm:block">Lead better · Measure progress · Build bigger</p>
            </div>
            <span className="hidden items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs sm:flex" role="status">
              <span className="h-2 w-2 animate-pulseDot rounded-full bg-good" /> <span className="font-medium text-good">Live</span><span className="eyebrow">Accra</span>
            </span>
            <div className="hidden sm:block"><Clock /></div>
            <div className="sm:hidden"><Clock compact /></div>
            <ThemeToggle />
            <NotificationBell />
          </div>
          {!online && (
            <div role="alert" className="flex items-center justify-center gap-2 bg-warn/15 px-3 py-1.5 text-xs text-warn"><WifiOff className="h-3.5 w-3.5" />You are offline. You can read what is already loaded, but nothing can be saved until you reconnect.</div>
          )}
        </header>
        <main className="mx-auto max-w-[1760px] px-3 pb-28 pt-4 md:px-5 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main navigation">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {mobileItems.map((n) => {
            const on = active(pathname, n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={on ? "page" : undefined} className={cn("flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium", on ? "text-accent" : "text-muted")}>
                  <n.icon className="h-5 w-5" strokeWidth={1.75} />{n.short}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMore(true)} className={cn("flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium", rest.some((n) => active(pathname, n.href)) ? "text-accent" : "text-muted")}>
              <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />More
            </button>
          </li>
        </ul>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More">
        <ul className="grid grid-cols-2 gap-2">
          {rest.map((n) => (
            <li key={n.href}><Link href={n.href} onClick={() => setMore(false)} className="flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-panel2 px-3 text-sm"><n.icon className="h-4 w-4 text-accent" />{n.short}</Link></li>
          ))}
          <li><button onClick={logout} className="flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-bad/40 px-3 text-sm text-bad"><LogOut className="h-4 w-4" />Sign out</button></li>
        </ul>
        <p className="mt-3 text-center text-[11px] text-muted">Signed in as {user.email}</p>
      </Modal>
      <InstallPrompt />
    </div>
  );
}
