"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- review narrative values are free-form per step */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate, parseDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge, Button, EmptyState, Panel, Skeleton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { Step1, Step2, Step3, Step4, Step5, Step6, Step7, Stat, type Payload, type PriorState, type Setter } from "./steps";
import { ReviewReport } from "./report";

export const STEPS = [
  { n: 1, title: "Engineering & Products", q: "What did I build this week?" },
  { n: 2, title: "Sales & Business Development", q: "What did I sell this week?" },
  { n: 3, title: "Customer Feedback & Retention", q: "Are customers satisfied with our products and services?" },
  { n: 4, title: "Financial Performance", q: "Is WAGNOVATE becoming financially stronger?" },
  { n: 5, title: "Problems & Bottlenecks", q: "What prevented WAGNOVATE from progressing this week?" },
  { n: 6, title: "Lessons Learned", q: "What did this week teach me as a founder?" },
  { n: 7, title: "Next Week's Priority", q: "If I could accomplish only ONE thing next week, what would it be?" },
];

export function ReviewWizard({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["review", id], queryFn: () => api<Payload>(`/api/reviews/${id}`) });
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-16 rounded-panel" /><Skeleton className="h-96 rounded-panel" /></div>;
  if (q.isError || !q.data) return <EmptyState title="This review could not be loaded" hint={(q.error as Error)?.message} />;
  if (q.data.review.status === "COMPLETED") return <ReviewReport p={q.data} />;
  return <Wizard p={q.data} id={id} />;
}

function Wizard({ p, id }: { p: Payload; id: string }) {
  const router = useRouter(); const qc = useQueryClient(); const toast = useToast();
  const [step, setStep] = useState(Math.min(8, Math.max(1, p.review.currentStep)));
  const [d, setD] = useState<Record<string, Record<string, any>>>(p.review.data ?? {});
  const [prior, setPriorState] = useState<PriorState>({ outcome: p.review.priorOutcome, explanation: p.review.priorExplanation ?? "", action: p.review.priorAction });
  const [state, setState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const dirty = useRef(false);
  const top = useRef<HTMLDivElement>(null);

  const save = useMutation({
    mutationFn: (extra: { currentStep?: number } = {}) => api(`/api/reviews/${id}`, { method: "PATCH", body: { data: d, currentStep: extra.currentStep ?? step, priorOutcome: prior.outcome, priorExplanation: prior.explanation, priorAction: prior.action } }),
    onMutate: () => setState("saving"),
    onSuccess: () => { dirty.current = false; setState("saved"); qc.invalidateQueries({ queryKey: ["review", id] }); qc.invalidateQueries({ queryKey: ["reviews"] }); },
    onError: (e: Error) => { setState("error"); toast.err(e.message); },
  });
  const complete = useMutation({
    mutationFn: async () => { await save.mutateAsync({ currentStep: 8 }); return api(`/api/reviews/${id}/complete`, { method: "POST", body: {} }); },
    onSuccess: () => { toast.ok("Weekly review completed and saved to history."); qc.invalidateQueries({ queryKey: ["review", id] }); qc.invalidateQueries({ queryKey: ["reviews"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: Error) => toast.err(e.message),
  });

  // Autosave 1.2 s after the last keystroke, so leaving and coming back never loses work.
  useEffect(() => {
    if (!dirty.current) return;
    setState("dirty");
    const t = setTimeout(() => save.mutate({}), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, prior]);

  const set: Setter = (s, k, v) => { dirty.current = true; setD((x) => ({ ...x, [s]: { ...(x[s] ?? {}), [k]: v } })); };
  const setPrior = (v: Partial<PriorState>) => { dirty.current = true; setPriorState((x) => ({ ...x, ...v })); };
  const go = (n: number) => { setStep(n); save.mutate({ currentStep: n }); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const ws = p.review.weekStart.slice(0, 10), we = p.review.weekEnd.slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);
  const common = { p, d, set, weekQuery: { from: ws, to: we }, weekDefault: todayIso >= ws && todayIso <= we ? todayIso : we };
  const meta = STEPS[Math.min(step, 7) - 1];

  return (
    <div ref={top} className="scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Weekly CEO review · {fmtDate(parseDate(ws))} – {fmtDate(parseDate(we))}</p>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{step === 8 ? "Review summary" : `Step ${step} of 7 — ${meta.title}`}</h1>
          <p className="text-sm text-muted">{step === 8 ? "Check everything before you submit. A completed review is saved to history and cannot be edited." : meta.q}</p>
        </div>
        <span role="status" className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs", state === "error" ? "border-bad/50 text-bad" : "border-line text-muted")}>
          {state === "saved" ? <><Check className="h-3.5 w-3.5 text-good" />Draft saved</> : state === "saving" ? "Saving…" : state === "error" ? "Not saved — try again" : "Unsaved changes…"}
        </span>
      </div>

      {/* progress */}
      <nav aria-label="Review progress" className="mb-4">
        <ol className="grid grid-cols-8 gap-1.5">
          {[...STEPS.map((s) => s.n), 8].map((n) => (
            <li key={n}>
              <button onClick={() => go(n)} aria-current={step === n ? "step" : undefined} aria-label={n === 8 ? "Summary" : STEPS[n - 1].title}
                className={cn("group w-full text-left")}>
                <motion.div className={cn("h-1.5 rounded-full", n < step ? "bg-accent" : n === step ? "bg-cyan" : "bg-line")} layout />
                <span className={cn("mt-1 hidden text-[10px] leading-tight sm:block", n === step ? "text-fg" : "text-muted")}>{n === 8 ? "Submit" : STEPS[n - 1].title.split(" & ")[0]}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ type: "spring", stiffness: 320, damping: 32 }}>
          <Panel>
            {step === 1 && <Step1 {...common} />}
            {step === 2 && <Step2 {...common} />}
            {step === 3 && <Step3 {...common} />}
            {step === 4 && <Step4 {...common} />}
            {step === 5 && <Step5 {...common} />}
            {step === 6 && <Step6 {...common} />}
            {step === 7 && <Step7 {...common} prior={prior} setPrior={setPrior} />}
            {step === 8 && <Summary p={p} d={d} prior={prior} />}
          </Panel>
        </motion.div>
      </AnimatePresence>

      <div className="no-print sticky bottom-[64px] z-20 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel/95 p-2.5 backdrop-blur lg:bottom-3">
        <Button onClick={() => go(step - 1)} disabled={step === 1}><ArrowLeft className="h-4 w-4" />Previous</Button>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate({}, { onSuccess: () => toast.ok("Draft saved. You can continue later.") })} loading={save.isPending}><Save className="h-4 w-4" />Save draft</Button>
          {step < 8 ? <Button variant="primary" onClick={() => go(step + 1)}>{step === 7 ? "Save and review summary" : "Save and Continue"}<ArrowRight className="h-4 w-4" /></Button>
            : <Button variant="primary" loading={complete.isPending} disabled={p.problems.length > 0} onClick={() => complete.mutate()}><CheckCircle2 className="h-4 w-4" />Complete review</Button>}
        </div>
      </div>
      <button className="hidden" onClick={() => router.refresh()} aria-hidden />
    </div>
  );
}

function Summary({ p, d, prior }: { p: Payload; d: Record<string, Record<string, any>>; prior: PriorState }) {
  const c = p.context;
  const blocking = p.problems.length ? p.problems : [];
  const noted = ["s1", "s2", "s3", "s4", "s5"].filter((k) => d[k]?.notes).length;
  const reflections = Object.entries(d.s6 ?? {}).filter(([, v]) => String(v).trim()).length;
  return (
    <div className="space-y-4">
      {blocking.length > 0 ? (
        <div role="alert" className="rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold text-warn"><AlertTriangle className="h-4 w-4" />Finish these before you can complete the review</p>
          <ul className="list-disc space-y-0.5 pl-5">{blocking.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      ) : <p className="rounded-xl border border-good/40 bg-good/10 p-3 text-sm text-good">Everything required is complete. Review the summary below, then submit.</p>}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Engineering completed" value={c.engineering.completed} /><Stat label="Contracts signed" value={c.sales.contractsSigned.length} />
        <Stat label="Feedback received" value={c.feedback.count} sub={c.feedback.avgRating === null ? "No ratings" : `${c.feedback.avgRating}/5 average`} /><Stat label="Net cash flow" value={`GHS ${c.finance.net.toLocaleString("en-GH")}`} tone={c.finance.net < 0 ? "bad" : undefined} />
        <Stat label="Open problems" value={c.problems.open.length} /><Stat label="Reflections answered" value={`${reflections} of 8`} /><Stat label="Section notes written" value={`${noted} of 5`} />
        <Stat label="Last week's priority" value={prior.outcome ? (prior.outcome === "COMPLETED" ? "Completed" : prior.outcome === "PARTIAL" ? "Partial" : "Not completed") : p.prior ? "Not assessed" : "None set"} />
      </div>
      <div className="rounded-xl border border-line bg-panel2/50 p-3">
        <p className="eyebrow mb-1">Next week's priority</p>
        {p.next ? <><p className="font-semibold">{p.next.title}</p><p className="text-sm text-muted">{p.next.objective}</p><div className="mt-1 flex gap-2"><Badge tone="violet">{p.next.category}</Badge><span className="num text-xs text-muted">Deadline {fmtDate(parseDate(p.next.deadline))}</span></div></> : <p className="text-sm text-warn">No priority chosen yet.</p>}
      </div>
      <p className="text-xs text-muted">When you submit, an executive summary is written from your saved records (by AI if you set an API key in Settings, otherwise by the built-in rule-based writer), your reflections are added to the lessons library, and the whole review is frozen into history.</p>
    </div>
  );
}
