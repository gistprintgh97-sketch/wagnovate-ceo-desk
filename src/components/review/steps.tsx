"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- review narrative values are free-form per step */
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { RESOURCES } from "@/config/resources";
import { LESSON_CATEGORY, PRIORITY_OUTCOME, label } from "@/config/enums";
import { fmtDate, iso, parseDate, addDays, today } from "@/lib/dates";
import { ghs } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge, Button, Label, Panel, statusTone } from "@/components/ui";
import { RecordForm, ResourceManager } from "@/components/resource-manager";
import type { ReviewContext } from "@/server/review-context";

export type Priority = { id: string; title: string; category: string; objective: string; expectedResult: string; firstAction: string; deadline: string; successMeasure: string; status: string; weekStart: string; outcome: string | null; outcomeNote: string | null } | null;
export type Payload = {
  review: { id: string; weekStart: string; weekEnd: string; status: "DRAFT" | "COMPLETED"; currentStep: number; data: Record<string, Record<string, any>>; priorOutcome: string | null; priorExplanation: string | null; priorAction: string | null; summary: string | null; summarySource: string | null; completedAt: string | null };
  context: ReviewContext; prior: Priority; next: Priority; frozen: boolean; problems: string[];
};
export type Setter = (step: string, key: string, value: string | number) => void;
export type PriorState = { outcome: string | null; explanation: string; action: string | null };

export function Stat({ label: l, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-panel2/60 px-3 py-2.5">
      <p className="eyebrow">{l}</p>
      <p className={cn("num mt-0.5 text-lg font-semibold", tone === "good" && "text-good", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
const Grid = ({ children }: { children: ReactNode }) => <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
export function Change({ pct, valid }: { pct: number | null; valid: boolean }) {
  if (!valid || pct === null) return <span>no valid comparison (no prior-week data)</span>;
  return <span className="inline-flex items-center gap-0.5">{pct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(pct)}% vs last week</span>;
}
function Notes({ d, step, set, ph }: { d: any; step: string; set: Setter; ph: string }) {
  return (
    <div className="mt-4">
      <Label htmlFor={`${step}-notes`}>Your notes for this section</Label>
      <textarea id={`${step}-notes`} rows={3} className="field" placeholder={ph} value={d[step]?.notes ?? ""} onChange={(e) => set(step, "notes", e.target.value)} />
    </div>
  );
}
const List = ({ items, empty }: { items: ReactNode[]; empty: string }) => items.length ? <ul className="space-y-1 text-sm">{items.map((x, i) => <li key={i} className="rounded-lg bg-panel2/60 px-3 py-1.5">{x}</li>)}</ul> : <p className="text-sm text-muted">{empty}</p>;

type P = { p: Payload; d: any; set: Setter; weekQuery: { from: string; to: string }; weekDefault: string };

export function Step1({ p, d, set, weekQuery, weekDefault }: P) {
  const c = p.context.engineering;
  return (
    <>
      <Grid><Stat label="Completed this week" value={c.completed} sub={`${c.total} recorded in total`} /><Stat label="Tasks finished" value={c.tasksCompleted} /><Stat label="Hours logged" value={c.hours || "—"} sub={c.hours ? undefined : "Not recorded"} /></Grid>
      <ResourceManager resource="achievements" title="Achievements this week" query={weekQuery} defaults={{ completedAt: weekDefault, status: "COMPLETED" }} compact addLabel="Add achievement" />
      <Notes d={d} step="s1" set={set} ph="Outstanding development work, blockers, technical or infrastructure improvements…" />
    </>
  );
}

export function Step2({ p, d, set }: P) {
  const s = p.context.sales;
  const num = (k: string, l: string) => (
    <div key={k}><Label htmlFor={`s2-${k}`}>{l}</Label><input id={`s2-${k}`} type="number" min={0} inputMode="numeric" className="field" value={d.s2?.[k] ?? ""} onChange={(e) => set("s2", k, e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} /></div>
  );
  return (
    <>
      <Grid>
        <Stat label="Contracts signed" value={s.contractsSigned.length} sub={s.contractValue ? ghs(s.contractValue) : "From contract records"} />
        <Stat label="Deals lost" value={s.lost.length} tone={s.lost.length ? "warn" : undefined} />
        <Stat label="Pipeline value" value={ghs(s.pipeline.pipelineValue)} sub={`${s.pipeline.activeCount} open opportunities`} />
        <Stat label="Win rate" value={s.pipeline.conversion === null ? "—" : `${s.pipeline.conversion}%`} sub={s.pipeline.conversion === null ? "No closed deals yet" : `${s.pipeline.wonCount} won · ${s.pipeline.lostCount} lost`} />
      </Grid>
      <Panel title="Weekly activity (you enter these)" className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {num("prospects", "New prospects contacted")}{num("demos", "Demonstrations conducted")}{num("quotations", "Quotations submitted")}{num("proposals", "Proposals submitted")}{num("followUps", "Prospects followed up")}
        </div>
        <p className="mt-2 text-[11px] text-muted">Contracts signed and deals lost come from your contract and pipeline records, not from typing. Money is shown in three separate ways: potential (pipeline), signed (contracts), received (Finance).</p>
      </Panel>
      <ResourceManager resource="leads" title="Sales pipeline" query={{ active: 1 }} compact pageSize={8} addLabel="Add prospect" />
      <Notes d={d} step="s2" set={set} ph="Key conversations, objections heard, deals at risk…" />
    </>
  );
}

export function Step3({ p, d, set, weekQuery, weekDefault }: P) {
  const f = p.context.feedback;
  return (
    <>
      <Grid>
        <Stat label="Feedback this week" value={f.count} />
        <Stat label="Average rating" value={f.avgRating === null ? "—" : `${f.avgRating}/5`} sub={f.avgRating === null ? "No ratings recorded" : `${f.ratedCount} rating(s)`} />
        <Stat label="Unresolved complaints" value={f.unresolved.length} tone={f.unresolved.length ? "bad" : undefined} />
        <Stat label="Customers at risk" value={f.atRisk.length} tone={f.atRisk.length ? "warn" : undefined} />
      </Grid>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel title="Unresolved complaints"><List empty="No outstanding customer complaints." items={f.unresolved.map((u) => <span key={u.customer + u.comments}><b>{u.customer}</b> · {label(u.category)} — {u.comments}</span>)} /></Panel>
        <Panel title="Repeated technical problems"><List empty="No customer has repeated technical problems." items={f.repeatedTechnical.map((r) => <span key={r.customer}><b>{r.customer}</b> · {r.count} issues in 90 days</span>)} /></Panel>
        <Panel title="Follow-up required"><List empty="No customer follow-ups are due." items={[...f.followUps.map((x) => <span key={x.customer + x.due}><b>{x.customer}</b> · due {x.due ? fmtDate(x.due) : "—"}</span>), ...f.atRisk.map((n) => <span key={n}><b>{n}</b> · at risk of leaving</span>)]} /></Panel>
      </div>
      <ResourceManager resource="feedback" title="Feedback this week" query={weekQuery} defaults={{ date: weekDefault }} compact addLabel="Record feedback" />
      <Notes d={d} step="s3" set={set} ph="Are customers satisfied? What are they telling you?" />
    </>
  );
}

export function Step4({ p, d, set, weekQuery, weekDefault }: P) {
  const f = p.context.finance; const has = f.prevTransactions > 0;
  return (
    <>
      <Grid>
        <Stat label="Income received" value={ghs(f.income)} sub={<Change pct={f.incomeChangePct} valid={has} />} />
        <Stat label="Expenses paid" value={ghs(f.expenses)} sub={<Change pct={f.expenseChangePct} valid={has} />} />
        <Stat label="Net cash flow" value={ghs(f.net)} tone={f.net < 0 ? "bad" : f.net > 0 ? "good" : undefined} sub="Cash in minus cash out. This is not profit." />
        <Stat label="Outstanding invoices" value={ghs(f.outstanding)} sub={f.overdueCount ? `${f.overdueCount} overdue · ${ghs(f.overdueAmount)}` : `${f.outstandingCount} unpaid`} tone={f.overdueCount ? "warn" : undefined} />
      </Grid>
      <ResourceManager resource="transactions" title="Transactions this week" query={weekQuery} defaults={{ date: weekDefault }} compact addLabel="Record transaction" />
      <Notes d={d} step="s4" set={set} ph="Is WAGNOVATE becoming financially stronger? What changed?" />
    </>
  );
}

export function Step5({ p, d, set }: P) {
  const pr = p.context.problems;
  return (
    <>
      <Grid>
        <Stat label="Open problems" value={pr.open.length} /><Stat label="Critical open" value={pr.open.filter((x) => x.severity === "CRITICAL").length} tone={pr.open.some((x) => x.severity === "CRITICAL") ? "bad" : undefined} />
        <Stat label="New this week" value={pr.newThisWeek.length} /><Stat label="Resolved this week" value={pr.resolvedThisWeek.length} tone={pr.resolvedThisWeek.length ? "good" : undefined} />
      </Grid>
      <ResourceManager resource="problems" title="Unresolved problems" query={{ open: 1 }} defaults={{ identifiedAt: iso(today()) }} compact pageSize={8} addLabel="Add problem" />
      <Notes d={d} step="s5" set={set} ph="What prevented WAGNOVATE from progressing this week?" />
    </>
  );
}

const QUESTIONS: [string, string, string][] = [
  ["worked", "1. What worked well?", "Things to repeat."], ["failed", "2. What failed?", "Plans or experiments that did not work."], ["wasted", "3. What wasted time or money?", "Be specific: hours, amounts, tools."], ["stop", "4. What should I stop doing?", ""],
  ["start", "5. What should I start doing?", ""], ["improve", "6. What should I improve?", ""], ["delegate", "7. What should I delegate or automate?", "Tasks that do not need you."], ["lesson", "8. What important lesson did I learn?", "The one thing you want to remember."],
];
export function Step6({ p, d, set, weekQuery, weekDefault }: P) {
  return (
    <>
      <p className="mb-3 text-sm text-muted">What did this week teach you as a founder? Each answer you fill in is saved to the lessons library when you complete the review.</p>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {QUESTIONS.map(([k, q, hint]) => (
          <div key={k}><Label htmlFor={`s6-${k}`}>{q}</Label><textarea id={`s6-${k}`} rows={3} className="field" placeholder={hint} value={d.s6?.[k] ?? ""} onChange={(e) => set("s6", k, e.target.value)} /></div>
        ))}
      </div>
      <ResourceManager resource="lessons" title="Extra lessons from this week" query={weekQuery} defaults={{ date: weekDefault }} compact addLabel="Add another lesson" />
      <span className="hidden">{p.review.id}{LESSON_CATEGORY.length}</span>
    </>
  );
}

export function Step7({ p, prior, setPrior }: P & { prior: PriorState; setPrior: (v: Partial<PriorState>) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const nextWs = iso(addDays(parseDate(p.review.weekStart), 7));
  const nextEnd = iso(addDays(parseDate(nextWs), 6));
  const pp = p.prior;
  const showAssessment = pp && pp.status !== "CANCELLED";
  const prefill = prior.action === "RESCHEDULE" && pp ? { title: pp.title, category: pp.category, objective: pp.objective, expectedResult: pp.expectedResult, firstAction: pp.firstAction, successMeasure: pp.successMeasure } : {};
  const done = () => { setEditing(false); qc.invalidateQueries({ queryKey: ["review", p.review.id] }); };
  return (
    <div className="space-y-4">
      {showAssessment && pp && (
        <Panel title="Did you accomplish last week's priority?">
          <p className="mb-2 text-sm"><b>{pp.title}</b> <Badge tone="violet" className="ml-1">{label(pp.category)}</Badge> <span className="text-xs text-muted">Deadline {fmtDate(parseDate(pp.deadline))}</span></p>
          <div role="radiogroup" aria-label="Priority outcome" className="flex flex-wrap gap-2">
            {PRIORITY_OUTCOME.map((o) => (
              <button key={o.value} role="radio" aria-checked={prior.outcome === o.value} onClick={() => setPrior({ outcome: o.value })}
                className={cn("btn", prior.outcome === o.value && "border-accent bg-accent/15")}>{o.label}</button>
            ))}
          </div>
          {prior.outcome && prior.outcome !== "COMPLETED" && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2"><Label htmlFor="prior-why" required>Why was it not fully completed?</Label><textarea id="prior-why" rows={2} className="field" value={prior.explanation} onChange={(e) => setPrior({ explanation: e.target.value })} /></div>
              <div className="md:col-span-2"><Label required>What will you do with it?</Label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reschedule or replace">
                  {[["RESCHEDULE", "Reschedule it for next week"], ["REPLACE", "Replace it with something else"]].map(([v, l]) => <button key={v} role="radio" aria-checked={prior.action === v} onClick={() => setPrior({ action: v })} className={cn("btn", prior.action === v && "border-accent bg-accent/15")}>{l}</button>)}
                </div>
              </div>
            </div>
          )}
        </Panel>
      )}

      <Panel title="Next week's single most important priority" right={<>Week of {fmtDate(parseDate(nextWs))}</>}>
        <p className="mb-3 text-sm text-muted">If you could accomplish only ONE thing next week to make WAGNOVATE more successful, what would it be? Only one primary priority is allowed per week. Add supporting tasks below.</p>
        {p.next && !editing ? (
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-3">
            <div className="flex items-start justify-between gap-2"><p className="text-base font-semibold">{p.next.title}</p><Button onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Edit</Button></div>
            <div className="mt-1 flex flex-wrap gap-2"><Badge tone="violet">{label(p.next.category)}</Badge><Badge tone={statusTone(p.next.status)}>{label(p.next.status)}</Badge><span className="num text-xs text-muted">Deadline {fmtDate(parseDate(p.next.deadline))}</span></div>
            <dl className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div><dt className="eyebrow">Objective</dt><dd>{p.next.objective}</dd></div><div><dt className="eyebrow">Expected result</dt><dd>{p.next.expectedResult}</dd></div>
              <div><dt className="eyebrow">First action</dt><dd>{p.next.firstAction}</dd></div><div><dt className="eyebrow">Success measure</dt><dd>{p.next.successMeasure}</dd></div>
            </dl>
          </div>
        ) : (
          <RecordForm def={RESOURCES.priorities} item={p.next ?? undefined} defaults={{ weekStart: nextWs, deadline: nextEnd, ...prefill }} hide={["weekStart"]} onDone={done} onCancel={() => setEditing(false)} />
        )}
      </Panel>

      {p.next && (
        <Panel title="Supporting tasks for this priority">
          <ResourceManager resource="tasks" query={{ f_priorityId: p.next.id }} defaults={{ priorityId: p.next.id }} compact pageSize={6} addLabel="Add supporting task" />
        </Panel>
      )}
    </div>
  );
}
