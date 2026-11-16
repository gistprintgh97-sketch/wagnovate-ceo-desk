import { loadReview } from "./review";
import type { Block, PdfSpec } from "./pdf";
import { fmtDate, parseDate } from "@/lib/dates";
import { ghs } from "@/lib/money";
import { label } from "@/config/enums";

type Data = Record<string, Record<string, string | number | boolean>>;
const txt = (v: unknown) => (v === undefined || v === null || v === "" ? "Not recorded" : String(v));

/** The professional weekly CEO report (spec section 7) as PDF blocks. */
export async function weeklyReportSpec(id: string): Promise<PdfSpec> {
  const { review: r, context: c, prior, next } = await loadReview(id);
  const d = (r.data ?? {}) as Data;
  const b: Block[] = [];
  b.push({ t: "kv", rows: [["Review period", `${fmtDate(r.weekStart)} – ${fmtDate(r.weekEnd)}`], ["Status", r.status === "COMPLETED" ? `Completed ${r.completedAt ? fmtDate(r.completedAt) : ""}` : "Draft (not yet completed)"], ["Summary written by", r.summarySource === "AI" ? "AI assistant, from recorded data" : "Rule-based writer, from recorded data"]] });
  b.push({ t: "h2", text: "Executive summary" });
  b.push(r.summary ? { t: "md", text: r.summary } : { t: "p", text: "The summary is generated when the review is completed." });

  b.push({ t: "h2", text: "1. Engineering achievements" });
  b.push({ t: "p", text: `${c.engineering.completed} completed of ${c.engineering.total} recorded · ${c.engineering.tasksCompleted} tasks finished${c.engineering.hours ? ` · ${c.engineering.hours} hours logged` : ""}.` });
  b.push({ t: "table", columns: [{ label: "Achievement", width: 3 }, { label: "Product", width: 1.4 }, { label: "Type", width: 1.2 }, { label: "Status", width: 1 }, { label: "Date", width: 1 }], rows: c.engineering.items.map((a) => [a.title, a.product ?? "", a.kind ?? "", label(a.status), a.date ? fmtDate(a.date) : ""]) });
  if (d.s1?.notes) b.push({ t: "p", text: `Notes: ${d.s1.notes}` });

  b.push({ t: "h2", text: "2. Sales performance" });
  const s2 = d.s2 ?? {};
  b.push({ t: "kv", rows: [["New prospects contacted", txt(s2.prospects)], ["Demonstrations conducted", txt(s2.demos)], ["Quotations submitted", txt(s2.quotations)], ["Proposals submitted", txt(s2.proposals)], ["Existing prospects followed up", txt(s2.followUps)], ["Contracts signed (from records)", String(c.sales.contractsSigned.length)], ["Deals lost (from records)", String(c.sales.lost.length)], ["Open pipeline value", ghs(c.sales.pipeline.pipelineValue)], ["Win rate (all closed deals)", c.sales.pipeline.conversion === null ? "No closed deals yet" : `${c.sales.pipeline.conversion}%`]] });
  if (s2.notes) b.push({ t: "p", text: `Notes: ${s2.notes}` });

  b.push({ t: "h2", text: "3. Customer feedback" });
  b.push({ t: "p", text: c.feedback.count ? `${c.feedback.count} feedback record(s)${c.feedback.avgRating !== null ? `, average rating ${c.feedback.avgRating}/5` : ", no ratings recorded"}.` : "No customer feedback was recorded this week." });
  if (c.feedback.unresolved.length) b.push({ t: "bullets", items: c.feedback.unresolved.map((u) => `${u.customer}: unresolved ${label(u.category).toLowerCase()} — ${u.comments}`) });
  if (d.s3?.notes) b.push({ t: "p", text: `Notes: ${d.s3.notes}` });

  b.push({ t: "h2", text: "4. Financial summary" });
  b.push({ t: "kv", rows: [["Income received", ghs(c.finance.income)], ["Expenses paid", ghs(c.finance.expenses)], ["Net cash flow", ghs(c.finance.net)], ["Previous week net cash flow", c.finance.prevTransactions ? ghs(c.finance.prevNet) : "Not recorded"], ["Outstanding invoices", `${ghs(c.finance.outstanding)} (${c.finance.outstandingCount})`], ["Overdue invoices", `${ghs(c.finance.overdueAmount)} (${c.finance.overdueCount})`]] });
  if (d.s4?.notes) b.push({ t: "p", text: `Notes: ${d.s4.notes}` });

  b.push({ t: "h2", text: "5. Major problems" });
  b.push(c.problems.open.length ? { t: "table", columns: [{ label: "Problem", width: 3 }, { label: "Severity" }, { label: "Status" }, { label: "Department", width: 1.3 }, { label: "Days open", align: "right" }], rows: c.problems.open.map((p) => [p.title, label(p.severity), label(p.status), label(p.department), String(p.daysOpen)]) } : { t: "p", text: "No unresolved problems recorded." });
  if (d.s5?.notes) b.push({ t: "p", text: `Notes: ${d.s5.notes}` });

  b.push({ t: "h2", text: "6. Lessons learned" });
  const s6 = d.s6 ?? {};
  const rows: [string, string][] = [["What worked well", "worked"], ["What failed", "failed"], ["What wasted time or money", "wasted"], ["What to stop doing", "stop"], ["What to start doing", "start"], ["What to improve", "improve"], ["What to delegate or automate", "delegate"], ["Most important lesson", "lesson"]].map(([l, k]) => [l, txt(s6[k])]);
  b.push({ t: "kv", rows });

  b.push({ t: "h2", text: "Previous priority assessment" });
  b.push(prior ? { t: "kv", rows: [["Last week's priority", prior.title], ["Outcome", r.priorOutcome ? label(r.priorOutcome) : "Not yet assessed"], ["Explanation", txt(r.priorExplanation)], ["Next step", r.priorAction ? (r.priorAction === "RESCHEDULE" ? "Rescheduled" : "Replaced") : "—"]] } : { t: "p", text: "No priority was set for this week." });

  b.push({ t: "h2", text: "New strategic priority (next week)" });
  b.push(next ? { t: "kv", rows: [["Priority", next.title], ["Category", label(next.category)], ["Objective", next.objective], ["Expected measurable result", next.expectedResult], ["First action", next.firstAction], ["Deadline", fmtDate(parseDate(next.deadline))], ["Success measurement", next.successMeasure]] } : { t: "p", text: "No priority chosen yet." });
  return { title: "Weekly CEO Report", subtitle: `Week of ${fmtDate(r.weekStart)} to ${fmtDate(r.weekEnd)}`, blocks: b };
}
