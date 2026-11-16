import { randomBytes } from "node:crypto";
console.log("Paste these into your .env file:\n");
console.log(`APP_ENCRYPTION_KEY="${randomBytes(32).toString("hex")}"`);
console.log(`CRON_SECRET="${randomBytes(24).toString("hex")}"`);
console.log(`SETUP_TOKEN="${randomBytes(18).toString("hex")}"`);
