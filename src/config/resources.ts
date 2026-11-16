import { z, type ZodTypeAny } from "zod";
import * as E from "./enums";

export type FieldType = "text" | "textarea" | "number" | "int" | "money" | "date" | "select" | "relation" | "email" | "phone";
export type Field = {
  key: string; label: string; type: FieldType;
  required?: boolean; options?: E.Opt[]; relation?: string; rel?: string; // rel = Prisma relation name
  table?: boolean; default?: string | number; hint?: string; min?: number; max?: number; wide?: boolean; filter?: boolean;
  /** Only set by the server (never shown in the form) */
  hidden?: boolean;
};
export type Computed = { key: string; label: string; type: "money" | "percent" | "text" | "date" };
export type ResourceDef = {
  key: string; model: string; label: string; plural: string; fields: Field[];
  search: string[]; orderBy: Record<string, "asc" | "desc">; titleField: string;
  dateField?: string; computed?: Computed[]; uniqueMessage?: string; icon?: string; emptyText: string;
};

const sel = (key: string, label: string, options: E.Opt[], extra: Partial<Field> = {}): Field => ({ key, label, type: "select", options, ...extra });
const rel = (key: string, label: string, relation: string, extra: Partial<Field> = {}): Field => ({ key, label, type: "relation", relation, rel: key.replace(/Id$/, ""), ...extra });

export const RESOURCES: Record<string, ResourceDef> = {
  achievements: {
    key: "achievements", model: "engineeringAchievement", label: "Achievement", plural: "Engineering achievements", titleField: "title",
    search: ["title", "projectName", "description"], orderBy: { completedAt: "desc" }, dateField: "completedAt",
    emptyText: "No engineering achievements recorded yet.",
    fields: [
      { key: "title", label: "What was built or done", type: "text", required: true, table: true },
      sel("category", "Product", E.PRODUCT_CATEGORY, { required: true, table: true, filter: true, default: "WAG_SMS" }),
      { key: "projectName", label: "Project / product name", type: "text", required: true, table: true, default: "" },
      sel("kind", "Type of work", E.ACHIEVEMENT_KIND, { table: true, default: "Feature" }),
      sel("status", "Status", E.WORK_STATUS, { table: true, filter: true, default: "COMPLETED" }),
      { key: "completedAt", label: "Date completed", type: "date", table: true },
      { key: "hours", label: "Time invested (hours, optional)", type: "number", min: 0 },
      { key: "impact", label: "Business impact", type: "textarea", wide: true },
      { key: "description", label: "Description", type: "textarea", wide: true },
      rel("projectId", "Linked project (optional)", "projects"),
    ],
  },
  leads: {
    key: "leads", model: "salesLead", label: "Opportunity", plural: "Sales opportunities", titleField: "businessName",
    search: ["businessName", "contactPerson", "email", "phone", "product"], orderBy: { updatedAt: "desc" },
    emptyText: "No sales opportunities yet. Add your first prospect.",
    fields: [
      { key: "businessName", label: "Customer / business name", type: "text", required: true, table: true },
      { key: "contactPerson", label: "Contact person", type: "text", table: true },
      { key: "phone", label: "Phone number", type: "phone" },
      { key: "email", label: "Email", type: "email" },
      { key: "product", label: "Product or service", type: "text", table: true, hint: "e.g. WAG SMS, WAG POS, Custom software" },
      { key: "value", label: "Expected contract value (GHS)", type: "money", table: true, default: 0 },
      sel("stage", "Current stage", E.LEAD_STAGE, { required: true, table: true, filter: true, default: "NEW_LEAD" }),
      { key: "nextFollowUp", label: "Next follow-up date", type: "date", table: true },
      { key: "notes", label: "Notes", type: "textarea", wide: true },
    ],
  },
  customers: {
    key: "customers", model: "customer", label: "Customer", plural: "Customers", titleField: "name",
    search: ["name", "contactPerson", "email", "phone", "location"], orderBy: { name: "asc" },
    emptyText: "No customers yet. Add a customer, or convert a won opportunity.",
    computed: [{ key: "_outstanding", label: "Outstanding", type: "money" }, { key: "_received", label: "Paid", type: "money" }],
    fields: [
      { key: "name", label: "Customer / business name", type: "text", required: true, table: true },
      { key: "contactPerson", label: "Contact person", type: "text", table: true },
      { key: "phone", label: "Phone", type: "phone", table: true },
      { key: "email", label: "Email", type: "email" },
      { key: "location", label: "Location (city, country)", type: "text", table: true, hint: "Used to place the customer on the dashboard globe, e.g. Kumasi, Ghana" },
      { key: "product", label: "Product purchased", type: "text", table: true },
      sel("status", "Status", E.CUSTOMER_STATUS, { required: true, table: true, filter: true, default: "ACTIVE" }),
      { key: "since", label: "Customer since", type: "date" },
      { key: "notes", label: "Customer notes", type: "textarea", wide: true },
    ],
  },
  contracts: {
    key: "contracts", model: "contract", label: "Contract", plural: "Contract register", titleField: "title",
    search: ["title", "product", "paymentArrangement"], orderBy: { endDate: "asc" }, dateField: "startDate",
    emptyText: "No contracts recorded yet.",
    computed: [{ key: "_paid", label: "Paid", type: "money" }, { key: "_outstanding", label: "Balance", type: "money" }],
    fields: [
      { key: "title", label: "Contract title", type: "text", required: true, table: true },
      rel("customerId", "Customer", "customers", { required: true, table: true, filter: true }),
      { key: "product", label: "Product purchased", type: "text", table: true },
      { key: "value", label: "Contract value (GHS)", type: "money", required: true, table: true, default: 0 },
      { key: "signedDate", label: "Date signed", type: "date" },
      { key: "startDate", label: "Start date", type: "date", required: true, table: true },
      { key: "endDate", label: "End date", type: "date", table: true },
      { key: "paymentArrangement", label: "Payment arrangement", type: "text", hint: "e.g. 50% upfront, balance on delivery; or monthly" },
      sel("status", "Contract status", E.CONTRACT_STATUS, { required: true, table: true, filter: true, default: "ACTIVE" }),
      { key: "notes", label: "Notes", type: "textarea", wide: true },
    ],
  },
  feedback: {
    key: "feedback", model: "customerFeedback", label: "Feedback", plural: "Customer feedback", titleField: "comments",
    search: ["comments", "actionRequired", "product"], orderBy: { date: "desc" }, dateField: "date",
    emptyText: "No customer feedback recorded yet.",
    fields: [
      rel("customerId", "Customer", "customers", { required: true, table: true, filter: true }),
      { key: "product", label: "Product / service used", type: "text", table: true },
      { key: "date", label: "Feedback date", type: "date", required: true, table: true },
      sel("category", "Category", E.FEEDBACK_CATEGORY, { required: true, table: true, filter: true, default: "POSITIVE" }),
      { key: "rating", label: "Satisfaction rating (1–5)", type: "int", min: 1, max: 5, table: true },
      sel("severity", "Complaint severity", E.SEVERITY, { hint: "Only for complaints and issues" }),
      sel("resolution", "Resolution status", E.RESOLUTION, { required: true, table: true, filter: true, default: "OPEN" }),
      { key: "followUpDate", label: "Follow-up date", type: "date", table: true },
      { key: "comments", label: "Customer comments", type: "textarea", required: true, wide: true },
      { key: "actionRequired", label: "Action required", type: "textarea", wide: true },
    ],
  },
  transactions: {
    key: "transactions", model: "financialTransaction", label: "Transaction", plural: "Transactions", titleField: "title",
    search: ["title", "reference", "description"], orderBy: { date: "desc" }, dateField: "date",
    emptyText: "No financial transactions recorded for this period.",
    fields: [
      { key: "title", label: "Transaction title", type: "text", required: true, table: true },
      sel("type", "Type", E.TX_TYPE, { required: true, table: true, filter: true, default: "INCOME" }),
      { key: "amount", label: "Amount (GHS)", type: "money", required: true, table: true },
      { key: "category", label: "Category", type: "select", required: true, table: true, options: E.ALL_TX_CATEGORIES, filter: true },
      { key: "date", label: "Transaction date", type: "date", required: true, table: true },
      sel("paymentMethod", "Payment method", E.PAYMENT_METHOD, { required: true, table: true, default: "MTN_MOMO" }),
      rel("customerId", "Related customer (optional)", "customers"),
      rel("projectId", "Related project (optional)", "projects"),
      rel("invoiceId", "Pays invoice (optional)", "invoices", { hint: "Link income to an invoice so the balance updates" }),
      rel("contractId", "Related contract (optional)", "contracts"),
      { key: "reference", label: "Reference number (optional)", type: "text" },
      { key: "description", label: "Description", type: "textarea", wide: true },
    ],
  },
  invoices: {
    key: "invoices", model: "invoice", label: "Invoice", plural: "Invoices", titleField: "number",
    search: ["number", "notes"], orderBy: { issueDate: "desc" }, dateField: "issueDate",
    emptyText: "No invoices recorded yet.",
    computed: [{ key: "_paid", label: "Paid", type: "money" }, { key: "_outstanding", label: "Outstanding", type: "money" }, { key: "_state", label: "State", type: "text" }],
    fields: [
      { key: "number", label: "Invoice number", type: "text", table: true, hint: "Leave blank to number automatically (INV-2026-0001)" },
      rel("customerId", "Customer", "customers", { required: true, table: true, filter: true }),
      rel("contractId", "Contract (optional)", "contracts"),
      rel("projectId", "Project (optional)", "projects"),
      { key: "category", label: "Income category", type: "select", options: E.INCOME_CATEGORIES, default: "SOFTWARE_DEVELOPMENT", required: true },
      { key: "amount", label: "Invoice amount (GHS)", type: "money", required: true, table: true },
      { key: "issueDate", label: "Issue date", type: "date", required: true, table: true },
      { key: "dueDate", label: "Due date", type: "date", required: true, table: true },
      sel("status", "Status", E.INVOICE_STATUS, { required: true, filter: true, default: "SENT" }),
      { key: "notes", label: "Notes", type: "textarea", wide: true },
    ],
  },
  projects: {
    key: "projects", model: "project", label: "Project", plural: "Projects & products", titleField: "name",
    search: ["name", "description"], orderBy: { createdAt: "desc" },
    emptyText: "No projects yet.",
    computed: [{ key: "_received", label: "Received", type: "money" }, { key: "_outstanding", label: "Balance", type: "money" }, { key: "_progress", label: "Progress", type: "percent" }],
    fields: [
      { key: "name", label: "Project name", type: "text", required: true, table: true },
      sel("category", "Category", E.PRODUCT_CATEGORY, { required: true, table: true, filter: true }),
      rel("customerId", "Customer (optional)", "customers", { table: true }),
      sel("status", "Status", E.PROJECT_STATUS, { required: true, table: true, filter: true, default: "ACTIVE" }),
      { key: "startDate", label: "Start date", type: "date" },
      { key: "targetDate", label: "Target completion date", type: "date", table: true },
      { key: "completedAt", label: "Completed on", type: "date" },
      { key: "budget", label: "Budget (GHS)", type: "money", table: true, default: 0 },
      { key: "description", label: "Description", type: "textarea", wide: true },
      { key: "notes", label: "Notes", type: "textarea", wide: true },
    ],
  },
  milestones: {
    key: "milestones", model: "projectMilestone", label: "Milestone", plural: "Milestones", titleField: "title",
    search: ["title"], orderBy: { dueDate: "asc" }, emptyText: "No milestones yet.",
    fields: [
      rel("projectId", "Project", "projects", { required: true, table: true, filter: true }),
      { key: "title", label: "Milestone", type: "text", required: true, table: true },
      { key: "dueDate", label: "Due date", type: "date", table: true },
      { key: "doneAt", label: "Completed on", type: "date", table: true },
      { key: "notes", label: "Notes", type: "textarea", wide: true },
    ],
  },
  tasks: {
    key: "tasks", model: "task", label: "Task", plural: "Tasks", titleField: "title",
    search: ["title", "description"], orderBy: { dueDate: "asc" }, dateField: "dueDate",
    emptyText: "No tasks yet. Add your first task.",
    fields: [
      { key: "title", label: "Task", type: "text", required: true, table: true },
      sel("priority", "Priority", E.TASK_PRIORITY, { required: true, table: true, filter: true, default: "MEDIUM" }),
      sel("status", "Status", E.TASK_STATUS, { required: true, table: true, filter: true, default: "TODO" }),
      sel("department", "Department", E.DEPARTMENT, { required: true, table: true, filter: true, default: "ENGINEERING" }),
      { key: "startDate", label: "Start date", type: "date" },
      { key: "dueDate", label: "Due date", type: "date", table: true },
      rel("projectId", "Related project", "projects"),
      { key: "priorityId", label: "Supports strategic priority", type: "relation", relation: "priorities", rel: "strategicPriority" },
      { key: "description", label: "Description", type: "textarea", wide: true },
    ],
  },
  problems: {
    key: "problems", model: "businessProblem", label: "Problem", plural: "Problems & bottlenecks", titleField: "title",
    search: ["title", "description", "rootCause"], orderBy: { identifiedAt: "desc" }, dateField: "identifiedAt",
    emptyText: "No problems recorded. Add anything that is blocking progress.",
    fields: [
      { key: "title", label: "Problem", type: "text", required: true, table: true },
      sel("severity", "Severity", E.SEVERITY, { required: true, table: true, filter: true, default: "MEDIUM" }),
      sel("status", "Status", E.PROBLEM_STATUS, { required: true, table: true, filter: true, default: "OPEN" }),
      sel("department", "Department", E.DEPARTMENT, { required: true, table: true, filter: true }),
      { key: "identifiedAt", label: "Date identified", type: "date", required: true, table: true },
      { key: "deadline", label: "Resolution deadline", type: "date", table: true },
      { key: "resolvedAt", label: "Resolution date", type: "date" },
      { key: "assignedTo", label: "Assigned person", type: "text" },
      rel("projectId", "Related project", "projects"),
      { key: "description", label: "Description", type: "textarea", wide: true },
      { key: "rootCause", label: "Root cause", type: "textarea", wide: true },
      { key: "businessImpact", label: "Business impact", type: "textarea", wide: true },
      { key: "solution", label: "Proposed solution", type: "textarea", wide: true },
      { key: "lessons", label: "Lessons learned", type: "textarea", wide: true },
    ],
  },
  lessons: {
    key: "lessons", model: "lessonLearned", label: "Lesson", plural: "Lessons library", titleField: "title",
    search: ["title", "description", "proposedAction"], orderBy: { date: "desc" }, dateField: "date",
    emptyText: "No lessons saved yet. Reflect on this week and record what it taught you.",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, table: true },
      sel("category", "Category", E.LESSON_CATEGORY, { required: true, table: true, filter: true, default: "LESSON" }),
      { key: "date", label: "Date", type: "date", required: true, table: true },
      rel("projectId", "Related project (optional)", "projects"),
      { key: "description", label: "Description", type: "textarea", required: true, wide: true },
      { key: "proposedAction", label: "Proposed action", type: "textarea", wide: true },
    ],
  },
  priorities: {
    key: "priorities", model: "strategicPriority", label: "Priority", plural: "Strategic priorities", titleField: "title",
    search: ["title", "objective"], orderBy: { weekStart: "desc" }, dateField: "weekStart",
    uniqueMessage: "That week already has a primary priority. Only ONE primary priority is allowed per week. Edit the existing one instead.",
    emptyText: "No strategic priorities yet. Complete a weekly review to choose one.",
    fields: [
      { key: "weekStart", label: "Week starting (Monday)", type: "date", required: true, table: true },
      sel("category", "Category", E.PRIORITY_CATEGORY, { required: true, table: true, filter: true }),
      { key: "title", label: "Priority title", type: "text", required: true, table: true },
      sel("status", "Status", E.PRIORITY_STATUS, { required: true, table: true, filter: true, default: "NOT_STARTED" }),
      { key: "deadline", label: "Deadline", type: "date", required: true, table: true },
      { key: "objective", label: "Detailed objective", type: "textarea", required: true, wide: true },
      { key: "expectedResult", label: "Expected measurable result", type: "textarea", required: true, wide: true },
      { key: "firstAction", label: "First action", type: "text", required: true, wide: true },
      { key: "successMeasure", label: "Success measurement", type: "text", required: true, wide: true },
    ],
  },
};

export const RESOURCE_KEYS = Object.keys(RESOURCES);
export const REL_TITLE: Record<string, string> = Object.fromEntries(Object.values(RESOURCES).map((r) => [r.key, r.titleField]));

/** Build the zod schema for a resource from its field list: one definition, used by server and browser. */
export function buildSchema(def: ResourceDef, partial = false): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of def.fields) {
    const req = !!f.required;
    const need = `${f.label} is required.`;
    let s: ZodTypeAny;
    switch (f.type) {
      case "number":
      case "money":
      case "int": {
        let n = z.number({ required_error: need, invalid_type_error: `${f.label} must be a number.` });
        if (f.type === "int") n = n.int(`${f.label} must be a whole number.`);
        if (f.type === "money") n = n.min(0, `${f.label} cannot be negative.`).max(1e12, "That amount is too large.");
        if (f.min !== undefined) n = n.min(f.min, `${f.label} must be at least ${f.min}.`);
        if (f.max !== undefined) n = n.max(f.max, `${f.label} must be at most ${f.max}.`);
        const pre = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : typeof v === "string" ? Number(v) : v);
        s = z.preprocess(pre, req ? n : n.nullish().transform((v) => v ?? null));
        break;
      }
      case "date": {
        const d = z.string().regex(/^\d{4}-\d{2}-\d{2}/, `${f.label} must be a valid date.`).transform((v) => v.slice(0, 10));
        s = req ? z.string({ required_error: need }).min(1, need).pipe(d) : z.preprocess((v) => (v === "" ? null : v), d.nullish().transform((v) => v ?? null));
        break;
      }
      case "select": {
        const vals = (f.options ?? []).map((x) => x.value);
        const e = z.string().refine((v) => vals.includes(v), `Choose a valid ${f.label.toLowerCase()}.`);
        s = req ? z.string({ required_error: need }).min(1, need).pipe(e) : z.preprocess((v) => (v === "" ? null : v), e.nullish().transform((v) => v ?? null));
        break;
      }
      case "relation":
        s = req ? z.string({ required_error: need }).min(1, need) : z.preprocess((v) => (v === "" ? null : v), z.string().nullish().transform((v) => v ?? null));
        break;
      case "email":
        s = z.preprocess((v) => (v === "" ? null : v), z.string().trim().email(`${f.label} must be a valid email address.`).max(200).nullish().transform((v) => v ?? null));
        break;
      default: {
        const t = z.string().trim().max(f.type === "textarea" ? 5000 : 300, `${f.label} is too long.`);
        s = req ? z.string({ required_error: need }).trim().min(1, need).pipe(t) : z.preprocess((v) => (v === "" ? null : v), t.nullish().transform((v) => v ?? null));
      }
    }
    shape[f.key] = s;
  }
  const obj = z.object(shape);
  return (partial ? obj.partial() : obj) as z.ZodObject<Record<string, ZodTypeAny>>;
}
