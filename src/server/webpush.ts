import * as webpushNs from "web-push";

type WebPush = typeof import("web-push");

/**
 * web-push is a CommonJS package. Depending on the runtime (Next.js bundler, tsx on Node 26, plain Node ESM)
 * its API arrives either as the module's `default` export or directly on the namespace object.
 * This picks whichever one actually has the functions, so every import site behaves the same everywhere.
 */
const ns = webpushNs as unknown as Partial<WebPush> & { default?: WebPush };
export const webpush: WebPush = (ns.default ?? (ns as WebPush));
