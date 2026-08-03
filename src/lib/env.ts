// Cloudflare Workers & Node.js Edge Environment Resolver — OmniZeus
// Safe environment variable lookup across Node.js, Next.js Edge Runtime and Cloudflare Workers

export function getEnv(key: string): string | undefined {
  // 1. Standard process.env
  try {
    if (typeof process !== "undefined" && process.env && process.env[key] !== undefined) {
      const val = process.env[key];
      if (val) return val;
    }
  } catch {}

  // 2. Cloudflare Workers getRequestContext().env
  try {
    const { getRequestContext } = require("@cloudflare/next-on-pages");
    const ctx = getRequestContext();
    if (ctx && ctx.env && ctx.env[key] !== undefined) {
      const val = String(ctx.env[key]);
      if (val) return val;
    }
  } catch {}

  // 3. Global env fallback (Cloudflare Workers global scope)
  try {
    const g = globalThis as any;
    if (g && g[key] !== undefined) {
      return String(g[key]);
    }
  } catch {}

  return undefined;
}
