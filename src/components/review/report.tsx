"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- narrative values are free-form per step */
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { fmtDate, parseDate } from "@/lib/dates";
import { ghs } from "@/lib/money";
import { label } from "@/config/enums";
import { Badge, Panel, statusTone } from "@/components/ui";
import { Markdown } from "@/components/md";
import type { Payload } from "./steps";

const txt = (v: unknown) => (v === undefined || v === null || v === "" ? <span className="text-muted">Not recorded</span> : String(v));
function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-line/50 py-1"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl>;
}

/** The professional weekly CEO report: shown for completed reviews, printable, exportable as PDF. */
export function ReviewReport({ p }: { p: Payload }) {
  const { review: r, context: c, prior, next } = p;
  const d = (r.data ?? {}) as Record<string, Record<string, any>>;
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/review" className="btn"><ArrowLeft className="h-4 w-4" />Review history</Link>
        <div className="flex gap-2"><button className="btn" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</button><a className="btn btn-primary" href={`/api/reviews/${r.id}/pdf`}><Download className="h-4 w-4" />Download PDF</a></div>
      </div>
      <div className="panel p-5">
        <p className="eyebrow">WAGNOVATE Technologies · Weekly CEO Report</p>
        <h1 className="mt-1 text-2xl font-semibold">Week of {fmtDate(parseDate(c.week.start))} – {fmtDate(parseDate(c.week.end))}</h1>
        <p className="mt-1 text-xs text-muted">Completed {r.completedAt ? fmtDate(r.completedAt) : "—"} · Summary written by {r.summarySource === "AI" ? "AI from recorded data" : "the rule-based writer from recorded data"}. Frozen in history: later edits to records do not change this report.</p>
      </div>
      <Panel title="Executive summary">{r.summary ? <Markdown text={r.summary} /> : <p className="text-sm text-muted">No summary.</p>}</Panel>

      <Panel title="1. Engineering achievements" right={`${c.engineering.completed} completed`}>
        {c.engineering.items.length ? <ul className="space-y-1 text-sm">{c.engineering.items.map((a, i) => <li key={i} className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(a.status)}>{label(a.status)}</Badge><b>{a.title}</b><span className="text-muted">{a.product}{a.kind ? ` · ${a.kind}` : ""}{a.date ? ` · ${fmtDate(parseDate(a.date))}` : ""}</span></li>)}</ul> : <p className="text-sm text-muted">No engineering achievements recorded this week.</p>}
        {d.s1?.notes && <p className="mt-2 text-sm"><b>Notes:</b> {d.s1.notes}</p>}
      </Panel>
      <Panel title="2. Sales performance">
        <KV rows={[["New prospects contacted", txt(d.s2?.prospects)], ["Demonstrations conducted", txt(d.s2?.demos)], ["Quotations submitted", txt(d.s2?.quotations)], ["Proposals submitted", txt(d.s2?.proposals)], ["Prospects followed up", txt(d.s2?.followUps)], ["Contracts signed", c.sales.contractsSigned.length], ["Deals lost", c.sales.lost.length], ["Open pipeline value", ghs(c.sales.pipeline.pipelineValue)]]} />
        {d.s2?.notes && <p className="mt-2 text-sm"><b>Notes:</b> {d.s2.notes}</p>}
      </Panel>
      <Panel title="3. Customer feedback" right={c.feedback.avgRating === null ? "No ratings" : `${c.feedback.avgRating}/5 average`}>
        {c.feedback.unresolved.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{c.feedback.unresolved.map((u, i) => <li key={i}><b>{u.customer}</b> — {label(u.category)}: {u.comments}</li>)}</ul> : <p className="text-sm text-muted">No outstanding customer complaints.</p>}
        {d.s3?.notes && <p className="mt-2 text-sm"><b>Notes:</b> {d.s3.notes}</p>}
      </Panel>
      <Panel title="4. Financial summary">
        <KV rows={[["Income received", ghs(c.finance.income)], ["Expenses paid", ghs(c.finance.expenses)], ["Net cash flow", ghs(c.finance.net)], ["Outstanding invoices", `${ghs(c.finance.outstanding)} (${c.finance.outstandingCount})`], ["Overdue invoices", `${ghs(c.finance.overdueAmount)} (${c.finance.overdueCount})`], ["Previous week net cash flow", c.finance.prevTransactions ? ghs(c.finance.prevNet) : <span className="text-muted">Not recorded</span>]]} />
        {d.s4?.notes && <p className="mt-2 text-sm"><b>Notes:</b> {d.s4.notes}</p>}
      </Panel>
      <Panel title="5. Major problems">
        {c.problems.open.length ? <ul className="space-y-1 text-sm">{c.problems.open.map((x, i) => <li key={i} className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(x.severity)}>{label(x.severity)}</Badge><b>{x.title}</b><span className="text-muted">{label(x.department)} · {x.daysOpen} days open</span></li>)}</ul> : <p className="text-sm text-muted">No unresolved problems recorded.</p>}
        {d.s5?.notes && <p className="mt-2 text-sm"><b>Notes:</b> {d.s5.notes}</p>}
      </Panel>
      <Panel title="6. Lessons learned">
        <KV rows={[["What worked well", txt(d.s6?.worked)], ["What failed", txt(d.s6?.failed)], ["What wasted time or money", txt(d.s6?.wasted)], ["What to stop doing", txt(d.s6?.stop)], ["What to start doing", txt(d.s6?.start)], ["What to improve", txt(d.s6?.improve)], ["What to delegate or automate", txt(d.s6?.delegate)], ["Most important lesson", txt(d.s6?.lesson)]]} />
      </Panel>
      <Panel title="Previous priority assessment">
        {prior ? <KV rows={[["Last week's priority", prior.title], ["Outcome", r.priorOutcome ? label(r.priorOutcome) : "Not assessed"], ["Explanation", txt(r.priorExplanation)], ["Decision", r.priorAction === "RESCHEDULE" ? "Rescheduled" : r.priorAction === "REPLACE" ? "Replaced" : "—"]]} /> : <p className="text-sm text-muted">No priority was set for this week.</p>}
      </Panel>
      <Panel title="New strategic priority">
        {next ? <><p className="text-base font-semibold">{next.title}</p><div className="my-1 flex gap-2"><Badge tone="violet">{label(next.category)}</Badge><span className="num text-xs text-muted">Deadline {fmtDate(parseDate(next.deadline))}</span></div><KV rows={[["Objective", next.objective], ["Expected result", next.expectedResult], ["First action", next.firstAction], ["Success measure", next.successMeasure]]} /></> : <p className="text-sm text-muted">No priority chosen.</p>}
      </Panel>
    </div>
  );
}
