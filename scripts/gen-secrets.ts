// Prints fresh random secrets. Run it once for your computer and AGAIN for production: never reuse the same values.
import { randomBytes } from "node:crypto";
console.log("Copy these into your .env file (local) or into the Render dashboard (production):\n");
console.log(`AUTH_SECRET="${randomBytes(48).toString("base64url")}"`);
console.log(`ENCRYPTION_KEY="${randomBytes(32).toString("hex")}"`);
console.log(`CRON_SECRET="${randomBytes(32).toString("hex")}"`);
console.log(`SETUP_TOKEN="${randomBytes(24).toString("hex")}"`);
console.log("\nKeep them private. Never put them in git, chat or email.");
console.log("ENCRYPTION_KEY protects your saved AI key: if you lose it, re-enter the AI key in Settings. Do not change it casually.");
