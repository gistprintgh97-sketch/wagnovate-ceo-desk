// Node-only part of server start-up: environment check and the in-process reminder scheduler.
import cron from "node-cron";
import { runReminders } from "./server/reminders";
import { productionEnvProblems } from "./server/env";

/** In production, refuse to start with a missing or weak secret, and say exactly which one (names only, never values). */
export function checkEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  const problems = productionEnvProblems();
  if (problems.length) {
    console.error("[startup] The app cannot start because of these settings:\n - " + problems.join("\n - "));
    process.exit(1);
  }
  console.log("[startup] Environment check passed.");
}

/**
 * Reminder scheduler. A Postgres advisory lock inside runReminders() guarantees only one run happens at a time,
 * and notification dedupe keys guarantee no reminder is ever sent twice.
 * On Render, DISABLE_INTERNAL_SCHEDULER=true is set and the Cron Job service calls /api/cron/reminders instead.
 */
export function startScheduler() {
  if (process.env.DISABLE_INTERNAL_SCHEDULER === "true") { console.log("[reminders] built-in scheduler disabled (an external cron calls the reminder endpoint)."); return; }
  const g = globalThis as unknown as { __ceoCron?: boolean };
  if (g.__ceoCron) return;
  g.__ceoCron = true;
  const run = () => runReminders().then((r) => { if (r.created.length) console.log(`[reminders] ${r.created.length} new reminder(s) created`); }).catch((e) => console.error(`[reminders] failed: ${(e as Error).name}`));
  cron.schedule("*/5 * * * *", run, { timezone: "Africa/Accra" });
  setTimeout(run, 30_000);
  console.log("[reminders] scheduler started (every 5 minutes, Africa/Accra)");
}
