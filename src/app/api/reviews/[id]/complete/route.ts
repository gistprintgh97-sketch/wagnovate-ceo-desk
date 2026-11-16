import { route } from "@/server/api";
import { completeReview } from "@/server/review";

export const POST = route({}, async ({ params }) => {
  const r = await completeReview(params.id);
  return { id: r.id, status: r.status, summarySource: r.summarySource };
});
