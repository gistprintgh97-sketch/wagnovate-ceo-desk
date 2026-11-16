import { z } from "zod";
import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { encrypt, hasEncryptionKey } from "@/server/crypto";
import { getCompany, getSettings } from "@/server/settings";
import { describeSchedule } from "@/server/schedule";
import { pushConfigured } from "@/server/reminders";
import { envAiKey } from "@/server/summary";

async function view(userId: string) {
  const [company, s, user, subs] = await Promise.all([getCompany(), getSettings(), db.user.findUniqueOrThrow({ where: { id: userId } }), db.pushSubscription.count({ where: { userId } })]);
  const { aiKeyEnc, ...rest } = s; // the encrypted key never leaves the server
  return {
    company, settings: { ...rest, aiKeySet: !!aiKeyEnc || !!envAiKey() }, scheduleText: describeSchedule(s),
    user: { id: user.id, name: user.name, email: user.email, avatarDocId: user.avatarDocId },
    push: { configured: pushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY ?? "", subscriptions: subs },
    emailConfigured: !!process.env.SMTP_HOST, encryptionConfigured: hasEncryptionKey(),
  };
}
export const GET = route({}, async ({ user }) => view(user.id));

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 18:00.");
const body = z.discriminatedUnion("section", [
  z.object({ section: z.literal("company"), name: z.string().trim().min(2).max(120), slogan: z.string().trim().max(200), website: z.string().trim().max(200), email: z.string().trim().email().or(z.literal("")).nullable(), phone: z.string().trim().max(40).nullable(), address: z.string().trim().max(200) }),
  z.object({ section: z.literal("profile"), name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email("Enter a valid email.") }),
  z.object({ section: z.literal("appearance"), theme: z.enum(["dark", "light", "system"]) }),
  z.object({ section: z.literal("notifications"), reviewDay: z.number().int().min(0).max(6), reviewTime: hhmm, reviewEveryWeeks: z.number().int().min(1).max(4), notifyReview: z.boolean(), notifyTasks: z.boolean(), notifyFollowUps: z.boolean(), notifyInvoices: z.boolean(), notifyProblems: z.boolean(), notifyPriority: z.boolean(), notifyContracts: z.boolean(), lowConversionPct: z.number().int().min(1).max(90) }),
  z.object({ section: z.literal("ai"), aiProvider: z.enum(["none", "anthropic", "openai"]), aiModel: z.string().trim().max(80).nullable(), aiBaseUrl: z.string().trim().url().max(200).or(z.literal("")).nullable(), aiAutoSummary: z.boolean(), apiKey: z.string().max(400).optional(), clearKey: z.boolean().optional() }),
]);

export const PATCH = route({ body }, async ({ user, body }) => {
  switch (body.section) {
    case "company": { const { section: _s, ...d } = body; void _s; await db.company.update({ where: { id: "company" }, data: { ...d, email: d.email || null } }); break; }
    case "profile": await db.user.update({ where: { id: user.id }, data: { name: body.name, email: body.email } }); break;
    case "appearance": await db.applicationSettings.update({ where: { id: "settings" }, data: { theme: body.theme } }); break;
    case "notifications": { const { section: _s, ...d } = body; void _s; await db.applicationSettings.update({ where: { id: "settings" }, data: d }); break; }
    case "ai": {
      const data: Record<string, unknown> = { aiProvider: body.aiProvider, aiModel: body.aiModel || null, aiBaseUrl: body.aiBaseUrl || null, aiAutoSummary: body.aiAutoSummary };
      if (body.clearKey) data.aiKeyEnc = null;
      else if (body.apiKey) { if (!hasEncryptionKey()) throw new AppError(400, "Set ENCRYPTION_KEY (run: pnpm secrets) before saving an API key."); data.aiKeyEnc = encrypt(body.apiKey.trim()); }
      await db.applicationSettings.update({ where: { id: "settings" }, data });
      break;
    }
  }
  return view(user.id);
});
