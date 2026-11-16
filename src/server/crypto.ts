import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
function key(): Buffer {
  const k = process.env.APP_ENCRYPTION_KEY;
  if (!k || !/^[0-9a-f]{64}$/i.test(k)) throw new Error("APP_ENCRYPTION_KEY must be 64 hex characters. Run: pnpm secrets");
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
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
