import { route } from "@/server/api";
import { destroySession } from "@/server/auth";
export const POST = route({ public: true }, async () => {
  await destroySession();
  return { ok: true };
});
