export type Opt = { value: string; label: string };
const o = (pairs: [string, string][]): Opt[] => pairs.map(([value, label]) => ({ value, label }));

export const PRODUCT_CATEGORY = o([["WAG_SMS", "WAG SMS"], ["WAG_POS", "WAG POS"], ["CLIENT_PROJECTS", "Client Projects"], ["INTERNAL_TOOLS", "Internal Tools"], ["OTHER", "Other"]]);
export const WORK_STATUS = o([["PLANNED", "Planned"], ["IN_PROGRESS", "In progress"], ["COMPLETED", "Completed"], ["BLOCKED", "Blocked"]]);
export const ACHIEVEMENT_KIND = o([["Feature", "Feature developed"], ["Feature completed", "Feature completed"], ["Bug fix", "Bug fixed"], ["Technical", "Technical improvement"], ["Infrastructure", "Infrastructure improvement"], ["Security", "Security improvement"], ["Client delivery", "Client project delivered"], ["Outstanding", "Outstanding development work"]]);
export const LEAD_STAGE = o([["NEW_LEAD", "New Lead"], ["CONTACTED", "Contacted"], ["INTERESTED", "Interested"], ["DEMO_SCHEDULED", "Demonstration Scheduled"], ["PROPOSAL_SENT", "Proposal Sent"], ["NEGOTIATION", "Negotiation"], ["WON", "Won"], ["LOST", "Lost"]]);
export const CUSTOMER_STATUS = o([["PROSPECT", "Prospect"], ["ACTIVE", "Active"], ["AT_RISK", "At risk"], ["CHURNED", "Churned"]]);
export const CONTRACT_STATUS = o([["DRAFT", "Draft"], ["ACTIVE", "Active"], ["EXPIRED", "Expired"], ["TERMINATED", "Terminated"], ["COMPLETED", "Completed"]]);
export const FEEDBACK_CATEGORY = o([["POSITIVE", "Positive Feedback"], ["FEATURE_REQUEST", "Feature Request"], ["TECHNICAL_ISSUE", "Technical Issue"], ["COMPLAINT", "Complaint"], ["BILLING_ISSUE", "Billing Issue"], ["SUGGESTION", "General Suggestion"]]);
export const SEVERITY = o([["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"], ["CRITICAL", "Critical"]]);
export const RESOLUTION = o([["OPEN", "Open"], ["IN_PROGRESS", "In progress"], ["RESOLVED", "Resolved"], ["NOT_APPLICABLE", "Not applicable"]]);
export const TX_TYPE = o([["INCOME", "Income"], ["EXPENSE", "Expense"]]);
export const PAYMENT_METHOD = o([["MTN_MOMO", "MTN Mobile Money"], ["TELECEL_CASH", "Telecel Cash"], ["AIRTELTIGO_MONEY", "AirtelTigo Money"], ["BANK_TRANSFER", "Bank Transfer"], ["CASH", "Cash"], ["CARD", "Card"], ["OTHER", "Other"]]);
export const INVOICE_STATUS = o([["DRAFT", "Draft"], ["SENT", "Sent"], ["CANCELLED", "Cancelled"]]);
export const PROJECT_STATUS = o([["PLANNING", "Planning"], ["ACTIVE", "Active"], ["ON_HOLD", "On hold"], ["COMPLETED", "Completed"], ["CANCELLED", "Cancelled"]]);
export const TASK_STATUS = o([["TODO", "To do"], ["IN_PROGRESS", "In progress"], ["DONE", "Done"], ["CANCELLED", "Cancelled"]]);
export const TASK_PRIORITY = o([["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"], ["URGENT", "Urgent"]]);
export const DEPARTMENT = o([["ENGINEERING", "Engineering"], ["PRODUCT", "Product"], ["SALES", "Sales"], ["FINANCE", "Finance"], ["OPERATIONS", "Operations"], ["CUSTOMER_SUPPORT", "Customer Support"], ["LEADERSHIP", "Leadership"]]);
export const PROBLEM_STATUS = o([["OPEN", "Open"], ["INVESTIGATING", "Investigating"], ["IN_PROGRESS", "In progress"], ["RESOLVED", "Resolved"], ["CLOSED", "Closed"]]);
export const PRIORITY_CATEGORY = o([["ENGINEERING", "Engineering"], ["PRODUCT", "Product"], ["SALES", "Sales"], ["FINANCE", "Finance"], ["LEADERSHIP", "Leadership"]]);
export const PRIORITY_STATUS = o([["NOT_STARTED", "Not started"], ["IN_PROGRESS", "In progress"], ["COMPLETED", "Completed"], ["DELAYED", "Delayed"], ["CANCELLED", "Cancelled"]]);
export const PRIORITY_OUTCOME = o([["COMPLETED", "Yes, completed"], ["PARTIAL", "Partially completed"], ["NOT_COMPLETED", "Not completed"]]);
export const LESSON_CATEGORY = o([["WORKED", "What worked well"], ["FAILED", "What failed"], ["WASTED", "What wasted time or money"], ["STOP", "What to stop doing"], ["START", "What to start doing"], ["IMPROVE", "What to improve"], ["DELEGATE", "What to delegate or automate"], ["LESSON", "Important lesson"]]);

export const INCOME_CATEGORIES = o([["SOFTWARE_DEVELOPMENT", "Software Development"], ["WAG_SMS_SUBSCRIPTIONS", "WAG SMS Subscriptions"], ["WAG_POS_SUBSCRIPTIONS", "WAG POS Subscriptions"], ["SOFTWARE_LICENSING", "Software Licensing"], ["SOFTWARE_DISTRIBUTION", "Software Distribution"], ["CONSULTING", "Consulting"], ["MAINTENANCE_SUPPORT", "Maintenance and Support"], ["HOSTING_SERVICES", "Hosting and Infrastructure Services"], ["OTHER_INCOME", "Other Income"]]);
export const EXPENSE_CATEGORIES = o([["HOSTING_SERVERS", "Hosting and Servers"], ["DOMAIN_SSL", "Domain and SSL"], ["SOFTWARE_SUBSCRIPTIONS", "Software Subscriptions"], ["DEVELOPER_TOOLS", "Developer Tools"], ["INTERNET_COMMUNICATION", "Internet and Communication"], ["MARKETING", "Marketing and Advertising"], ["STAFF_PAYMENTS", "Staff Payments"], ["TRANSPORTATION", "Transportation"], ["EQUIPMENT", "Equipment"], ["OFFICE", "Office Expenses"], ["OTHER_EXPENSE", "Other Expenses"]]);
export const ALL_TX_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

const ALL: Opt[] = [
  ...PRODUCT_CATEGORY, ...WORK_STATUS, ...LEAD_STAGE, ...CUSTOMER_STATUS, ...CONTRACT_STATUS, ...FEEDBACK_CATEGORY, ...SEVERITY, ...RESOLUTION,
  ...TX_TYPE, ...PAYMENT_METHOD, ...INVOICE_STATUS, ...PROJECT_STATUS, ...TASK_STATUS, ...TASK_PRIORITY, ...DEPARTMENT, ...PROBLEM_STATUS,
  ...PRIORITY_CATEGORY, ...PRIORITY_STATUS, ...PRIORITY_OUTCOME, ...LESSON_CATEGORY, ...ALL_TX_CATEGORIES, ...ACHIEVEMENT_KIND,
];
const MAP = new Map<string, string>();
for (const x of ALL) if (!MAP.has(x.value)) MAP.set(x.value, x.label);
/** Human label for any enum value (falls back to a tidied version of the raw value). */
export function label(v: string | null | undefined): string {
  if (!v) return "—";
  return MAP.get(v) ?? v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
export function categoryLabel(v: string) { return MAP.get(v) ?? label(v); }
