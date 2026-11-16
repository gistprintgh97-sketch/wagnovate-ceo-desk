/**
 * The real client IP, used for rate limiting and session records.
 *
 * Behind Render's load balancer the X-Forwarded-For header looks like "<anything the client sent>, <real client IP>".
 * Only the entry added by OUR trusted proxy can be believed, so we count from the right.
 * TRUST_PROXY_HOPS = how many trusted proxies sit in front of the app (Render alone = 1, which is the production default).
 * On a developer computer there is no proxy (0), so everything is "local".
 */
export function ipFromHeaders(get: (name: string) => string | null): string {
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === "production" ? 1 : 0));
  if (!(hops > 0)) return "local";
  const chain = (get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (chain.length) return chain[Math.max(0, chain.length - hops)].slice(0, 64);
  return (get("x-real-ip") ?? "unknown").slice(0, 64);
}
