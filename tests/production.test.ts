import { afterEach, describe, expect, it } from "vitest";
import { ipFromHeaders } from "@/server/ip";
import { productionEnvProblems } from "@/server/env";
import { sessionHash, hasEncryptionKey, encrypt, decrypt } from "@/server/crypto";

const good = {
  DATABASE_URL: "postgresql://x", APP_URL: "https://ceo.wagnovate.com", AUTH_SECRET: "a".repeat(40), SETUP_TOKEN: "b".repeat(24),
  CRON_SECRET: "c".repeat(32), ENCRYPTION_KEY: "d".repeat(64), UPLOAD_DIR: "/var/data/uploads",
} as unknown as NodeJS.ProcessEnv;

describe("production environment check", () => {
  it("accepts a complete production configuration", () => { expect(productionEnvProblems(good)).toEqual([]); });
  it("names each missing or weak setting without revealing any value", () => {
    const p = productionEnvProblems({ ...good, AUTH_SECRET: "short", CRON_SECRET: "", ENCRYPTION_KEY: "xyz", SETUP_TOKEN: undefined } as unknown as NodeJS.ProcessEnv);
    expect(p.map((x) => x.split(":")[0]).sort()).toEqual(["AUTH_SECRET", "CRON_SECRET", "ENCRYPTION_KEY", "SETUP_TOKEN"]);
    expect(p.join(" ")).not.toContain("short");
  });
  it("requires an https APP_URL with no trailing slash", () => {
    expect(productionEnvProblems({ ...good, APP_URL: "http://ceo.wagnovate.com" } as unknown as NodeJS.ProcessEnv)).toHaveLength(1);
    expect(productionEnvProblems({ ...good, APP_URL: "https://ceo.wagnovate.com/" } as unknown as NodeJS.ProcessEnv)).toHaveLength(1);
  });
  it("rejects an uploads folder that would be wiped on deploy", () => {
    expect(productionEnvProblems({ ...good, UPLOAD_DIR: "./storage/uploads" } as unknown as NodeJS.ProcessEnv).join()).toMatch(/UPLOAD_DIR/);
  });
  it("accepts the older APP_ENCRYPTION_KEY name", () => {
    const { ENCRYPTION_KEY: _k, ...rest } = good; void _k;
    expect(productionEnvProblems({ ...rest, APP_ENCRYPTION_KEY: "e".repeat(64) } as unknown as NodeJS.ProcessEnv)).toEqual([]);
  });
});

describe("trusting the proxy for client IPs", () => {
  const old = { hops: process.env.TRUST_PROXY_HOPS };
  afterEach(() => { if (old.hops === undefined) delete process.env.TRUST_PROXY_HOPS; else process.env.TRUST_PROXY_HOPS = old.hops; });
  const h = (xff: string | null, real: string | null = null) => (n: string) => (n === "x-forwarded-for" ? xff : n === "x-real-ip" ? real : null);

  it("with one trusted proxy, believes only the LAST entry, so a client cannot fake its address", () => {
    process.env.TRUST_PROXY_HOPS = "1";
    expect(ipFromHeaders(h("6.6.6.6, 41.66.1.2"))).toBe("41.66.1.2");
    expect(ipFromHeaders(h("41.66.1.2"))).toBe("41.66.1.2");
  });
  it("with two hops (e.g. Cloudflare then Render) takes the second from the right", () => {
    process.env.TRUST_PROXY_HOPS = "2";
    expect(ipFromHeaders(h("6.6.6.6, 41.66.1.2, 172.70.0.1"))).toBe("41.66.1.2");
  });
  it("with no proxy, ignores forwarded headers completely", () => {
    process.env.TRUST_PROXY_HOPS = "0";
    expect(ipFromHeaders(h("6.6.6.6"))).toBe("local");
  });
});

describe("secrets handling", () => {
  it("session tokens are stored as a keyed hash that changes with AUTH_SECRET", () => {
    const before = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "one-secret-one-secret-one-secret-1234";
    const a = sessionHash("token");
    process.env.AUTH_SECRET = "two-secret-two-secret-two-secret-5678";
    const b = sessionHash("token");
    if (before === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = before;
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("token");
  });
  it("encrypts and decrypts the AI key round-trip, and the stored form hides the key", () => {
    process.env.ENCRYPTION_KEY = "ab".repeat(32);
    expect(hasEncryptionKey()).toBe(true);
    const blob = encrypt("sk-test-123456");
    expect(blob).not.toContain("sk-test");
    expect(decrypt(blob)).toBe("sk-test-123456");
    delete process.env.ENCRYPTION_KEY;
  });
});
