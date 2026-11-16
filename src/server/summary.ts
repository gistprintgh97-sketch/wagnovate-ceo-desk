// Executive summary: answers the seven questions from spec section 8.
// With an AI key configured, a model writes it from the saved facts. Without one (or if the AI call fails),
// a rule-based writer produces it. Both use ONLY recorded data; missing information is stated as "not recorded".
import { decrypt } from "./crypto";
import { ghs } from "@/lib/money";
import { label } from "@/config/enums";
import type { ReviewContext } from "./review-context";
import type { getSettings } from "./settings";

export type Facts = {
  context: ReviewContext;
  narrative: Record<string, Record<string, unknown>>;
  prior: { title: string; outcome: string | null; explanation: string | null } | null;
  next: { title: string; category: string; objective: string; expectedResult: string; firstAction: string; deadline: string; successMeasure: string } | null;
};

const QUESTIONS = [
  "How did the business perform this week?",
  "What were the biggest achievements?",
  "What were the biggest weaknesses?",
  "What financial changes occurred?",
  "What customer issues require attention?",
  "What opportunities should the CEO pursue?",
  "What is the most important priority for next week?",
];

const pct = (v: number | null) => (v === null ? "no valid comparison (no prior-week data)" : `${v > 0 ? "+" : ""}${v}%`);

export function ruleSummary(f: Facts): string {
  const c = f.context;
  const noData = !c.engineering.total && !c.finance.transactions && !c.feedback.count && !c.sales.newLeads && !c.problems.newThisWeek.length;
  const out: string[] = [];

  // 1
  const parts: string[] = [];
  if (c.engineering.total) parts.push(`${c.engineering.completed} engineering item${c.engineering.completed === 1 ? "" : "s"} completed${c.engineering.tasksCompleted ? ` and ${c.engineering.tasksCompleted} task${c.engineering.tasksCompleted === 1 ? "" : "s"} finished` : ""}`);
  if (c.sales.newLeads || c.sales.contractsSigned.length) parts.push(`${c.sales.newLeads} new prospect${c.sales.newLeads === 1 ? "" : "s"} and ${c.sales.contractsSigned.length} contract${c.sales.contractsSigned.length === 1 ? "" : "s"} signed`);
  if (c.finance.transactions) parts.push(`${ghs(c.finance.income)} received against ${ghs(c.finance.expenses)} paid out (net cash flow ${ghs(c.finance.net)})`);
  out.push(`### ${QUESTIONS[0]}\n${noData ? "Very little was recorded for this week, so performance cannot be assessed. Activity not recorded." : parts.length ? `This week: ${parts.join("; ")}.` : "No engineering, sales or financial activity was recorded."}`);

  // 2
  const wins: string[] = [];
  c.engineering.items.filter((a) => a.status === "COMPLETED").slice(0, 3).forEach((a) => wins.push(`Completed: ${a.title}${a.product ? ` (${a.product})` : ""}`));
  c.sales.contractsSigned.slice(0, 2).forEach((s) => wins.push(`Signed contract with ${s.customer} worth ${ghs(s.value)}`));
  c.sales.won.slice(0, 2).forEach((w) => wins.push(`Won deal: ${w.name}`));
  if (f.prior?.outcome === "COMPLETED") wins.push(`Last week's priority was completed: ${f.prior.title}`);
  out.push(`### ${QUESTIONS[1]}\n${wins.length ? wins.map((w) => `- ${w}`).join("\n") : "No achievements were recorded this week."}`);

  // 3
  const weak: string[] = [];
  c.problems.open.filter((p) => p.severity === "CRITICAL").forEach((p) => weak.push(`Critical problem still open: ${p.title} (${p.daysOpen} days)`));
  if (c.finance.overdueCount) weak.push(`${c.finance.overdueCount} overdue invoice${c.finance.overdueCount === 1 ? "" : "s"} totalling ${ghs(c.finance.overdueAmount)}`);
  c.sales.lost.forEach((l) => weak.push(`Deal lost: ${l.name}`));
  if (f.prior && f.prior.outcome && f.prior.outcome !== "COMPLETED") weak.push(`Last week's priority was ${f.prior.outcome === "PARTIAL" ? "only partly" : "not"} completed: ${f.prior.title}${f.prior.explanation ? ` — ${f.prior.explanation}` : ""}`);
  if (c.finance.transactions && c.finance.expenses > c.finance.income) weak.push(`Expenses (${ghs(c.finance.expenses)}) were higher than income (${ghs(c.finance.income)})`);
  out.push(`### ${QUESTIONS[2]}\n${weak.length ? weak.map((w) => `- ${w}`).join("\n") : "No weaknesses were identified in the recorded data."}`);

  // 4
  const fin: string[] = [];
  if (!c.finance.transactions) fin.push("No financial transactions were recorded this week (not recorded).");
  else {
    fin.push(`Income ${ghs(c.finance.income)} (${pct(c.finance.incomeChangePct)} versus last week).`);
    fin.push(`Expenses ${ghs(c.finance.expenses)} (${pct(c.finance.expenseChangePct)} versus last week).`);
    fin.push(`Net cash flow ${ghs(c.finance.net)}.`);
  }
  fin.push(`Outstanding invoices now: ${ghs(c.finance.outstanding)} across ${c.finance.outstandingCount}.`);
  out.push(`### ${QUESTIONS[3]}\n${fin.join(" ")}`);

  // 5
  const cust: string[] = [];
  c.feedback.unresolved.slice(0, 4).forEach((u) => cust.push(`${u.customer}: unresolved ${label(u.category).toLowerCase()} — ${u.comments}`));
  c.feedback.repeatedTechnical.forEach((r) => cust.push(`${r.customer} reported ${r.count} technical issues in 90 days`));
  c.feedback.atRisk.forEach((n) => cust.push(`${n} is marked as at risk of leaving`));
  out.push(`### ${QUESTIONS[4]}\n${cust.length ? cust.map((x) => `- ${x}`).join("\n") : "No unresolved customer issues are recorded."}${c.feedback.avgRating !== null ? `\nAverage satisfaction this week: ${c.feedback.avgRating}/5 from ${c.feedback.ratedCount} rating(s).` : "\nNo satisfaction ratings were recorded this week."}`);

  // 6
  const opp: string[] = [];
  const hot = c.sales.pipeline.stages.filter((s) => ["NEGOTIATION", "PROPOSAL_SENT", "DEMO_SCHEDULED"].includes(s.stage) && s.count > 0);
  hot.forEach((s) => opp.push(`${s.count} opportunit${s.count === 1 ? "y" : "ies"} at ${label(s.stage)} worth ${ghs(s.value)}`));
  if (c.sales.pipeline.pipelineValue) opp.push(`Total open pipeline: ${ghs(c.sales.pipeline.pipelineValue)}`);
  c.feedback.items.filter((x) => x.category === "FEATURE_REQUEST").slice(0, 2).forEach((x) => opp.push(`Feature request from ${x.customer}: ${x.comments}`));
  out.push(`### ${QUESTIONS[5]}\n${opp.length ? opp.map((o) => `- ${o}`).join("\n") : "No open opportunities are recorded."}`);

  // 7
  out.push(`### ${QUESTIONS[6]}\n${f.next ? `**${f.next.title}** (${label(f.next.category)}). Objective: ${f.next.objective} Expected result: ${f.next.expectedResult} First action: ${f.next.firstAction}. Deadline: ${f.next.deadline}.` : "No priority has been chosen yet."}`);
  return out.join("\n\n");
}

const SYSTEM = `You write the weekly executive report for the CEO of WAGNOVATE Technologies (Accra, Ghana; currency GHS).
Use ONLY the JSON facts provided. Never invent revenue, customers, sales, expenses, achievements or feedback.
If a value is null, zero because nothing was recorded, or absent, say it was "not recorded" rather than guessing.
Do not give percentages unless provided. Answer these seven questions as seven markdown "###" sections in this order, each concise and specific, using the exact headings:
${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n")}
Write for a busy founder: plain words, short bullets where useful, name customers and amounts exactly as given.`;

export async function aiSummary(f: Facts, s: Awaited<ReturnType<typeof getSettings>>): Promise<string> {
  if (!s.aiKeyEnc || s.aiProvider === "none") throw new Error("AI is not configured");
  const key = decrypt(s.aiKeyEnc);
  const payload = JSON.stringify({ week: f.context.week, facts: f.context, ceoNotes: f.narrative, lastWeekPriority: f.prior, nextWeekPriority: f.next });
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    if (s.aiProvider === "anthropic") {
      const res = await fetch(`${s.aiBaseUrl || "https://api.anthropic.com"}/v1/messages`, {
        method: "POST", signal: ctrl.signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: s.aiModel || "claude-sonnet-5-5", max_tokens: 1500, system: SYSTEM, messages: [{ role: "user", content: payload }] }),
      });
      if (!res.ok) throw new Error(`AI provider returned ${res.status}`);
      const j = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = j.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (!text) throw new Error("AI returned no text");
      return text;
    }
    const res = await fetch(`${s.aiBaseUrl || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: s.aiModel || "gpt-4o-mini", messages: [{ role: "system", content: SYSTEM }, { role: "user", content: payload }] }),
    });
    if (!res.ok) throw new Error(`AI provider returned ${res.status}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = j.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("AI returned no text");
    return text;
  } finally { clearTimeout(timer); }
}

export async function generateSummary(f: Facts, s: Awaited<ReturnType<typeof getSettings>>): Promise<{ text: string; source: "AI" | "RULES"; note?: string }> {
  if (s.aiAutoSummary && s.aiProvider !== "none" && s.aiKeyEnc) {
    try { return { text: await aiSummary(f, s), source: "AI" }; }
    catch (e) { console.error("[ai-summary]", (e as Error).message); return { text: ruleSummary(f), source: "RULES", note: "The AI service could not be reached, so the rule-based summary was used." }; }
  }
  return { text: ruleSummary(f), source: "RULES" };
}
