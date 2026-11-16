"use client";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, ClipboardCheck, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { ghs } from "@/lib/money";
import { label } from "@/config/enums";
import { fmtDate } from "@/lib/dates";
import { Badge, Panel, statusTone } from "@/components/ui";
import type { getActionCentre } from "@/server/insights";

type Action = Awaited<ReturnType<typeof getActionCentre>>;
type Item = Action["today"][number];

function relative(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now(); const abs = Math.abs(ms);
  const d = Math.floor(abs / 864e5), h = Math.floor((abs % 864e5) / 36e5), m = Math.floor((abs % 36e5) / 6e4);
  const txt = d > 0 ? `${d} day${d > 1 ? "s" : ""}${h ? ` ${h} h` : ""}` : h > 0 ? `${h} h ${m} min` : `${m} min`;
  return ms >= 0 ? `in ${txt}` : `${txt} ago`;
}
const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", weekday: "long", hour: "numeric", minute: "2-digit", hour12: true });

export function PriorityAndReview({ a }: { a: Action }) {
  const p = a.priority;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr]">
      <Link href="/priorities" className="panel group flex gap-3 p-3 transition hover:border-accent/60">
        <Flag className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Current strategic priority</p>
          {p ? (
            <>
              <p className="mt-0.5 text-base font-semibold leading-snug">{p.title}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted">{p.objective}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="violet">{label(p.category)}</Badge><Badge tone={statusTone(p.status)}>{label(p.status)}</Badge>
                <span className={cn("num", p.overdue ? "text-bad" : "text-muted")}>{p.overdue ? "Overdue · " : "Due "}{fmtDate(p.deadline)}</span>
              </div>
            </>
          ) : <p className="mt-1 text-sm text-muted">No priority chosen for this week. Choose one in your weekly review.</p>}
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted transition group-hover:text-accent" />
      </Link>
      <Link href={a.review.draftId ? `/review/${a.review.draftId}` : "/review"} className={cn("panel group flex gap-3 p-3 transition hover:border-accent/60", a.review.overdue && "border-warn/60")}>
        <ClipboardCheck className={cn("mt-0.5 h-5 w-5 shrink-0", a.review.overdue ? "text-warn" : "text-accent")} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Next weekly CEO review</p>
          <p className="mt-0.5 text-base font-semibold">{when.format(new Date(a.review.at))}</p>
          <p className={cn("text-xs", a.review.overdue ? "text-warn" : "text-muted")}>{a.review.overdue ? `Due ${relative(a.review.at)}. ` : `${relative(a.review.at)}. `}{a.review.draftId ? "A draft is waiting." : ""}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted transition group-hover:text-accent" />
      </Link>
    </div>
  );
}

function ActionCard({ title, count, items, empty, href, tone }: { title: string; count: number; items: Item[]; empty: string; href: string; tone?: "red" | "orange" }) {
  return (
    <Panel title={<>{title}{count > 0 && <Badge tone={tone ?? "blue"} className="ml-1">{count}</Badge>}</>} right={<Link href={href} className="text-accent hover:underline">View</Link>}>
      {!items.length ? <p className="py-3 text-center text-xs text-muted">{empty}</p> : (
        <ul className="space-y-1">
          {items.slice(0, 4).map((i) => (
            <li key={i.id}><Link href={i.link} className="block rounded-lg px-2 py-1.5 transition hover:bg-panel2"><p className="truncate text-[13px] font-medium">{i.title}</p>{i.sub && <p className={cn("truncate text-[11px]", i.tone === "red" ? "text-bad" : i.tone === "orange" ? "text-warn" : "text-muted")}>{i.sub}</p>}</Link></li>
          ))}
          {items.length > 4 && <li className="px-2 text-[11px] text-muted">+{items.length - 4} more</li>}
        </ul>
      )}
    </Panel>
  );
}

export function ActionCentre({ a }: { a: Action }) {
  const inv = a.invoices;
  return (
    <section aria-label="CEO action centre">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-accent" />CEO action centre</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ActionCard title="Today's tasks" count={a.today.length} items={a.today} empty="Nothing due today." href="/priorities?tab=tasks" />
        <ActionCard title="Overdue tasks" count={a.overdue.length} items={a.overdue} empty="No overdue tasks." href="/priorities?tab=tasks&overdue=1" tone="red" />
        <ActionCard title="Upcoming deadlines" count={a.deadlines.length} items={a.deadlines} empty="No deadlines in the next 7 days." href="/priorities?tab=tasks" />
        <ActionCard title="Pending follow-ups" count={a.followUps.length} items={a.followUps} empty="No pending customer follow-ups." href="/sales?followUpDue=1" tone="orange" />
        <Panel title={<>Unpaid invoices{inv.unpaidCount > 0 && <Badge tone={inv.overdueCount ? "red" : "blue"} className="ml-1">{inv.unpaidCount}</Badge>}</>} right={<Link href="/finance?tab=invoices&state=outstanding" className="text-accent hover:underline">View</Link>}>
          {inv.unpaidCount === 0 ? <p className="py-3 text-center text-xs text-muted">No unpaid invoices.</p> : (
            <Link href="/finance?tab=invoices&state=outstanding" className="block rounded-lg px-2 py-1 hover:bg-panel2">
              <p className="num text-lg font-semibold">{ghs(inv.unpaidAmount)}</p>
              <p className="text-xs text-muted">across {inv.unpaidCount} invoice{inv.unpaidCount > 1 ? "s" : ""}</p>
              {inv.overdueCount > 0 && <p className="mt-1 text-xs text-bad">{inv.overdueCount} overdue · {ghs(inv.overdueAmount)}</p>}
            </Link>
          )}
        </Panel>
        <ActionCard title="Unresolved major problems" count={a.problems.length} items={a.problems} empty="No unresolved high or critical problems." href="/problems" tone="red" />
      </div>
    </section>
  );
}
