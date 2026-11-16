import { route } from "@/server/api";
import { financeOverview, resolveRange } from "@/server/reports";

export const GET = route({}, async ({ req }) => {
  const { range, preset } = resolveRange(req.nextUrl.searchParams);
  return financeOverview(range, preset);
});
