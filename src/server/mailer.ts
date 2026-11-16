import nodemailer from "nodemailer";
/** Sends email if SMTP is configured; otherwise prints it to the server console (documented fallback). */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!process.env.SMTP_HOST) {
    console.log(`\n[mail:not-configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
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
