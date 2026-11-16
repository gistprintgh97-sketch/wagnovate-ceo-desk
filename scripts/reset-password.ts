/** Emergency password reset for the CEO account, run on the server. Usage: pnpm admin:reset-password you@example.com */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { createInterface } from "node:readline/promises";

const db = new PrismaClient();
const email = (process.argv[2] ?? "").toLowerCase();
if (!email) { console.error("Usage: pnpm admin:reset-password you@example.com"); process.exit(1); }
const user = await db.user.findUnique({ where: { email } });
if (!user) { console.error("No account with that email."); process.exit(1); }
const rl = createInterface({ input: process.stdin, output: process.stdout });
const pw = await rl.question("New password (10+ characters, upper, lower, number): ");
rl.close();
if (pw.length < 10 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) { console.error("That password is too weak."); process.exit(1); }
await db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 }), failedLogins: 0, lockedUntil: null } });
await db.session.deleteMany({ where: { userId: user.id } });
console.log("Password changed. All sessions were signed out.");
await db.$disconnect();
