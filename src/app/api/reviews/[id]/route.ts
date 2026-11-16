import { z } from "zod";
import { route } from "@/server/api";
import { completionProblems, loadReview, saveDraft } from "@/server/review";

export const GET = route({}, async ({ params }) => {
  const p = await loadReview(params.id);
  const problems = p.frozen ? [] : completionProblems(p.review, p.prior, p.next);
  return { ...p, problems };
});

const val = z.union([z.string().max(5000), z.number(), z.boolean()]);
const body = z.object({
  currentStep: z.number().int().min(1).max(8).optional(),
  data: z.record(z.string().max(10), z.record(z.string().max(40), val)).optional(),
  priorOutcome: z.enum(["COMPLETED", "PARTIAL", "NOT_COMPLETED"]).nullable().optional(),
  priorExplanation: z.string().max(2000).nullable().optional(),
  priorAction: z.enum(["RESCHEDULE", "REPLACE"]).nullable().optional(),
});
export const PATCH = route({ body }, async ({ params, body }) => saveDraft(params.id, body));
