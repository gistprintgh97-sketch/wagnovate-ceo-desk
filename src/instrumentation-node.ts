// Node-only part of server start-up: the in-process reminder scheduler.
// A Postgres advisory lock inside runReminders() guarantees only one instance does the work,
// and notification dedupe keys guarantee no duplicate reminders.
import cron from "node-cron";
import { runReminders } from "./server/reminders";

export function startScheduler() {
  const g = globalThis as unknown as { __ceoCron?: boolean };
  if (g.__ceoCron) return;
  g.__ceoCron = true;
  const run = () => runReminders().then((r) => { if (r.created.length) console.log(`[reminders] created: ${r.created.join(", ")}`); }).catch((e) => console.error("[reminders] failed", e));
  cron.schedule("*/5 * * * *", run, { timezone: "Africa/Accra" });
  setTimeout(run, 30_000);
  console.log("[reminders] scheduler started (every 5 minutes, Africa/Accra)");
}
