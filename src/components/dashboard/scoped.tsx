"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- profile payload is rendered generically */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { fmtDate } from "@/lib/dates";
import { ghs, ghsCompact } from "@/lib/money";
import { label } from "@/config/enums";
import { Badge, EmptyState, Progress, statusTone } from "@/components/ui";
import { KpiCard, moneyParts } from "./kpi-panels";

/** Drill-down view of one customer, shown when a marker on the globe is selected. */
export function scopedKpis(p: any) {
  const rated = p.feedback.filter((f: any) => f.rating);
  const avg = rated.length ? (rated.reduce((s: number, f: any) => s + f.rating, 0) / rated.length).toFixed(1) : null;
  const open = p.support.filter((f: any) => ["OPEN", "IN_PROGRESS"].includes(f.resolution)).length;
  return (
    <>
      <KpiCard label="Paid to date" value={moneyParts(p.totals.paid).text} unit={moneyParts(p.totals.paid).unit} sub="All recorded payments" />
      <KpiCard label="Outstanding" value={moneyParts(p.totals.outstanding).text} unit={moneyParts(p.totals.outstanding).unit} sub={p.totals.outstanding > 0 ? "Awaiting payment" : "Nothing owed"} />
      <KpiCard label="Active contracts" value={moneyParts(p.totals.contractValue).text} unit={moneyParts(p.totals.contractValue).unit} sub={`${p.contracts.filter((c: any) => c.status === "ACTIVE").length} active`} />
      <KpiCard label="Satisfaction" value={avg ?? "—"} unit={avg ? "/ 5" : ""} sub={avg ? `${rated.length} rating(s)` : "No ratings recorded"} />
      <KpiCard label="Open issues" value={String(open)} sub={open ? "Needs follow-up" : "None open"} href={`/customers?customer=${p.customer.id}`} />
    </>
  );
}

export function ScopedContracts({ p }: { p: any }) {
  if (!p.contracts.length) return <EmptyState title="No contracts for this customer." />;
  return (
    <ol className="space-y-3">
      {p.contracts.slice(0, 5).map((c: any) => {
        const pct = Number(c.value) > 0 ? Math.min(100, (c.paid / Number(c.value)) * 100) : 0;
        return (
          <li key={c.id}><div className="mb-1 flex justify-between gap-2 text-[13px]"><span className="min-w-0 truncate font-medium">{c.title}</span><span className="num shrink-0 font-semibold">{pct.toFixed(0)}%</span></div><Progress value={pct} tone={pct >= 100 ? "good" : "accent"} /><p className="num mt-0.5 text-[10px] text-muted">{ghsCompact(c.paid)} of {ghsCompact(Number(c.value))} · ends {fmtDate(c.endDate)}</p></li>
        );
      })}
    </ol>
  );
}

export function ScopedInvoices({ p }: { p: any }) {
  if (!p.invoices.length) return <EmptyState title="No invoices for this customer." />;
  return (
    <ul className="space-y-1.5 text-xs">
      {p.invoices.slice(0, 6).map((i: any) => (
        <li key={i.id} className="flex items-center gap-2 border-b border-line/50 pb-1.5 last:border-0"><span className="min-w-0 flex-1 truncate">{i.number}</span>{i.overdueDays > 0 && <Badge tone="red">{i.overdueDays} d</Badge>}<span className={`num font-medium ${i.outstanding > 0 ? "text-warn" : "text-good"}`}>{i.outstanding > 0 ? ghsCompact(i.outstanding) : "Paid"}</span></li>
      ))}
    </ul>
  );
}

export function ScopedList({ rows, empty }: { rows: { id: string; a: string; b?: string; tone?: string }[]; empty: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return <ul className="space-y-1.5 text-xs">{rows.map((r) => <li key={r.id} className="flex items-center gap-2 border-b border-line/50 pb-1.5 last:border-0"><span className="min-w-0 flex-1 truncate">{r.a}</span>{r.b && <Badge tone={statusTone(r.tone ?? r.b) as never}>{label(r.b)}</Badge>}</li>)}</ul>;
}

export function ScopedPayments({ p }: { p: any }) {
  if (!p.payments.length) return <EmptyState title="No payments recorded for this customer." />;
  return (
    <ul className="divide-y divide-line/60 text-sm">
      {p.payments.slice(0, 6).map((x: any) => <li key={x.id} className="flex flex-wrap items-center gap-x-4 py-2"><span className="min-w-0 flex-1 truncate">{x.title}</span><span className="num text-good">{ghs(Number(x.amount))}</span><span className="num text-xs text-muted">{fmtDate(x.date)}</span></li>)}
    </ul>
  );
}

export function OpenProfileLink({ id }: { id: string }) {
  return <Link href={`/customers?customer=${id}`} className="inline-flex items-center gap-1 text-accent hover:underline">Full profile<ArrowUpRight className="h-3 w-3" /></Link>;
}
