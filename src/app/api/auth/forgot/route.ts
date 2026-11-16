import { z } from "zod";
import { route } from "@/server/api";
import { db } from "@/server/db";
import { randomToken, sha256 } from "@/server/crypto";
import { sendMail } from "@/server/mailer";

const body = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email.") });

export const POST = route({ public: true, body, limit: { key: "forgot", max: 5, windowMs: 900_000 } }, async ({ body }) => {
  const user = await db.user.findUnique({ where: { email: body.email } });
  if (user) {
    const token = randomToken(32);
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3_600_000) },
    });
    const link = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
    await sendMail(
      user.email,
      "Reset your WAGNOVATE CEO Desk password",
      `Use this link within 1 hour to choose a new password:\n\n${link}\n\nIf you did not ask for this, ignore this message.`,
    );
  }
  // Same answer whether or not the email exists, so nobody can probe for accounts.
  return {
    ok: true,
    message: "If that email belongs to the account, a reset link has been sent (or printed in the server console if email is not set up).",
  };
});
