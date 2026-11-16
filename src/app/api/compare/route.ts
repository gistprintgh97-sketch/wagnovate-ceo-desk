import { route, AppError } from "@/server/api";
import { compare } from "@/server/reports";
import { parseDate, today } from "@/lib/dates";

export const GET = route({}, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode") ?? "month";
  if (!["week", "month", "quarter", "year"].includes(mode)) throw new AppError(400, "Choose week, month, quarter or year.");
  const anchor = sp.get("anchor") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("anchor")!) ? parseDate(sp.get("anchor")!) : today();
  return compare(mode as "week" | "month" | "quarter" | "year", anchor);
});
