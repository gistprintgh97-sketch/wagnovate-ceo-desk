import nodemailer from "nodemailer";

/**
 * Sends email if SMTP is configured.
 * Without SMTP: on a developer computer the message (including the reset link) is printed so you can use it.
 * In PRODUCTION nothing sensitive is ever printed, because logs are stored and shared. The message is simply not sent.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === "production") console.warn("[mail] SMTP is not configured, so an email was not sent. Use `pnpm admin:reset-password <email>` from the Render Shell to reset a password.");
    else console.log(`\n[mail:not-configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  }
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await t.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
  return true;
}
