// In-memory sliding window. Fine for a single-owner app on one server instance.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - arr[0])) / 1000) }; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return { ok: true, retryAfterSec: 0 };
}
