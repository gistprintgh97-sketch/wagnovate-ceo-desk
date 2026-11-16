import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/** The data-encryption key. ENCRYPTION_KEY is the documented name; APP_ENCRYPTION_KEY is still accepted. */
function rawKey(): string | undefined { return process.env.ENCRYPTION_KEY ?? process.env.APP_ENCRYPTION_KEY; }
export const hasEncryptionKey = () => /^[0-9a-f]{64}$/i.test(rawKey() ?? "");

function key(): Buffer {
  const k = rawKey();
  if (!k || !/^[0-9a-f]{64}$/i.test(k)) throw new Error("ENCRYPTION_KEY must be 64 hex characters. Run: pnpm secrets");
  return Buffer.from(k, "hex");
}
export function encrypt(plain: string): string {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function decrypt(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
/**
 * Session tokens are stored as an HMAC keyed with AUTH_SECRET. Someone who steals a copy of the database
 * therefore cannot turn the stored values into working login cookies without the server secret.
 */
export const sessionHash = (token: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "dev-only-not-for-production").update(token).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
