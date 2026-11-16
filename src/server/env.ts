import path from "node:path";

/** Checked once when the production server starts. Reports variable NAMES only, never values. */
export function productionEnvProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const p: string[] = [];
  const need = (name: string, ok: boolean, why: string) => { if (!ok) p.push(`${name}: ${why}`); };
  need("DATABASE_URL", !!env.DATABASE_URL, "is missing.");
  need("APP_URL", /^https:\/\/[^/\s]+$/.test(env.APP_URL ?? ""), "must be your public https address with no trailing slash, e.g. https://ceo.wagnovate.com");
  need("AUTH_SECRET", (env.AUTH_SECRET ?? "").length >= 32, "must be at least 32 characters. Run: pnpm secrets");
  need("SETUP_TOKEN", (env.SETUP_TOKEN ?? "").length >= 16, "must be at least 16 characters. Run: pnpm secrets");
  need("CRON_SECRET", (env.CRON_SECRET ?? "").length >= 24, "must be at least 24 characters. Run: pnpm secrets");
  need("ENCRYPTION_KEY", /^[0-9a-f]{64}$/i.test(env.ENCRYPTION_KEY ?? env.APP_ENCRYPTION_KEY ?? ""), "must be exactly 64 hex characters. Run: pnpm secrets");
  const upload = env.UPLOAD_DIR ?? "";
  need("UPLOAD_DIR", path.isAbsolute(upload), "must be an absolute path on the persistent disk (e.g. /var/data/uploads). A relative path would be wiped on every deploy.");
  if (env.VAPID_PUBLIC_KEY || env.VAPID_PRIVATE_KEY) need("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY", !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY, "set both or neither.");
  return p;
}
