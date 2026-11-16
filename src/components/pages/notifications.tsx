"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { api, qs } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button, EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui";
import { timeAgo } from "@/components/notification-bell";

type N = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string; type: string };

export function NotificationsPage() {
  const router = useRouter(); const qc = useQueryClient();
  const [unread, setUnread] = useState(false); const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["notifications", "page", unread, page], queryFn: () => api<{ items: N[]; total: number; unread: number; pageSize: number }>(`/api/notifications${qs({ unread, page, limit: 20 })}`), placeholderData: (p) => p });
  const mark = useMutation({ mutationFn: (b: { action: "read" | "unread" | "readAll"; id?: string }) => api("/api/notifications", { body: b }), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / 20));
  return (
    <>
      <PageHeader title="Notifications" subtitle="Reminders and warnings history." actions={<><Button variant={unread ? "primary" : "default"} onClick={() => { setUnread(!unread); setPage(1); }}>{unread ? "Showing unread" : "Unread only"}</Button><Button onClick={() => mark.mutate({ action: "readAll" })}><CheckCheck className="h-4 w-4" />Mark all read</Button></>} />
      <Panel>
        {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.items.length ? <EmptyState title={unread ? "You have no unread notifications." : "No notifications yet."} hint="Reminders such as your Sunday review, overdue tasks and unpaid invoices appear here." /> : (
          <ul className="divide-y divide-line/60">
            {q.data.items.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-line" : "bg-accent")} />
                <button className="min-w-0 flex-1 text-left" onClick={() => { mark.mutate({ action: "read", id: n.id }); if (n.link) router.push(n.link); }}>
                  <p className="text-sm font-medium">{n.title}</p><p className="text-sm text-muted">{n.body}</p><p className="num mt-0.5 text-[11px] text-muted">{timeAgo(n.createdAt)} · {new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Accra" })}</p>
                </button>
                <Button variant="ghost" className="text-xs" onClick={() => mark.mutate({ action: n.readAt ? "unread" : "read", id: n.id })}>{n.readAt ? "Mark unread" : "Mark read"}</Button>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && <div className="mt-3 flex items-center justify-end gap-1 text-xs text-muted"><Button variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>{page} / {pages}<Button variant="ghost" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></div>}
      </Panel>
    </>
  );
}
