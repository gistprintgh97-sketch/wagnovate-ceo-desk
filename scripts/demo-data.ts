/**
 * OPTIONAL demo data for trying the app. Customers and figures are FICTIONAL.
 * The app itself never contains hardcoded figures: everything on screen is read from the database.
 *
 *   pnpm db:demo            adds demo data (refuses if real data already exists)
 *   pnpm db:demo -- --wipe  deletes ALL business records first (development only)
 */
import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";

const db = new PrismaClient();
const DAY = 86_400_000;
const now = new Date();
const T = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const Y = T.getUTCFullYear();
const off = (n: number) => new Date(T.getTime() + n * DAY);
const md = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const monday = (d: Date) => new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY);
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));

async function wipe() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to wipe a production database.");
  for (const t of ["uploadedDocument", "financialTransaction", "invoice", "customerFeedback", "contract", "salesLead", "task", "projectMilestone", "engineeringAchievement",
    "businessProblem", "lessonLearned", "strategicPriority", "cEOReview", "project", "customer", "notification", "target"] as const) {
    await (db[t] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();
  }
  console.log("All business records deleted.");
}

async function main() {
  if (process.argv.includes("--wipe")) await wipe();
  if ((await db.customer.count()) + (await db.financialTransaction.count()) > 0) {
    console.log("The database already has business records. Run with --wipe to replace them with demo data.");
    return;
  }

  // ── targets ──
  const targets: [string, number][] = [["SOFTWARE_DEVELOPMENT", 180000], ["WAG_SMS_SUBSCRIPTIONS", 120000], ["WAG_POS_SUBSCRIPTIONS", 60000], ["MAINTENANCE_SUPPORT", 36000], ["CONSULTING", 24000]];
  for (const [category, annual] of targets) await db.target.create({ data: { year: Y, category, annual } });

  // ── projects ──
  const mk = (data: Prisma.ProjectUncheckedCreateInput) => db.project.create({ data });
  const pSms = await mk({ name: "WAG SMS", category: "WAG_SMS", status: "ACTIVE", startDate: md(Y - 2, 5, 1), description: "School management product." });
  const pPos = await mk({ name: "WAG POS", category: "WAG_POS", status: "ACTIVE", startDate: md(Y - 1, 2, 1), description: "Point-of-sale product." });
  await mk({ name: "Internal Business Projects", category: "INTERNAL_TOOLS", status: "ACTIVE", startDate: md(Y, 0, 1) });
  await mk({ name: "Client Projects", category: "CLIENT_PROJECTS", status: "ACTIVE", startDate: md(Y, 0, 1) });

  // ── customers ──
  const C: { name: string; contact: string; loc: string; product: string; fee: number; since: Date; status?: "AT_RISK" }[] = [
    { name: "Greenfield Academy", contact: "Ama Mensah", loc: "Kumasi, Ghana", product: "WAG SMS", fee: 2400, since: md(Y - 1, 8, 1) },
    { name: "Lakeside International School", contact: "Kojo Asante", loc: "Tema, Ghana", product: "WAG SMS", fee: 3200, since: md(Y - 1, 9, 1) },
    { name: "Northern Star Basic School", contact: "Fatima Issah", loc: "Tamale, Ghana", product: "WAG SMS", fee: 1500, since: md(Y, 1, 1) },
    { name: "Coastline Mart", contact: "Yaw Boateng", loc: "Takoradi, Ghana", product: "WAG POS", fee: 1800, since: md(Y - 1, 10, 1), status: "AT_RISK" },
    { name: "Osu Pharmacy Group", contact: "Efua Quaye", loc: "Accra, Ghana", product: "WAG POS", fee: 2200, since: md(Y, 0, 1) },
    { name: "Cape Coast Trading Co", contact: "Kwesi Appiah", loc: "Cape Coast, Ghana", product: "WAG POS", fee: 1200, since: md(Y, 2, 1) },
    { name: "Sunyani Fresh Foods", contact: "Abena Owusu", loc: "Sunyani, Ghana", product: "WAG POS", fee: 1400, since: md(Y, 4, 1) },
    { name: "Volta Hardware", contact: "Mawuli Dzah", loc: "Ho, Ghana", product: "WAG POS", fee: 1000, since: md(Y, 5, 1) },
    { name: "Lagos Retail Hub", contact: "Chidi Okafor", loc: "Lagos, Nigeria", product: "WAG POS", fee: 3500, since: md(Y, 6, 1) },
    { name: "Thames Learning Ltd", contact: "Sarah Clarke", loc: "London, UK", product: "WAG SMS", fee: 4200, since: md(Y, 7, 1) },
  ];
  const custs = [];
  for (const c of C) custs.push(await db.customer.create({ data: { name: c.name, contactPerson: c.contact, location: c.loc, product: c.product, status: c.status ?? "ACTIVE", since: c.since, phone: "+233200000000", email: `info@${c.name.toLowerCase().replace(/[^a-z]+/g, "")}.example` } }));

  // ── contracts + monthly invoices + payments + expenses ──
  let invNo = 0;
  const cur = T.getUTCMonth();
  for (let i = 0; i < C.length; i++) {
    const c = C[i], cu = custs[i];
    const cat = c.product === "WAG SMS" ? "WAG_SMS_SUBSCRIPTIONS" : "WAG_POS_SUBSCRIPTIONS";
    const startM = c.since.getUTCFullYear() === Y ? c.since.getUTCMonth() : 0;
    const endDate = i === 3 ? off(21) : md(Y + 1, 11, 31);
    const contract = await db.contract.create({ data: { customerId: cu.id, title: `${c.product} subscription – ${c.name}`, product: c.product, value: c.fee * 12, signedDate: c.since, startDate: c.since, endDate, paymentArrangement: "Monthly in advance", status: "ACTIVE" } });
    for (let m = startM; m <= cur; m++) {
      const issue = md(Y, m, 1), due = md(Y, m, 15);
      invNo++;
      const unpaid = (i === 3 && m >= cur - 2) || (i === 6 && m === cur - 1) || m === cur; // a few unpaid, current month still open
      const partial = i === 8 && m === cur - 1;
      const inv = await db.invoice.create({ data: { number: `INV-${Y}-${String(invNo).padStart(4, "0")}`, customerId: cu.id, contractId: contract.id, category: cat, amount: c.fee, issueDate: issue, dueDate: due, status: "SENT" } });
      if (!unpaid) {
        const pay = partial ? Math.round(c.fee * 0.5) : c.fee;
        const when = md(Y, m, between(5, 24));
        await db.financialTransaction.create({ data: { title: `${c.name} – ${issue.toISOString().slice(0, 7)} subscription`, type: "INCOME", amount: pay, category: cat, date: when > T ? T : when, paymentMethod: i % 3 === 0 ? "BANK_TRANSFER" : "MTN_MOMO", customerId: cu.id, invoiceId: inv.id, contractId: contract.id, reference: `PAY${invNo}` } });
      }
    }
    // last year's smaller history, for year-over-year comparison
    if (c.since.getUTCFullYear() < Y) {
      for (let m = c.since.getUTCMonth(); m <= 11; m++) await db.financialTransaction.create({ data: { title: `${c.name} – ${Y - 1}-${m + 1} subscription`, type: "INCOME", amount: Math.round(c.fee * 0.9), category: cat, date: md(Y - 1, m, 12), paymentMethod: "MTN_MOMO", customerId: cu.id } });
    }
  }
  // custom development + consulting income
  const dev: [number, number, string, number, number][] = [[1, 12, "School portal build – Greenfield", 18000, 0], [3, 20, "Inventory module – Coastline", 12000, 3], [5, 8, "Custom reporting – Lakeside", 15000, 1], [7, 25, "Mobile app MVP – Lagos Retail", 22000, 8], [9, 10, "Parent app – Thames Learning", 26000, 9]];
  for (const [m, d, title, amt, ci] of dev) if (m <= cur) await db.financialTransaction.create({ data: { title, type: "INCOME", amount: amt, category: "SOFTWARE_DEVELOPMENT", date: md(Y, m, d) > T ? T : md(Y, m, d), paymentMethod: "BANK_TRANSFER", customerId: custs[ci].id } });
  for (const m of [2, 6, 9]) if (m <= cur) await db.financialTransaction.create({ data: { title: "Systems consulting", type: "INCOME", amount: between(3500, 6500), category: "CONSULTING", date: md(Y, m, 18), paymentMethod: "MTN_MOMO", customerId: custs[m % 4].id } });
  for (let m = 0; m <= cur; m++) await db.financialTransaction.create({ data: { title: "Support retainer", type: "INCOME", amount: between(2200, 3200), category: "MAINTENANCE_SUPPORT", date: md(Y, m, 28) > T ? T : md(Y, m, 28), paymentMethod: "MTN_MOMO" } });

  // an unpaid development invoice, well overdue
  await db.invoice.create({ data: { number: `INV-${Y}-9001`, customerId: custs[3].id, category: "SOFTWARE_DEVELOPMENT", amount: 8500, issueDate: off(-70), dueDate: off(-40), status: "SENT", notes: "Custom reporting module" } });

  // expenses
  const exp: [string, string, number, number][] = [["Cloud servers", "HOSTING_SERVERS", 1800, 2600], ["Internet and data", "INTERNET_COMMUNICATION", 600, 900], ["Developer tools and subscriptions", "DEVELOPER_TOOLS", 400, 700], ["Marketing – social ads", "MARKETING", 700, 2200], ["Contract developer payment", "STAFF_PAYMENTS", 6000, 9000], ["Transport", "TRANSPORTATION", 250, 600]];
  for (let m = 0; m <= cur; m++) for (const [title, category, lo, hi] of exp) {
    const date = md(Y, m, between(3, 26));
    await db.financialTransaction.create({ data: { title, type: "EXPENSE", amount: between(lo, hi), category, date: date > T ? T : date, paymentMethod: "MTN_MOMO" } });
  }
  for (let m = 0; m <= 11; m++) await db.financialTransaction.create({ data: { title: "Hosting and tools", type: "EXPENSE", amount: between(9000, 11000), category: "HOSTING_SERVERS", date: md(Y - 1, m, 10), paymentMethod: "MTN_MOMO" } });

  // ── client projects with milestones ──
  const p1 = await mk({ name: "Parent app – Thames Learning", category: "CLIENT_PROJECTS", customerId: custs[9].id, status: "ACTIVE", startDate: off(-95), targetDate: off(25), budget: 26000 });
  const p2 = await mk({ name: "Mobile app MVP – Lagos Retail", category: "CLIENT_PROJECTS", customerId: custs[8].id, status: "ACTIVE", startDate: off(-120), targetDate: off(-18), budget: 22000, notes: "Delayed by client content." });
  await mk({ name: "School portal build – Greenfield", category: "CLIENT_PROJECTS", customerId: custs[0].id, status: "COMPLETED", startDate: off(-260), targetDate: off(-190), completedAt: off(-176), budget: 18000 });
  await mk({ name: "Inventory module – Coastline", category: "CLIENT_PROJECTS", customerId: custs[3].id, status: "COMPLETED", startDate: off(-210), targetDate: off(-130), completedAt: off(-140), budget: 12000 });
  for (const [pid, title, due, done] of [[p1.id, "Design approved", -60, -58], [p1.id, "Beta release", -10, -5], [p1.id, "Go live", 25, null], [p2.id, "Backend complete", -50, -45], [p2.id, "App store submission", -18, null]] as [string, string, number, number | null][])
    await db.projectMilestone.create({ data: { projectId: pid, title, dueDate: off(due), doneAt: done === null ? null : off(done) } });

  // ── sales pipeline ──
  const leads: [string, string, number, Prisma.SalesLeadCreateInput["stage"], number | null][] = [
    ["Evergreen College", "WAG SMS", 18000, "NEGOTIATION", 2], ["Mensah Supermarket", "WAG POS", 9000, "PROPOSAL_SENT", -1], ["Bright Future School", "WAG SMS", 12000, "DEMO_SCHEDULED", 3],
    ["Kasoa Pharmacy", "WAG POS", 6000, "INTERESTED", -3], ["Aflao Stores", "WAG POS", 4500, "CONTACTED", 5], ["Ridge Clinic", "Custom software", 30000, "NEW_LEAD", 7],
    ["Prime Logistics", "Custom software", 25000, "WON", null], ["Hilltop School", "WAG SMS", 8000, "WON", null], ["Metro Bakery", "WAG POS", 3000, "LOST", null], ["Unity Basic", "WAG SMS", 5000, "LOST", null], ["Zion Mart", "WAG POS", 3500, "LOST", null],
  ];
  for (const [businessName, product, value, stage, fu] of leads) await db.salesLead.create({ data: { businessName, product, value, stage, nextFollowUp: fu === null ? null : off(fu), contactPerson: "Contact Person", stageChangedAt: off(-between(3, 60)) } });

  // ── feedback ──
  const fb: [number, number, "POSITIVE" | "COMPLAINT" | "TECHNICAL_ISSUE" | "FEATURE_REQUEST", number | null, "OPEN" | "RESOLVED", string][] = [
    [0, -12, "POSITIVE", 5, "RESOLVED", "Parents love the fee reminders."], [1, -9, "FEATURE_REQUEST", 4, "OPEN", "Wants bulk SMS scheduling."], [2, -20, "POSITIVE", 5, "RESOLVED", "Easy for our staff to learn."],
    [3, -15, "COMPLAINT", 2, "OPEN", "Receipts print slowly at the till."], [3, -6, "TECHNICAL_ISSUE", 2, "OPEN", "Sync failed twice this week."], [4, -4, "POSITIVE", 4, "RESOLVED", "Stock reports are helpful."], [9, -3, "POSITIVE", 5, "RESOLVED", "Very responsive support."],
  ];
  for (const [ci, d, category, rating, resolution, comments] of fb) await db.customerFeedback.create({ data: { customerId: custs[ci].id, date: off(d), category, rating, resolution, comments, product: C[ci].product, severity: category === "COMPLAINT" || category === "TECHNICAL_ISSUE" ? "HIGH" : null, followUpDate: resolution === "OPEN" ? off(-1) : null, actionRequired: resolution === "OPEN" ? "Call customer and confirm fix" : null } });

  // ── problems, lessons, tasks, achievements, priorities ──
  await db.businessProblem.create({ data: { title: "POS sync failures for Coastline Mart", department: "ENGINEERING", severity: "CRITICAL", status: "INVESTIGATING", identifiedAt: off(-6), deadline: off(2), description: "Offline sales do not sync reliably.", solution: "Rewrite the queue retry logic." } });
  await db.businessProblem.create({ data: { title: "No second developer for support cover", department: "LEADERSHIP", severity: "HIGH", status: "OPEN", identifiedAt: off(-20), rootCause: "All support depends on one person." } });
  await db.businessProblem.create({ data: { title: "Slow invoice follow-up", department: "FINANCE", severity: "MEDIUM", status: "RESOLVED", identifiedAt: off(-40), resolvedAt: off(-30), lessons: "Send reminders 3 days before the due date." } });
  await db.lessonLearned.create({ data: { title: "Quote fixed scope, not hours", description: "Open-ended quotes caused delays on the Lagos app.", category: "LESSON", date: off(-8), proposedAction: "Use a scope checklist on every proposal.", projectId: p2.id } });
  await db.lessonLearned.create({ data: { title: "Stop doing support by phone call", description: "It breaks deep work.", category: "STOP", date: off(-8) } });
  const t = (title: string, due: number | null, status: "TODO" | "IN_PROGRESS" | "DONE", priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT", department: "ENGINEERING" | "SALES" | "FINANCE" | "LEADERSHIP") =>
    db.task.create({ data: { title, dueDate: due === null ? null : off(due), status, priority, department, completedAt: status === "DONE" ? off(-1) : null } });
  await t("Fix POS sync retry logic", 0, "IN_PROGRESS", "URGENT", "ENGINEERING"); await t("Send Evergreen proposal revision", 0, "TODO", "HIGH", "SALES");
  await t("Chase Coastline Mart invoice", -2, "TODO", "HIGH", "FINANCE"); await t("Renew server certificates", 4, "TODO", "MEDIUM", "ENGINEERING"); await t("Prepare Q4 targets", 6, "TODO", "MEDIUM", "LEADERSHIP");
  await t("Release WAG SMS 2.4", -1, "DONE", "HIGH", "ENGINEERING"); await t("Onboard Thames Learning staff", -3, "DONE", "MEDIUM", "ENGINEERING");
  const ach: [string, string, string, number][] = [["WAG SMS", "Fee reminder scheduling", "Feature", -2], ["WAG SMS", "Report card PDF speed-up", "Technical", -3], ["WAG POS", "Fixed receipt printing bug", "Bug fix", -4], ["WAG POS", "Offline queue prototype", "Feature", -9], ["WAG SMS", "Two-factor login", "Security", -10]];
  for (const [projectName, title, kind, d] of ach) await db.engineeringAchievement.create({ data: { category: projectName === "WAG SMS" ? "WAG_SMS" : "WAG_POS", projectName, title, kind, status: "COMPLETED", completedAt: off(d), impact: "Customer-facing improvement" } });
  const ws = monday(T);
  const pr: [number, string, "COMPLETED" | "IN_PROGRESS" | "DELAYED", string, "SALES" | "ENGINEERING" | "FINANCE", number][] = [
    [-28, "Sign three new WAG POS customers", "COMPLETED", "WON", "SALES", -22], [-21, "Ship offline mode beta", "DELAYED", "PARTIAL", "ENGINEERING", -15], [-14, "Collect all overdue invoices", "COMPLETED", "WON", "FINANCE", -8], [-7, "Fix POS sync reliability", "COMPLETED", "WON", "ENGINEERING", -1],
  ];
  for (const [w, title, status, , category, dl] of pr) await db.strategicPriority.create({ data: { weekStart: new Date(ws.getTime() + w * DAY), category, title, objective: title, expectedResult: "Measurable result delivered", firstAction: "Plan the first step", deadline: off(dl), successMeasure: "Done and verified", status, outcome: status === "COMPLETED" ? "COMPLETED" : "PARTIAL" } });
  await db.strategicPriority.create({ data: { weekStart: ws, category: "ENGINEERING", title: "Stabilise POS sync for all customers", objective: "Customers can sell offline and sync without errors.", expectedResult: "Zero sync failures for 7 days", firstAction: "Reproduce the failure with the Coastline data", deadline: off(5), successMeasure: "No sync complaints", status: "IN_PROGRESS" } });
  void pSms; void pPos;
  console.log("Demo data added. Sign in and open the Overview.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
