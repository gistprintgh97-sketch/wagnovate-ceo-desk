import { db } from "./db";
import { AppError } from "./api";
import { buildContext, type ReviewContext } from "./review-context";
import { generateSummary, type Facts } from "./summary";
import { getSettings } from "./settings";
import { addDays, iso, today, weekStart } from "@/lib/dates";
import { LESSON_CATEGORY, label } from "@/config/enums";

export const LESSON_KEYS: Record<string, string> = { worked: "WORKED", failed: "FAILED", wasted: "WASTED", stop: "STOP", start: "START", improve: "IMPROVE", delegate: "DELEGATE", lesson: "LESSON" };
type Data = Record<string, Record<string, string | number | boolean>>;

const priorityShape = (p: { id: string; title: string; category: string; objective: string; expectedResult: string; firstAction: string; deadline: Date; successMeasure: string; status: string; weekStart: Date; outcome: string | null; outcomeNote: string | null } | null) =>
  p ? { id: p.id, title: p.title, category: p.category, objective: p.objective, expectedResult: p.expectedResult, firstAction: p.firstAction, deadline: iso(p.deadline), successMeasure: p.successMeasure, status: p.status, weekStart: iso(p.weekStart), outcome: p.outcome, outcomeNote: p.outcomeNote } : null;

export async function createOrGetReview(weekStartIso?: string) {
  const t = today();
  const ws = weekStart(weekStartIso ? new Date(weekStartIso + "T00:00:00Z") : t);
  if (ws > weekStart(t)) throw new AppError(400, "You cannot start a review for a future week.");
  const existing = await db.cEOReview.findUnique({ where: { weekStart: ws } });
  if (existing) return existing;
  return db.cEOReview.create({ data: { weekStart: ws, weekEnd: addDays(ws, 6), data: {} } });
}

export async function loadReview(id: string) {
  const r = await db.cEOReview.findUnique({ where: { id } });
  if (!r) throw new AppError(404, "That review no longer exists.");
  if (r.status === "COMPLETED" && r.snapshot) {
    const snap = r.snapshot as unknown as { context: ReviewContext; prior: ReturnType<typeof priorityShape>; next: ReturnType<typeof priorityShape> };
    return { review: r, context: snap.context, prior: snap.prior, next: snap.next, frozen: true };
  }
  const ws = r.weekStart;
  const [context, prior, next] = await Promise.all([
    buildContext(ws),
    db.strategicPriority.findFirst({ where: { weekStart: ws } }),
    db.strategicPriority.findFirst({ where: { weekStart: addDays(ws, 7) } }),
  ]);
  return { review: r, context, prior: priorityShape(prior), next: priorityShape(next), frozen: false };
}

export async function saveDraft(id: string, body: { currentStep?: number; data?: Data; priorOutcome?: string | null; priorExplanation?: string | null; priorAction?: string | null }) {
  const r = await db.cEOReview.findUnique({ where: { id } });
  if (!r) throw new AppError(404, "That review no longer exists.");
  if (r.status === "COMPLETED") throw new AppError(409, "This review is complete and saved to history. It cannot be changed.");
  const old = (r.data ?? {}) as Data;
  const merged: Data = { ...old };
  for (const [step, vals] of Object.entries(body.data ?? {})) merged[step] = { ...(old[step] ?? {}), ...vals };
  return db.cEOReview.update({
    where: { id },
    data: {
      currentStep: body.currentStep ?? r.currentStep, data: merged as object,
      ...(body.priorOutcome !== undefined ? { priorOutcome: body.priorOutcome as never } : {}),
      ...(body.priorExplanation !== undefined ? { priorExplanation: body.priorExplanation } : {}),
      ...(body.priorAction !== undefined ? { priorAction: body.priorAction } : {}),
    },
  });
}

/** What still blocks completion (shown in the review summary and enforced on submit). */
export function completionProblems(r: { priorOutcome: string | null; priorExplanation: string | null; priorAction: string | null }, prior: { status: string } | null, next: unknown): string[] {
  const out: string[] = [];
  if (prior && prior.status !== "CANCELLED") {
    if (!r.priorOutcome) out.push("Answer “Did you accomplish last week's priority?” in step 7.");
    else if (r.priorOutcome !== "COMPLETED") {
      if (!r.priorExplanation || r.priorExplanation.trim().length < 5) out.push("Explain why last week's priority was not fully completed.");
      if (!r.priorAction) out.push("Choose whether to reschedule or replace last week's incomplete priority.");
    }
  }
  if (!next) out.push("Choose next week's single most important priority (step 7).");
  return out;
}

export async function completeReview(id: string) {
  const r = await db.cEOReview.findUnique({ where: { id } });
  if (!r) throw new AppError(404, "That review no longer exists.");
  if (r.status === "COMPLETED") return r; // idempotent: a double click never creates a second report
  const ws = r.weekStart;
  const [prior, next] = await Promise.all([db.strategicPriority.findFirst({ where: { weekStart: ws } }), db.strategicPriority.findFirst({ where: { weekStart: addDays(ws, 7) } })]);
  const problems = completionProblems(r, prior, next);
  if (problems.length) throw new AppError(400, problems.join(" "));

  const context = await buildContext(ws);
  const settings = await getSettings();
  const data = (r.data ?? {}) as Data;
  const facts: Facts = {
    context, narrative: data,
    prior: prior && prior.status !== "CANCELLED" ? { title: prior.title, outcome: r.priorOutcome, explanation: r.priorExplanation } : null,
    next: next ? { title: next.title, category: next.category, objective: next.objective, expectedResult: next.expectedResult, firstAction: next.firstAction, deadline: iso(next.deadline), successMeasure: next.successMeasure } : null,
  };
  const summary = await generateSummary(facts, settings);

  await db.$transaction(async (tx) => {
    if (prior && prior.status !== "CANCELLED" && r.priorOutcome) {
      const status = r.priorOutcome === "COMPLETED" ? "COMPLETED" : r.priorAction === "REPLACE" ? "CANCELLED" : "DELAYED";
      await tx.strategicPriority.update({ where: { id: prior.id }, data: { outcome: r.priorOutcome as never, outcomeNote: r.priorExplanation, status } });
    }
    if (next) await tx.strategicPriority.update({ where: { id: next.id }, data: { reviewId: r.id } });
    // The eight reflection answers become entries in the searchable lessons library.
    const s6 = data.s6 ?? {};
    for (const [key, cat] of Object.entries(LESSON_KEYS)) {
      const text = String(s6[key] ?? "").trim();
      if (!text) continue;
      const exists = await tx.lessonLearned.findFirst({ where: { reviewId: r.id, category: cat } });
      if (!exists) await tx.lessonLearned.create({ data: { title: `${label(cat)} — week of ${iso(ws)}`, description: text, category: cat, date: addDays(ws, 6), reviewId: r.id } });
    }
    await tx.cEOReview.update({
      where: { id: r.id },
      data: { status: "COMPLETED", completedAt: new Date(), currentStep: 8, summary: summary.text, summarySource: summary.source, snapshot: JSON.parse(JSON.stringify({ context, prior: priorityShape(prior), next: priorityShape(next), data, note: summary.note ?? null })) },
    });
  });
  return db.cEOReview.findUniqueOrThrow({ where: { id } });
}

export { LESSON_CATEGORY };
