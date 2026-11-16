"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";

type N = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string; type: string };
type Resp = { items: N[]; unread: number };

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function NotificationBell() {
  const qc = useQueryClient(); const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({ queryKey: ["notifications", "bell"], queryFn: () => api<Resp>("/api/notifications?limit=8"), refetchInterval: 60_000 });
  const mark = useMutation({
    mutationFn: (b: { action: "read" | "readAll"; id?: string }) => api("/api/notifications", { body: b }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Show a browser/PWA notification once per new item, only if the user has granted permission.
  useEffect(() => {
    if (!data || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem("ceo-notified") ?? "[]"); } catch { /* ignore */ }
    const fresh = data.items.filter((n) => !n.readAt && !seen.includes(n.id) && Date.now() - new Date(n.createdAt).getTime() < 6 * 3600_000);
    if (!fresh.length) return;
    navigator.serviceWorker?.ready.then((reg) => fresh.forEach((n) => reg.showNotification(n.title, { body: n.body.slice(0, 160), tag: n.id, data: { url: n.link ?? "/" }, icon: "/icons/icon-192.png" }))).catch(() => {});
    try { localStorage.setItem("ceo-notified", JSON.stringify([...seen, ...fresh.map((n) => n.id)].slice(-100))); } catch { /* ignore */ }
  }, [data]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);

  const unread = data?.unread ?? 0;
  return (
    <div ref={ref} className="relative">
      <button aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-panel2 transition hover:border-accent/60">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="panel fixed inset-x-3 top-16 z-50 max-h-[70dvh] overflow-y-auto p-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[360px]">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-semibold">Notifications</span>
              <button className="inline-flex items-center gap-1 text-xs text-accent hover:underline" onClick={() => mark.mutate({ action: "readAll" })}><CheckCheck className="h-3.5 w-3.5" />Mark all read</button>
            </div>
            {!data?.items.length ? <p className="px-3 py-6 text-center text-sm text-muted">No notifications yet.</p> : data.items.map((n) => (
              <button key={n.id} className="flex w-full gap-2 rounded-lg px-2 py-2 text-left hover:bg-panel2" onClick={() => { mark.mutate({ action: "read", id: n.id }); setOpen(false); router.push(n.link ?? "/notifications"); }}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} />
                <span className="min-w-0"><span className="block text-sm font-medium">{n.title}</span><span className="line-clamp-2 block text-xs text-muted">{n.body}</span><span className="text-[10px] text-muted">{timeAgo(n.createdAt)}</span></span>
              </button>
            ))}
            <Link href="/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-lg px-3 py-2 text-center text-xs text-accent hover:bg-panel2">View all and history</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
