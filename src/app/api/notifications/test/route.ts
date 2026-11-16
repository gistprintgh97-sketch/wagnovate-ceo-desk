import { route } from "@/server/api";
import { notify } from "@/server/reminders";

export const POST = route({}, async () => {
  const ok = await notify({ type: "TEST", title: "Test notification", body: "If you can read this, notifications are working.", link: "/notifications", dedupeKey: `test:${Date.now()}` });
  return { ok };
});
