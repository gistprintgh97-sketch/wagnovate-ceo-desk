"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- list items are rendered generically */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronLeft, ChevronRight, List } from "lucide-react";
import { api, qs } from "@/lib/api";
import { MONTHS, addDays, iso, monthEnd, monthStart, today, weekStart } from "@/lib/dates";
import { label } from "@/config/enums";
import { cn } from "@/lib/utils";
import { Badge, Button, PageHeader, Panel, Progress, statusTone } from "@/components/ui";
import { ModuleTabs } from "@/components/module";
import { ResourceManager } from "@/components/resource-manager";
import { useToast } from "@/components/toast";

function CompletionRate() {
  const q = useQuery({ queryKey: ["priority-rate"], queryFn: () => api<{ items: any[] }>("/api/r/priorities?pageSize=200") });
  const past = (q.data?.items ?? []).filter((p) => new Date(p.weekStart) < weekStart(today()) && p.status !== "CANCELLED");
  const done = past.filter((p) => p.status === "COMPLETED").length;
  const pct = past.length ? Math.round((done / past.length) * 100) : null;
  return (
    <Panel title="Priority completion rate" className="mb-4">
      {pct === null ? <p className="text-sm text-muted">No finished weeks yet. Your completion rate appears after your first full week.</p> : (
        <div className="flex items-center gap-4"><span className="num text-3xl font-semibold">{pct}%</span><div className="flex-1"><Progress value={pct} tone={pct >= 70 ? "good" : pct >= 40 ? "accent" : "warn"} /><p className="mt-1 text-xs text-muted">{done} of {past.length} past weekly priorities completed. Priorities are set in the Weekly CEO Review; each week allows exactly one.</p></div></div>
      )}
    </Panel>
  );
}

function CalendarView() {
  const [month, setMonth] = useState(monthStart(today()));
  const from = iso(addDays(weekStart(month), 0)), to = iso(addDays(weekStart(monthEnd(month)), 6));
  const q = useQuery({ queryKey: ["r", "tasks", "calendar", from, to], queryFn: () => api<{ items: any[] }>(`/api/r/tasks${qs({ from, to, pageSize: 200 })}`) });
  const days: Date[] = []; for (let d = weekStart(month); d <= addDays(weekStart(monthEnd(month)), 6); d = addDays(d, 1)) days.push(d);
  const t = iso(today());
  const byDay = (d: Date) => (q.data?.items ?? []).filter((x) => x.dueDate && String(x.dueDate).slice(0, 10) === iso(d));
  return (
    <Panel title={`${MONTHS[month.getUTCMonth()]} ${month.getUTCFullYear()}`} right={<span className="flex gap-1"><Button variant="ghost" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" aria-label="Next month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))}><ChevronRight className="h-4 w-4" /></Button></span>}>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="eyebrow bg-panel2 px-1 py-1.5 text-center">{d}</div>)}
        {days.map((d) => {
          const tasks = byDay(d); const out = d.getUTCMonth() !== month.getUTCMonth();
          return (
            <div key={iso(d)} className={cn("min-h-[64px] bg-panel p-1 sm:min-h-[88px]", out && "opacity-40")}>
              <span className={cn("num inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]", iso(d) === t && "bg-accent text-white")}>{d.getUTCDate()}</span>
              <ul className="mt-0.5 space-y-0.5">
                {tasks.slice(0, 3).map((x) => <li key={x.id} title={x.title} className={cn("truncate rounded px-1 py-0.5 text-[10px] leading-tight", x.status === "DONE" ? "bg-good/15 text-good line-through" : iso(d) < t && x.status !== "CANCELLED" ? "bg-bad/15 text-bad" : "bg-accent/15")}>{x.title}</li>)}
                {tasks.length > 3 && <li className="text-[10px] text-muted">+{tasks.length - 3} more</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted">Red = overdue, green = done. Switch to List view to edit tasks.</p>
    </Panel>
  );
}

function Tasks() {
  const sp = useSearchParams(); const qc = useQueryClient(); const toast = useToast();
  const [view, setView] = useState<"list" | "calendar">("list");
  const done = useMutation({
    mutationFn: (id: string) => api(`/api/r/tasks/${id}`, { method: "PATCH", body: { status: "DONE" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["r"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.ok("Task marked complete."); },
    onError: (e: Error) => toast.err(e.message),
  });
  return (
    <>
      <div className="mb-3 flex gap-1">
        <Button variant={view === "list" ? "primary" : "default"} onClick={() => setView("list")}><List className="h-4 w-4" />List</Button>
        <Button variant={view === "calendar" ? "primary" : "default"} onClick={() => setView("calendar")}><CalendarDays className="h-4 w-4" />Calendar</Button>
      </div>
      {view === "calendar" ? <CalendarView /> : (
        <ResourceManager resource="tasks" query={{ overdue: sp.get("overdue") ? 1 : undefined }}
          rowActions={(t) => t.status !== "DONE" && t.status !== "CANCELLED" ? <div className="flex items-center gap-1">{t.dueDate && new Date(t.dueDate) < today() && <Badge tone="red">Overdue</Badge>}<Button className="min-h-[32px] px-2 py-1 text-xs" loading={done.isPending && done.variables === t.id} onClick={() => done.mutate(t.id)}><Check className="h-3.5 w-3.5" />Done</Button></div> : null} />
      )}
    </>
  );
}

export function PrioritiesPage() {
  return (
    <>
      <PageHeader title="Strategic Priorities" subtitle="One primary priority per week, plus the tasks that support it." />
      <ModuleTabs fallback="priorities" tabs={[{ id: "priorities", label: "Weekly priorities" }, { id: "tasks", label: "Tasks" }]}>
        {(tab) => tab === "priorities" ? <><CompletionRate /><ResourceManager resource="priorities" /></> : <Tasks />}
      </ModuleTabs>
      <span className="hidden">{label("DONE")}{statusTone("DONE")}</span>
    </>
  );
}
